import { describe, expect, it } from 'vitest';
import { resolveDeepLinkRoute } from '@/shared/services/deepLinkService';

describe('resolveDeepLinkRoute', () => {
  it('maps a connected calendar callback', () => {
    expect(
      resolveDeepLinkRoute('weeklyus://calendar-callback?calendar=connected')
    ).toEqual({
      path: '/settings/calendar-sync',
      query: { calendar: 'connected' },
    });
  });

  it('preserves setup status and reason', () => {
    expect(
      resolveDeepLinkRoute(
        'weeklyus://calendar-callback?calendar=setup_required&reason=access_denied'
      )
    ).toEqual({
      path: '/settings/calendar-sync',
      query: { calendar: 'setup_required', reason: 'access_denied' },
    });
  });

  it('accepts the slash-path callback variant', () => {
    expect(
      resolveDeepLinkRoute('weeklyus:///calendar-callback?calendar=connected')
    ).toEqual({
      path: '/settings/calendar-sync',
      query: { calendar: 'connected' },
    });
  });

  it('drops unrelated query parameters', () => {
    expect(
      resolveDeepLinkRoute(
        'weeklyus://calendar-callback?calendar=connected&token=secret'
      )
    ).toEqual({
      path: '/settings/calendar-sync',
      query: { calendar: 'connected' },
    });
  });

  it.each([
    'https://calendar-callback?calendar=connected',
    'weeklyus://other-callback?calendar=connected',
    'not a url',
  ])('rejects unsupported URLs: %s', (url) => {
    expect(resolveDeepLinkRoute(url)).toBeNull();
  });
});
