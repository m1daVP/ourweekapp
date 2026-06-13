const sensitiveKeyPattern =
  /(authorization|accessToken|refreshToken|token|password|receipt|purchaseToken|prompt|notes|privateNotes|meeting|task|agreement|summary|title|description|text|content)/i;

function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      sensitiveKeyPattern.test(key)
        ? '[redacted]'
        : redactSensitiveValue(entry),
    ])
  );
}

function redactLogEntry(entry: unknown): unknown {
  if (entry instanceof Error) {
    return {
      name: entry.name,
      message: entry.message,
    };
  }

  return redactSensitiveValue(entry);
}

export function warnSafely(message: string, ...details: unknown[]) {
  if (!import.meta.env.DEV) {
    return;
  }

  console.warn(message, ...details.map(redactLogEntry));
}
