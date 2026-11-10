import 'server-only';
import { type EventName, type EventProps, sendEvents } from '@preuvio/shared';

// Événements côté serveur (section 17) : identifiant pseudonyme, jamais de donnée personnelle.
export async function trackServer(
  event: EventName,
  distinctId: string,
  properties: EventProps = {},
): Promise<void> {
  await sendEvents(process.env.NEXT_PUBLIC_POSTHOG_KEY, [
    { event, distinctId, properties: { ...properties, app: 'web' } },
  ]);
}
