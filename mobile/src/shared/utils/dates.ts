export function nowIso() {
  return new Date().toISOString();
}

export function toDateTime(value: Date | number | string | null | undefined) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function compareIsoDesc(first: string, second: string) {
  return toDateTime(second) - toDateTime(first);
}

export function latestIso(
  first: string | null | undefined,
  second: string | null | undefined
) {
  if (!first) {
    return second ?? null;
  }

  if (!second) {
    return first;
  }

  return toDateTime(second) > toDateTime(first) ? second : first;
}
