export function uniqueStrings(items: Array<string | undefined | null>) {
  return [
    ...new Set(
      items
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item))
    ),
  ];
}
