export type CalendarCallbackResult =
  { status: 'connected' } | { status: 'failed'; messageKey: string };

type CalendarCallbackQuery = Record<string, unknown>;

export function parseCalendarCallbackQuery(
  query: CalendarCallbackQuery
): CalendarCallbackResult | null {
  if (query.calendar === 'connected') {
    return { status: 'connected' };
  }

  if (query.calendar !== 'setup_required') {
    return null;
  }

  return {
    status: 'failed',
    messageKey:
      query.reason === 'missing_refresh_token'
        ? 'calendar.callback.missingRefreshToken'
        : 'calendar.callback.failed',
  };
}
