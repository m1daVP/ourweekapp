import * as Sentry from "@sentry/node";

import { env } from "./config/env.js";
import { sanitizeSentryEvent } from "./shared/logging/sentry-privacy.js";

// Error monitoring only. Events and breadcrumbs are reduced to an explicit
// diagnostic allowlist before delivery. When SENTRY_DSN is unset, Sentry is
// never initialized and all capture calls are safe no-ops.
if (env.SENTRY_DSN) {
  Sentry.init({
    beforeBreadcrumb: () => null,
    beforeSend: sanitizeSentryEvent,
    dataCollection: {
      cookies: false,
      databaseQueryData: false,
      frameContextLines: 0,
      genAI: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false },
      httpBodies: [],
      httpHeaders: { request: false, response: false },
      stackFrameVariables: false,
      urlQueryParams: false,
      userInfo: false,
    },
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    includeLocalVariables: false,
    tracesSampleRate: 0,
  });
}
