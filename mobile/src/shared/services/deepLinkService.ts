export interface DeepLinkRoute {
  path: string;
  query: Record<string, string>;
}

export function resolveDeepLinkRoute(url: string): DeepLinkRoute | null {
  try {
    const parsedUrl = new URL(url);
    const callbackTarget =
      parsedUrl.host || parsedUrl.pathname.replace(/^\/+/, '');

    if (parsedUrl.protocol !== 'weeklyus:') {
      return null;
    }

    if (callbackTarget === 'invite') {
      const token = parsedUrl.searchParams.get('token')?.trim();
      return token ? { path: '/invitations/accept', query: { token } } : null;
    }

    if (callbackTarget !== 'calendar-callback') {
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
