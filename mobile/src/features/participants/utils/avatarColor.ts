const opaqueHexColorPattern = /^#[0-9a-f]{6}$/i;

export function normalizeOpaqueHexColor(value: string) {
  const normalizedValue = value.trim();

  return opaqueHexColorPattern.test(normalizedValue)
    ? normalizedValue.toLocaleLowerCase()
    : null;
}
