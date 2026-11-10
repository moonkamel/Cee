'use client';

import { reportError } from '@preuvio/shared';
import { useEffect } from 'react';

/** Erreurs du navigateur vers Sentry (section 17) ; rien sans DSN. */
export function ErrorReporter() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (!dsn) return;
    const send = (message: string, stack?: string | null) =>
      void reportError(dsn, {
        message,
        stack,
        platform: 'javascript',
        tags: { app: 'web', page: window.location.pathname.replace(/\/c\/[^/]+/, '/c/…') },
      });
    const onError = (e: ErrorEvent) => send(e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) =>
      send(String(e.reason?.message ?? e.reason), e.reason?.stack);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
