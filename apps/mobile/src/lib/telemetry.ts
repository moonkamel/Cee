// Suivi en production (section 17) : événements PostHog, erreurs Sentry et mesures de
// performance, par simples appels HTTP (packages/shared/telemetry). Sans clé, rien ne part ;
// les mesures restent lisibles sur l'écran « Mesures » (Moi).
import {
  type EventName,
  type EventProps,
  reportError,
  sendEvents,
  type TrackedEvent,
} from '@preuvio/shared';
import { AppState } from 'react-native';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** Début du JavaScript de l'appli : référence de l'ouverture à froid. */
export const APP_START = Date.now();

let userId: string | null = null;
const queue: TrackedEvent[] = [];

export function setTelemetryUser(id: string | null): void {
  userId = id;
}

export function track(event: EventName, properties: EventProps = {}): void {
  queue.push({
    event,
    distinctId: userId ?? 'anonyme',
    properties: { ...properties, app: 'mobile' },
    timestamp: new Date().toISOString(),
  });
  if (queue.length >= 20) void flushEvents();
}

const once = new Set<string>();
/** Un seul événement par clé et par lancement (ex. chantier commencé). */
export function trackOnce(key: string, event: EventName, properties: EventProps = {}): void {
  if (once.has(key)) return;
  once.add(key);
  track(event, properties);
}

/** Envoi groupé ; hors réseau, les événements attendent (100 au plus). */
export async function flushEvents(): Promise<void> {
  if (!POSTHOG_KEY) {
    queue.length = 0;
    return;
  }
  const batch = queue.splice(0);
  if (batch.length && !(await sendEvents(POSTHOG_KEY, batch))) {
    queue.unshift(...batch.slice(-100));
  }
}

// --- Mesures de performance (cibles de la section 17) ------------------------------------------

export const PERF_TARGETS = {
  cold_start_to_camera: 2000,
  shutter_to_saved: 1000,
  local_check: 300,
} as const;
export type PerfMetric = keyof typeof PERF_TARGETS;
export type PerfSample = { metric: PerfMetric; ms: number; at: string };

const samples: PerfSample[] = [];
let coldStartMeasured = false;

export function recordPerf(metric: PerfMetric, ms: number): void {
  const value = Math.round(ms);
  samples.unshift({ metric, ms: value, at: new Date().toISOString() });
  samples.length = Math.min(samples.length, 60);
  track('perf_metric', { metric, ms: value, target_ms: PERF_TARGETS[metric] });
}

/** Durée écoulée depuis un instant (horodatage en millisecondes). */
export function recordPerfSince(metric: PerfMetric, since: number): void {
  recordPerf(metric, Date.now() - since);
}

let homeReadyMs: number | null = null;
let cameraMountAt: number | null = null;

/** Écran « Aujourd'hui » affiché avec ses chantiers : fin du démarrage à froid. */
export function homeReady(): void {
  if (homeReadyMs === null) homeReadyMs = Date.now() - APP_START;
}

/** L'écran caméra s'ouvre (le temps passé par le poseur avant n'est pas compté). */
export function cameraMounting(): void {
  cameraMountAt = Date.now();
}

/**
 * Ouverture à froid jusqu'à la caméra prête, une fois par lancement : démarrage jusqu'à
 * « Aujourd'hui », plus ouverture de la caméra jusqu'à l'image (hors temps de décision).
 */
export function cameraReady(): void {
  if (coldStartMeasured || homeReadyMs === null || cameraMountAt === null) return;
  coldStartMeasured = true;
  recordPerf('cold_start_to_camera', homeReadyMs + (Date.now() - cameraMountAt));
}

export function recentSamples(): readonly PerfSample[] {
  return samples;
}

/** Médiane et pire valeur par mesure, pour l'écran « Mesures ». */
export function perfSummary(list: readonly PerfSample[] = samples) {
  return (Object.keys(PERF_TARGETS) as PerfMetric[]).map((metric) => {
    const values = list
      .filter((s) => s.metric === metric)
      .map((s) => s.ms)
      .sort((a, b) => a - b);
    const median = values.length ? values[Math.floor((values.length - 1) / 2)]! : null;
    return {
      metric,
      target: PERF_TARGETS[metric],
      count: values.length,
      median,
      worst: values.length ? values[values.length - 1]! : null,
      ok: median === null ? null : median < PERF_TARGETS[metric],
    };
  });
}

// --- Erreurs --------------------------------------------------------------------------------

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = {
  getGlobalHandler(): GlobalHandler;
  setGlobalHandler(handler: GlobalHandler): void;
};

let started = false;
let release: string | null = null;

function errorReport(error: unknown) {
  const e = error as { message?: string; stack?: string } | null;
  return { message: String(e?.message ?? error), stack: e?.stack ?? null };
}

const reported = new Set<string>();
/**
 * Erreur rattrapée mais utile à connaître (micro, envoi d'un fichier…) : vers Sentry, une fois
 * par lieu et par message et par lancement, pour ne pas inonder le suivi.
 */
export function reportHandledError(error: unknown, where: string): void {
  const { message, stack } = errorReport(error);
  const key = `${where}:${message}`;
  if (__DEV__) console.warn(`[${where}]`, message);
  if (reported.has(key)) return;
  reported.add(key);
  void reportError(SENTRY_DSN, {
    message,
    stack,
    platform: 'javascript',
    release,
    userId,
    tags: { app: 'mobile', where, handled: 'true' },
  });
}

type RejectionTracker = {
  enablePromiseRejectionTracker?: (options: {
    allRejections: boolean;
    onUnhandled: (id: number, error: unknown) => void;
    onHandled: (id: number) => void;
  }) => void;
};

/** Promesses rejetées sans « catch » : Sentry ne les voit pas par ErrorUtils. */
function trackRejections(): void {
  const hermes = (globalThis as { HermesInternal?: RejectionTracker }).HermesInternal;
  hermes?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (id, error) => {
      const { message, stack } = errorReport(error);
      // En développement, l'alerte reste visible à l'écran.
      if (__DEV__) console.warn(`Promesse rejetée (id: ${id}) : ${message}`);
      void reportError(SENTRY_DSN, {
        message,
        stack,
        platform: 'javascript',
        release,
        userId,
        tags: { app: 'mobile', unhandled_rejection: 'true' },
      });
    },
    onHandled: () => undefined,
  });
}

/** Erreurs non rattrapées vers Sentry, envoi des événements toutes les 30 s et en arrière-plan. */
export function startTelemetry(appRelease: string | null = null): () => void {
  if (started) return () => undefined;
  started = true;
  release = appRelease;
  trackRejections();
  const utils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  const previous = utils?.getGlobalHandler();
  utils?.setGlobalHandler((error, isFatal) => {
    void reportError(SENTRY_DSN, {
      ...errorReport(error),
      platform: 'javascript',
      release,
      userId,
      tags: { app: 'mobile', fatal: String(Boolean(isFatal)) },
    });
    previous?.(error, isFatal);
  });
  const timer = setInterval(() => void flushEvents(), 30_000);
  const sub = AppState.addEventListener('change', (state) => {
    if (state !== 'active') void flushEvents();
  });
  track('app_open');
  return () => {
    clearInterval(timer);
    sub.remove();
    started = false;
  };
}
