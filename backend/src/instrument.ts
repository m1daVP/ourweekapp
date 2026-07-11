import * as Sentry from '@sentry/node';

import { env } from './config/env.js';

// Error monitoring only: no performance tracing, no PII (mirrors the
// frontend's privacy-conscious Sentry setup). When SENTRY_DSN is unset,
// Sentry is never initialized and all capture calls are safe no-ops.
if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
}
