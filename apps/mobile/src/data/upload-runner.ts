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
  const transport = createSupabaseUploadTransport(supabase, {
    read: (uri) => new File(uri).bytes(),
    async remove(uri) {
      const file = new File(uri);
      if (file.exists) file.delete();
    },
  });
  const uploader = createPhotoUploader({ engine, transport });
  const files = {
    read: (uri: string) => new File(uri).bytes(),
    async remove(uri: string) {
      const file = new File(uri);
      if (file.exists) file.delete();
    },
  };
  // Notes vocales : mêmes conditions (réseau, batterie, Wi-Fi), après les photos.
  const voice = createVoiceUploader({
    engine,
    transport: createSupabaseVoiceTransport(supabase, files),
  });
  const listeners = new Set<() => void>();
  let blocked: UploadBlock | null = null;

  return {
    async run(force = false) {
      const wifiOnly = (await engine.getMeta(WIFI_ONLY_META)) === '1';
      const conditions = await readUploadConditions(wifiOnly);
      const report = await uploader.run(conditions, { force });
      await voice.run(conditions, { force }).catch(() => undefined);
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
