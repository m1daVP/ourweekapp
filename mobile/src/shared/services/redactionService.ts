const sensitiveKeyPattern =
  /(authorization|access[_-]?token|refresh[_-]?token|token|password|receipt|purchase[_-]?token|prompt|private[_-]?notes?|notes?|summary|title|description|text|content|email)/i;

export const redactedValue = '[redacted]';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveValue);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactedValue,
    };
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      sensitiveKeyPattern.test(key)
        ? redactedValue
        : redactSensitiveValue(entry),
    ])
  );
}

export function createRedactedJson(value: unknown) {
  return JSON.stringify(redactSensitiveValue(value), null, 2);
}
