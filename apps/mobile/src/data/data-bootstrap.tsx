import { createSupabaseRemote, createSyncEngine, type SyncEngine } from '@preuvio/shared';
import * as Application from 'expo-application';
import { randomUUID } from 'expo-crypto';
import * as Device from 'expo-device';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/auth/auth';
import { supabase } from '@/lib/supabase';
import { DataProvider } from './data-context';
import { openLocalDb } from './expo-sqlite-db';
import { createLocalSource } from './local-source';
import { startSyncScheduler } from './sync-scheduler';
import { createUploadRunner } from './upload-runner';

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
          })
        : null,
    [engine, uploads, userId],
  );

  if (!source) return null;
  return <DataProvider source={source}>{children}</DataProvider>;
}
