function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPrivateMarkedObject(value: unknown) {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.private === true ||
    value.isPrivate === true ||
    value.visibility === 'private' ||
    value.type === 'private'
  );
}
