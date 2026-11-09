import NetInfo from '@react-native-community/netinfo';
import { resolvePendingAddresses, type SyncEngine } from '@preuvio/shared';
import * as Battery from 'expo-battery';
import { AppState } from 'react-native';
import { nearestAddress } from '@/lib/geocoding';
import type { UploadRunner } from './upload-runner';

const INTERVAL_MS = 60_000;

/**
 * Quand synchroniser : au démarrage, au retour au premier plan, au retour du réseau,
 * et toutes les minutes au premier plan. Les photos partent après chaque synchronisation
 * réussie, et dès que le téléphone est branché.
 * Ne bloque jamais l'écran : tout se passe en arrière-plan.
 */
export function startSyncScheduler(engine: SyncEngine, uploads: UploadRunner): () => void {
  let active = AppState.currentState === 'active';
  let timer: ReturnType<typeof setInterval> | null = null;

  const run = async (force = false) => {
    const report = await engine.sync({ force });
    if (!report.offline) {
      const resolved = await resolvePendingAddresses(engine, nearestAddress);
      if (resolved > 0) await engine.sync({ force: true });
      await uploads.run(force);
    }
  };
  const safeRun = (force = false) => void run(force).catch(() => undefined);

  const startTimer = () => {
    if (!timer) timer = setInterval(() => safeRun(), INTERVAL_MS);
  };
  const stopTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const appState = AppState.addEventListener('change', (state) => {
    active = state === 'active';
    if (active) {
      startTimer();
      safeRun();
    } else {
      stopTimer();
    }
  });
  const netInfo = NetInfo.addEventListener((s) => {
    if (s.isConnected && s.isInternetReachable !== false && active) safeRun(true);
  });
  // Branché : la batterie n'est plus un frein, on envoie sans attendre.
  const battery = Battery.addBatteryStateListener(({ batteryState }) => {
    if (batteryState === Battery.BatteryState.CHARGING) safeRun(true);
  });
  if (active) startTimer();
  safeRun(true);

  return () => {
    stopTimer();
    appState.remove();
    netInfo();
    battery.remove();
  };
}
