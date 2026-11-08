// sentry.client.config.ts — Sentry SDK config CLIENT-SIDE
// Revolution X — configuração automática via @sentry/nextjs auto-instrumentation.
// NÃO é necessário importar este arquivo manualmente.
// O Next.js automaticamente o carrega via sentry.edge.config.ts

import * as Sentry from '@sentry/nextjs';

// Leitura das variáveis a partir do ambiente
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENV = process.env.NEXT_PUBLIC_SENTRY_ENV || process.env.NODE_ENV || 'development';
const SENTRY_RELEASE = process.env.NEXT_PUBLIC_SENTRY_RELEASE || `revolution-x-${Date.now()}`;

// Só inicializa se DSN estiver configurado
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENV,
    release: SENTRY_RELEASE,
    enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED !== 'false',

    // Tracing configuration
    tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE
      ? parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE)
      : SENTRY_ENV === 'production' ? 0.1 : 1.0,

    // Default integrations
    integrations: [
      new Sentry.BrowserTracing({
        tracingOrigins: ['localhost', '127.0.0.1', process.env.NEXT_PUBLIC_SITE_URL],
      }),
    ],

    // Before send hook — sanitize sensitive data
    beforeSend(event) {
      // Remove sensitive fields from event
      if (event.extra) {
        const redacted = { ...event.extra };
        const sensitiveKeys = ['password', 'token', 'secret', 'api_key', 'apiKey', 'key'];
        for (const key of Object.keys(redacted)) {
          if (sensitiveKeys.includes(key.toLowerCase())) {
            redacted[key] = '[REDACTED]';
          }
        }
        event.extra = redacted;
      }
      return event;
    },

    // Before breadcrumb — filter noisy logs
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
        return null;
      }
      return breadcrumb;
    },
  });
}

// Export types for usage in other files
export type SentryContext = {
  requestId?: string;
  userId?: string;
  organizationId?: string;
  [key: string]: unknown;
};