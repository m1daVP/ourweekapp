export function formatApiDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid API datetime value.');
  }

  return date.toISOString();
}

export function formatNullableApiDateTime(
  value: string | Date | null,
): string | null {
  return value === null ? null : formatApiDateTime(value);
}
