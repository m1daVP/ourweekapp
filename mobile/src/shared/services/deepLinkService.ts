export interface DeepLinkRoute {
  path: string;
  query: Record<string, string>;
}

export function resolveDeepLinkRoute(url: string): DeepLinkRoute | null {
  try {
    const parsedUrl = new URL(url);
    const callbackTarget =
      parsedUrl.host || parsedUrl.pathname.replace(/^\/+/, '');

    if (
      parsedUrl.protocol !== 'weeklyus:' ||
      callbackTarget !== 'calendar-callback'
    ) {
      return null;
    }

    const query: Record<string, string> = {};

    for (const key of ['calendar', 'reason'] as const) {
      const value = parsedUrl.searchParams.get(key);

      if (value !== null) {
        query[key] = value;
      }
    }

    return { path: '/settings/calendar-sync', query };
  } catch {
    return null;
  }
}
