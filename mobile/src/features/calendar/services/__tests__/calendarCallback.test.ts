import { describe, expect, it } from 'vitest';
import { parseCalendarCallbackQuery } from '@/features/calendar/services/calendarCallback';

describe('parseCalendarCallbackQuery', () => {
  it('recognizes a connected callback', () => {
    expect(parseCalendarCallbackQuery({ calendar: 'connected' })).toEqual({
      status: 'connected',
    });
  });

  it('uses specific guidance for a missing refresh token', () => {
    expect(
      parseCalendarCallbackQuery({
        calendar: 'setup_required',
        reason: 'missing_refresh_token',
      })
    ).toEqual({
      status: 'failed',
      messageKey: 'calendar.callback.missingRefreshToken',
    });
  });

  it.each(['access_denied', 'unexpected_reason'])(
    'uses the generic failure for %s',
    (reason) => {
      expect(
        parseCalendarCallbackQuery({ calendar: 'setup_required', reason })
      ).toEqual({
        status: 'failed',
        messageKey: 'calendar.callback.failed',
      });
    }
  );

  it.each([{}, { calendar: 'other' }])(
    'ignores unrelated query values',
    (query) => {
      expect(parseCalendarCallbackQuery(query)).toBeNull();
    }
  );
});
