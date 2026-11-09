// Généré depuis packages/shared/src/notify/push.ts : ne pas modifier à la main.
// Notifications push (section 14) : heures calmes de 20 h à 7 h (heure de Paris), seules les
// alertes de seuil et de contrôle passent la nuit. Envoi par le service push d'Expo.

/** Alertes qui passent même la nuit (section 14). */
export const CRITICAL_KINDS: readonly string[] = ['batch_threshold', 'inspection_failed'];

export const QUIET_START_HOUR = 20;
export const QUIET_END_HOUR = 7;

/** Heure locale (0-23) à Paris pour un instant donné. */
export function parisHour(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: 'Europe/Paris',
  }).formatToParts(new Date(iso));
  return Number(parts.find((p) => p.type === 'hour')?.value);
}

export function isQuietHours(iso: string): boolean {
  const h = parisHour(iso);
  return h >= QUIET_START_HOUR || h < QUIET_END_HOUR;
}

/** Une notification part maintenant, ou attend la fin des heures calmes. */
export function shouldSendNow(kind: string, nowIso: string): boolean {
  return CRITICAL_KINDS.includes(kind) || !isQuietHours(nowIso);
}

export type PushNotification = {
  id: string;
  kind: string;
  payload: { title?: string; body?: string; jobsite_id?: string; proof_slot_id?: string };
};

/** Lien ouvert au toucher : la caméra sur la bonne consigne pour une demande de reprise. */
export function deepLink(n: PushNotification): string {
  if (n.kind === 'photo_request' && n.payload.jobsite_id) {
    const slot = n.payload.proof_slot_id ? `?slot=${n.payload.proof_slot_id}` : '';
    return `preuvio://jobsite/${n.payload.jobsite_id}/camera${slot}`;
  }
  return n.payload.jobsite_id ? `preuvio://jobsite/${n.payload.jobsite_id}` : 'preuvio://';
}

/** Messages pour l'API push d'Expo (un par appareil du destinataire). */
export function expoMessages(n: PushNotification, tokens: readonly string[]) {
  return tokens.map((to) => ({
    to,
    title: n.payload.title ?? 'Preuvio',
    body: n.payload.body ?? '',
    sound: 'default' as const,
    priority: 'high' as const,
    data: { url: deepLink(n), notificationId: n.id },
  }));
}
