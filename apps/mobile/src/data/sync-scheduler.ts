import NetInfo from '@react-native-community/netinfo';
import { resolvePendingAddresses, type SyncEngine } from '@preuvio/shared';
import { AppState } from 'react-native';
import { nearestAddress } from '@/lib/geocoding';

const INTERVAL_MS = 60_000;

/**
 * Quand synchroniser : au démarrage, au retour au premier plan, au retour du réseau,
 * et toutes les minutes au premier plan.
 * Ne bloque jamais l'écran : tout se passe en arrière-plan.
 */
export function startSyncScheduler(engine: SyncEngine): () => void {
  let active = AppState.currentState === 'active';
  let timer: ReturnType<typeof setInterval> | null = null;

  const run = async (force = false) => {
    const report = await engine.sync({ force });
    if (!report.offline) {
      const resolved = await resolvePendingAddresses(engine, nearestAddress);
      if (resolved > 0) await engine.sync({ force: true });
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
  if (active) startTimer();
  safeRun(true);

  return () => {
    stopTimer();
    appState.remove();
    netInfo();
  };
}
