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

/** Ouverture à froid jusqu'à la caméra prête : mesurée une seule fois par lancement. */
export function cameraReady(): void {
  if (coldStartMeasured) return;
  coldStartMeasured = true;
  recordPerf('cold_start_to_camera', Date.now() - APP_START);
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

/** Erreurs non rattrapées vers Sentry, envoi des événements toutes les 30 s et en arrière-plan. */
export function startTelemetry(release: string | null = null): () => void {
  if (started) return () => undefined;
  started = true;
  const utils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  const previous = utils?.getGlobalHandler();
  utils?.setGlobalHandler((error, isFatal) => {
    const e = error as { message?: string; stack?: string } | null;
    void reportError(SENTRY_DSN, {
      message: String(e?.message ?? error),
      stack: e?.stack ?? null,
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
