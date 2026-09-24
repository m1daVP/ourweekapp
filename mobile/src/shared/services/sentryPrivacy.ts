import type { App } from 'vue';
import * as Sentry from '@sentry/vue';
import type { ErrorEvent, Exception, StackFrame } from '@sentry/vue';

const genericErrorMessage = 'Unhandled application error';
const nativeExceptionTypes = new Set([
  'Error',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
]);

function sanitizeExceptionType(type: unknown) {
  return typeof type === 'string' && nativeExceptionTypes.has(type)
    ? type
    : 'Error';
}

function sanitizeFrames(frames: unknown) {
  if (!Array.isArray(frames)) {
    return undefined;
  }

  return frames?.map((frame) => ({
    colno:
      typeof (frame as StackFrame).colno === 'number'
        ? (frame as StackFrame).colno
        : undefined,
    in_app:
      typeof (frame as StackFrame).in_app === 'boolean'
        ? (frame as StackFrame).in_app
        : undefined,
    lineno:
      typeof (frame as StackFrame).lineno === 'number'
        ? (frame as StackFrame).lineno
        : undefined,
  }));
}

function sanitizeExceptions(values: unknown) {
  if (!Array.isArray(values)) {
    return undefined;
  }

  return values?.map((exception) => ({
    type: sanitizeExceptionType((exception as Exception).type),
    value: genericErrorMessage,
    stacktrace: (exception as Exception).stacktrace
      ? { frames: sanitizeFrames((exception as Exception).stacktrace?.frames) }
      : undefined,
  }));
}

function sanitizeTags(tags: ErrorEvent['tags']) {
  const sanitized: Record<string, string> = {};

  if (tags?.feature === 'auth') {
    sanitized.feature = 'auth';
  }

  if (tags?.provider === 'google') {
    sanitized.provider = 'google';
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/**
 * Rebuilds error events from a small allowlist so unknown errors, extras,
 * request data, and user-generated content cannot reach Sentry.
 */
export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent {
  const exceptionValues = sanitizeExceptions(event.exception?.values);

  return {
    event_id: event.event_id,
    environment: event.environment,
    exception: exceptionValues ? { values: exceptionValues } : undefined,
    level: event.level,
    platform: event.platform,
    release: event.release,
    tags: sanitizeTags(event.tags),
    timestamp: event.timestamp,
    type: undefined,
    ...(exceptionValues ? {} : { message: genericErrorMessage }),
  };
}

export function initializeSentry(app: App, dsn: string | undefined) {
  const configuredDsn = dsn?.trim();

  if (!configuredDsn) {
    return false;
  }

  Sentry.init({
    app,
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
    dsn: configuredDsn,
    enhanceFetchErrorMessages: false,
    tracesSampleRate: 0,
  });

  return true;
}
