import NetInfo from '@react-native-community/netinfo';
import {
  createPhotoUploader,
  createSupabaseUploadTransport,
  createSupabaseVoiceTransport,
  createVoiceUploader,
  type SyncEngine,
  type UploadBlock,
  type UploadConditions,
  type UploadReport,
} from '@preuvio/shared';
import * as Battery from 'expo-battery';
import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { reportHandledError, track } from '@/lib/telemetry';
import { WIFI_ONLY_META } from './settings';

/** Réseau et batterie du moment, pour décider si l'on envoie les photos. */
export async function readUploadConditions(wifiOnly: boolean): Promise<UploadConditions> {
  const [net, level, state] = await Promise.all([
    NetInfo.fetch(),
    Battery.getBatteryLevelAsync().catch(() => -1),
    Battery.getBatteryStateAsync().catch(() => Battery.BatteryState.UNKNOWN),
  ]);
  return {
    online: Boolean(net.isConnected) && net.isInternetReachable !== false,
    wifi: net.type === 'wifi' || net.type === 'ethernet',
    wifiOnly,
    batteryLevel: level < 0 ? null : level,
    charging: state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL,
  };
}

export type UploadRunner = {
  run(force?: boolean): Promise<UploadReport>;
  /** Pourquoi l'envoi est en pause (batterie, Wi-Fi…), ou null. */
  blocked(): UploadBlock | null;
  onChange(listener: () => void): () => void;
};

/** Envoi des photos de ce téléphone vers Supabase Storage, contrôlé par verify-photo. */
export function createUploadRunner(engine: SyncEngine): UploadRunner {
  const files = {
    read: async (uri: string) => new File(uri).bytes(),
    async remove(uri: string) {
      const file = new File(uri);
      if (file.exists) file.delete();
    },
  };
  const transport = createSupabaseUploadTransport(supabase, files, (stage, error) =>
    reportHandledError(error, `photo_${stage}`),
  );
  const uploader = createPhotoUploader({ engine, transport });
  // Notes vocales : mêmes conditions (réseau, batterie, Wi-Fi), après les photos.
  const voice = createVoiceUploader({
    engine,
    transport: createSupabaseVoiceTransport(supabase, files, (stage, error) =>
      reportHandledError(error, `voice_${stage}`),
    ),
  });
  let lastSummary = '';
  const listeners = new Set<() => void>();
  let blocked: UploadBlock | null = null;

  return {
    async run(force = false) {
      const wifiOnly = (await engine.getMeta(WIFI_ONLY_META)) === '1';
      const conditions = await readUploadConditions(wifiOnly);
      const report = await uploader.run(conditions, { force });
      const voiceReport = await voice.run(conditions, { force }).catch((error: unknown) => {
        reportHandledError(error, 'voice_run');
        return null;
      });
      // Suivi : un événement quand l'état des envois change (pas à chaque minute).
      const voiceWaiting = voiceReport?.waiting ?? 0;
      const summary = `${report.blocked}:${report.verified}:${report.failed}:${report.waiting}:${voiceWaiting}`;
      if (
        summary !== lastSummary &&
        (report.waiting > 0 || report.verified > 0 || voiceWaiting > 0)
      ) {
        lastSummary = summary;
        track('upload_run', {
          verified: report.verified,
          failed: report.failed,
          waiting: report.waiting,
          unsynced: report.unsynced ?? 0,
          blocked: report.blocked,
          wifi: conditions.wifi,
          battery: conditions.batteryLevel,
          voice_failed: voiceReport?.failed ?? null,
          voice_waiting: voiceReport?.waiting ?? null,
        });
      }
      if (report.blocked !== blocked) {
        blocked = report.blocked;
        listeners.forEach((l) => l());
      }
      return report;
    },
    blocked: () => blocked,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
