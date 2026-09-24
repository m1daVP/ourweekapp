import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPlatform: vi.fn(),
  isNativePlatform: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: mocks.getPlatform,
    isNativePlatform: mocks.isNativePlatform,
  },
}));

async function loadService() {
  vi.resetModules();
  return import('@/features/calendar/services/calendarService');
}

beforeEach(() => {
  mocks.getPlatform.mockReset();
  mocks.isNativePlatform.mockReset();
  mocks.getPlatform.mockReturnValue('web');
  mocks.isNativePlatform.mockReturnValue(false);
  vi.unstubAllGlobals();
});

describe('getCalendarRedirectUrl', () => {
  it('uses the app deep link on native platforms', async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    const { getCalendarRedirectUrl } = await loadService();

    expect(getCalendarRedirectUrl()).toBe('weeklyus://calendar-callback');
  });

  it('uses the calendar settings URL on the web', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://ourweek.test' } });
    const { getCalendarRedirectUrl } = await loadService();

    expect(getCalendarRedirectUrl()).toBe(
      'https://ourweek.test/settings/calendar-sync'
    );
  });

  it('returns an empty redirect without a browser window', async () => {
    const { getCalendarRedirectUrl } = await loadService();

    expect(getCalendarRedirectUrl()).toBe('');
  });
});
