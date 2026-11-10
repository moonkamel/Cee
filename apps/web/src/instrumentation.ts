import { reportError } from '@preuvio/shared';

// Erreurs serveur du tableau de bord vers Sentry (section 17), sans SDK : rien sans DSN.
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routeType: string },
) {
  const e = error as { message?: string; stack?: string; digest?: string };
  await reportError(process.env.NEXT_PUBLIC_SENTRY_DSN, {
    message: String(e?.message ?? error),
    stack: e?.stack ?? null,
    platform: 'node',
    environment: process.env.VERCEL_ENV ?? 'local',
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    // Le chemin seul : jamais les paramètres (jetons des liens client).
    tags: {
      app: 'web',
      route: request.path.split('?')[0]!.replace(/\/c\/[^/]+/, '/c/…'),
      type: context.routeType,
    },
  });
}
