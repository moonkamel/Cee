import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

// Notifications push (section 14) : demandes de reprise du bureau. Le jeton n'existe qu'une
// fois l'appli construite avec un projet Expo (EAS) ; sans lui, la demande arrive à la
// synchronisation, rien ne casse.

/** Identifiant du projet Expo (app.json → extra.eas.projectId), absent avant le premier build. */
export function expoProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? null;
}

/** Jeton push de ce téléphone, ou null (pas de projet Expo, refus, simulateur). */
export async function pushToken(): Promise<{ token: string; platform: 'ios' | 'android' } | null> {
  const projectId = expoProjectId();
  if (!projectId || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return null;
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  return { token: data, platform: Platform.OS };
}

/** `preuvio://jobsite/j1/camera?slot=s1` → chemin de l'appli. */
export function pathFromUrl(url: unknown): string | null {
  if (typeof url !== 'string' || !url.startsWith('preuvio://')) return null;
  const path = `/${url.slice('preuvio://'.length)}`;
  return path === '/' ? '/' : path;
}

/** Toucher une notification ouvre l'écran utile (caméra sur la bonne consigne). */
export function listenToNotificationTaps(): () => void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const path = pathFromUrl(response.notification.request.content.data?.url);
    if (path) router.push(path as never);
  });
  return () => sub.remove();
}
