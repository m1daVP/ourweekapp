import * as Sentry from '@sentry/vue';
import { redactSensitiveValue } from '@/shared/services/redactionService';

export interface ErrorMonitoringContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export function captureHandledError(
  error: unknown,
  context: ErrorMonitoringContext = {}
) {
  Sentry.withScope((scope) => {
    Object.entries(context.tags ?? {}).forEach(([key, value]) => {
      scope.setTag(key, value);
    });

    Object.entries(context.extra ?? {}).forEach(([key, value]) => {
      scope.setExtra(key, redactSensitiveValue(value));
    });

    if (error instanceof Error) {
      Sentry.captureException(error);
      return;
    }

    Sentry.captureMessage('Handled non-Error exception', {
      level: 'error',
      extra: {
        value: redactSensitiveValue(error),
      },
    });
  });
}
