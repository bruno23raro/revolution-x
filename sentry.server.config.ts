// sentry.server.config.ts — Sentry SDK config SERVER-SIDE (Next.js Edge/RSC)
// Revolution X — configuração automática via @sentry/nextjs.

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENV = process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV || 'development';
const SENTRY_RELEASE = process.env.NEXT_PUBLIC_SENTRY_RELEASE || `revolution-x-${Date.now()}`;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENV,
    release: SENTRY_RELEASE,
    enabled: process.env.NODE_ENV !== 'test',

    // Tracing configuration for SSR
    tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
      ? parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE)
      : SENTRY_ENV === 'production' ? 0.1 : 1.0,

    // Debug mode
    debug: process.env.NEXT_PUBLIC_SENTRY_DEBUG === 'true',

    // Integrations
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express(),
    ],

    // Before send hook
    beforeSend(event) {
      // Sanitize request data
      if (event.request?.data) {
        const redacted = { ...event.request.data };
        const sensitive = ['password', 'token', 'secret', 'api_key', 'apiKey'];
        for (const key of sensitive) {
          if (redacted[key]) redacted[key] = '[REDACTED]';
        }
        event.request.data = redacted;
      }
      return event;
    },

    // Ignore noisy breadcrumbs
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'SCRIPT_PROCESS_ONLOAD_ERROR',
    ],
  });
}