// Généré depuis packages/shared/src/telemetry/index.ts : ne pas modifier à la main.
// Suivi en production (section 17, S19) : événements PostHog (hébergé dans l'UE) et erreurs
// Sentry, envoyés par simple appel HTTP depuis l'appli, le web et les Edge Functions. Aucun
// SDK natif : pas de nouveau build mobile, et rien n'est envoyé si la clé est absente.
// Fichier recopié pour les Edge Functions (voir ai/deno-copy.ts) : aucun import.

/** Événements nommés de la section 17, plus les mesures de performance et d'envoi de l'appli. */
export const EVENTS = [
  'app_open',
  'jobsite_started',
  'photo_taken',
  'ai_verdict',
  'slot_completed',
  'jobsite_completed',
  'export_created',
  'pv_signed',
  'perf_metric',
  'upload_run',
] as const;
export type EventName = (typeof EVENTS)[number];

export const POSTHOG_HOST = 'https://eu.i.posthog.com';

/** Propriétés envoyées : jamais de nom, d'adresse, de téléphone ni de texte libre. */
export type EventProps = Record<string, string | number | boolean | null>;
export type TrackedEvent = {
  event: EventName;
  distinctId: string;
  properties?: EventProps;
  timestamp?: string;
};

const FORBIDDEN = /(name|nom|address|adresse|phone|tel|email|caption|transcript|text|message)/i;

/** Propriétés sans donnée personnelle : les clés suspectes sont retirées. */
export function safeProps(props: EventProps = {}): EventProps {
  return Object.fromEntries(Object.entries(props).filter(([k]) => !FORBIDDEN.test(k)));
}

/** Corps de l'appel « batch » de PostHog ; sans enregistrement de profil de personne. */
export function posthogBatch(apiKey: string, events: readonly TrackedEvent[]) {
  return {
    api_key: apiKey,
    batch: events.map((e) => ({
      event: e.event,
      distinct_id: e.distinctId,
      timestamp: e.timestamp ?? new Date().toISOString(),
      properties: { ...safeProps(e.properties), $process_person_profile: false },
    })),
  };
}

/** Envoi au mieux : une panne de PostHog ne doit jamais gêner l'utilisateur. */
export async function sendEvents(
  apiKey: string | null | undefined,
  events: readonly TrackedEvent[],
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!apiKey || events.length === 0) return false;
  try {
    const res = await fetcher(`${POSTHOG_HOST}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(posthogBatch(apiKey, events)),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Sentry ----------------------------------------------------------------------------------

export type SentryDsn = { endpoint: string; publicKey: string };

/** DSN « https://clé@hôte/projet » → adresse d'envoi des enveloppes et clé publique. */
export function parseDsn(dsn: string | null | undefined): SentryDsn | null {
  const m = /^(https?):\/\/([^@/]+)@([^/]+)\/(\d+)$/.exec((dsn ?? '').trim());
  if (!m) return null;
  return { endpoint: `${m[1]}://${m[3]}/api/${m[4]}/envelope/`, publicKey: m[2]! };
}

export type ErrorReport = {
  message: string;
  stack?: string | null;
  platform: 'javascript' | 'node';
  release?: string | null;
  environment?: string | null;
  tags?: Record<string, string>;
  userId?: string | null;
};

const hex32 = () =>
  Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

/** Enveloppe Sentry (en-tête, en-tête d'élément, événement) pour une erreur. */
export function sentryEnvelope(report: ErrorReport, now = new Date()): string {
  const eventId = hex32();
  const lines = (report.stack ?? '').split('\n').slice(0, 30);
  const event = {
    event_id: eventId,
    timestamp: now.getTime() / 1000,
    platform: report.platform,
    level: 'error',
    release: report.release ?? undefined,
    environment: report.environment ?? 'production',
    tags: report.tags,
    user: report.userId ? { id: report.userId } : undefined,
    exception: {
      values: [
        {
          type: report.message.split(':')[0]?.slice(0, 80) || 'Error',
          value: report.message.slice(0, 500),
          stacktrace:
            lines.length > 1
              ? { frames: lines.reverse().map((l) => ({ function: l.trim() })) }
              : undefined,
        },
      ],
    },
  };
  return [
    JSON.stringify({ event_id: eventId, sent_at: now.toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');
}

export async function reportError(
  dsnString: string | null | undefined,
  report: ErrorReport,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const dsn = parseDsn(dsnString);
  if (!dsn) return false;
  try {
    const res = await fetcher(dsn.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${dsn.publicKey}, sentry_client=preuvio/1.0`,
      },
      body: sentryEnvelope(report),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// --- Santé du service ----------------------------------------------------------------------

/** Retard maximal toléré de la file d'analyse IA (section 17 : alerte au-delà de 5 minutes). */
export const QUEUE_LAG_ALERT_S = 300;

export type QueueHealth = Record<string, { waiting: number; oldest_s: number | null }>;

/** État global : « degraded » dès que l'analyse IA prend plus de 5 minutes de retard. */
export function healthStatus(queues: QueueHealth): { ok: boolean; alerts: string[] } {
  const alerts = Object.entries(queues)
    .filter(([name, q]) => name === 'photo_analysis' && (q.oldest_s ?? 0) > QUEUE_LAG_ALERT_S)
    .map(([name, q]) => `${name} : ${Math.round((q.oldest_s ?? 0) / 60)} min de retard`);
  return { ok: alerts.length === 0, alerts };
}
