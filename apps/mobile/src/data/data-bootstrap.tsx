import { createSupabaseRemote, createSyncEngine, type SyncEngine } from '@preuvio/shared';
import * as Application from 'expo-application';
import { randomUUID } from 'expo-crypto';
import * as Device from 'expo-device';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/auth/auth';
import { config } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { DataProvider } from './data-context';
import { openLocalDb } from './expo-sqlite-db';
import { createLocalSource } from './local-source';
import { startSyncScheduler } from './sync-scheduler';
import { createUploadRunner } from './upload-runner';
import { listenToNotificationTaps, pushToken } from '@/lib/push';

/**
 * Ouvre la base locale, puis synchronise tant qu'un utilisateur est connecté.
 * Les données d'un autre utilisateur sont effacées avant toute lecture.
 */
export function DataBootstrap({ children }: { children: ReactNode }) {
  const { userId, status } = useAuth();
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  const [owner, setOwner] = useState<string | null | undefined>(undefined);
  const uploads = useMemo(() => (engine ? createUploadRunner(engine) : null), [engine]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const db = await openLocalDb();
      const e = createSyncEngine({ db, remote: createSupabaseRemote(supabase) });
      await e.init();
      if (alive) {
        setOwner(await e.getMeta('owner'));
        setEngine(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!engine || !uploads || status !== 'signedIn' || !userId) return;
    let stop: (() => void) | null = null;
    let alive = true;
    void (async () => {
      if (owner !== userId) {
        await engine.reset();
        await engine.setMeta('owner', userId);
        if (alive) setOwner(userId);
      }
      if (alive) stop = startSyncScheduler(engine, uploads);
    })();
    return () => {
      alive = false;
      stop?.();
    };
  }, [engine, uploads, status, userId, owner]);

  const source = useMemo(
    () =>
      engine
        ? createLocalSource({
            engine,
            currentUserId: () => userId,
            newId: randomUUID,
            deviceInfo: {
              model: Device.modelName ?? null,
              appVersion: Application.nativeApplicationVersion ?? null,
            },
            uploads,
            // Mode client : lien d'un jour créé par le serveur pour un chantier de ce poseur.
            clientLinks: async (jobsiteId) => {
              const { data, error } = await supabase.rpc('client_mode_link', {
                p_jobsite: jobsiteId,
              });
              return error || typeof data !== 'string' ? null : `${config.webUrl}/c/${data}`;
            },
          })
        : null,
    [engine, uploads, userId],
  );

  // Notifications push : jeton enregistré par la file d'envoi, toucher ouvre l'écran utile.
  useEffect(() => {
    if (!source || status !== 'signedIn' || !userId) return;
    const stop = listenToNotificationTaps();
    void pushToken()
      .then((p) => (p ? source.registerPushToken(p.token, p.platform) : undefined))
      .catch(() => undefined);
    return stop;
  }, [source, status, userId]);

  if (!source) return null;
  return <DataProvider source={source}>{children}</DataProvider>;
}
