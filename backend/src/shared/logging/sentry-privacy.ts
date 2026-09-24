import type { ErrorEvent, Exception, StackFrame } from "@sentry/node";

const genericErrorMessage = "Unhandled application error";
const nativeExceptionTypes = new Set([
  "Error",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
]);

function sanitizeExceptionType(type: unknown) {
  return typeof type === "string" && nativeExceptionTypes.has(type)
    ? type
    : "Error";
}

function sanitizeFrames(frames: unknown) {
  if (!Array.isArray(frames)) {
    return undefined;
  }

  return frames?.map((frame) => ({
    colno:
      typeof (frame as StackFrame).colno === "number"
        ? (frame as StackFrame).colno
        : undefined,
    in_app:
      typeof (frame as StackFrame).in_app === "boolean"
        ? (frame as StackFrame).in_app
        : undefined,
    lineno:
      typeof (frame as StackFrame).lineno === "number"
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

function sanitizeTags(tags: ErrorEvent["tags"]) {
  const sanitized: Record<string, string> = {};

  if (
    tags?.["http.method"] &&
    /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(
      String(tags["http.method"]),
    )
  ) {
    sanitized["http.method"] = String(tags["http.method"]);
  }

  const route = tags?.["http.route"];
  if (
    typeof route === "string" &&
    /^\/(?:[a-z0-9-]+|:[a-z][a-z0-9_]*)?(?:\/(?:[a-z0-9-]+|:[a-z][a-z0-9_]*))*\/?$/i.test(
      route,
    )
  ) {
    sanitized["http.route"] = route;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

/**
 * Rebuilds error events from a small allowlist so unexpected provider objects,
 * request data, and error messages cannot reach Sentry.
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
