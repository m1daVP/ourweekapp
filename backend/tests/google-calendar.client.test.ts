import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };
const insert = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
const setCredentials = vi.hoisted(() => vi.fn());

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn(function OAuth2() {
        return { setCredentials };
      }),
    },
    calendar: vi.fn(() => ({ events: { insert, update, delete: remove } })),
  },
}));

const baseEnv = {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  PUBLIC_API_BASE_URL: 'http://localhost:3000/v1',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ACCESS_TOKEN_SECRET: 'access-token-secret-at-least-32-bytes',
  REFRESH_TOKEN_SECRET: 'refresh-token-secret-at-least-32-bytes',
  PASSWORD_RESET_TOKEN_SECRET: 'password-reset-secret-at-least-32-bytes',
  TOKEN_ENCRYPTION_KEY: 'token-encryption-key-at-least-32-byte',
  GOOGLE_OAUTH_CLIENT_ID: 'google-client-id',
  GOOGLE_OAUTH_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_OAUTH_REDIRECT_URL: 'https://api.example.com/v1/calendar/google/callback',
  SMTP_HOST: '',
  SMTP_PORT: '',
  SMTP_USER: '',
  SMTP_PASSWORD: '',
  EMAIL_FROM: '',
  INVITATION_HANDOFF_URL: '',
};

async function loadGoogleCalendarProvider() {
  vi.resetModules();
  process.env = { ...originalEnv, ...baseEnv };

  return import('../src/modules/calendar/google-oauth.client.js');
}

const tokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: null,
};

describe('googleCalendarProvider', () => {
  beforeEach(() => {
    insert.mockReset();
    update.mockReset();
    remove.mockReset();
    setCredentials.mockReset();
    insert.mockResolvedValue({ data: { id: 'google-event-1' } });
    update.mockResolvedValue({ data: { id: 'google-event-1' } });
    remove.mockResolvedValue({});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('creates a 15-minute weekly meeting in the supplied local time zone', async () => {
    const { googleCalendarProvider } = await loadGoogleCalendarProvider();

    await googleCalendarProvider.upsertEvent({
      tokens,
      event: {
        title: 'OurWeek weekly meeting',
        dateTime: '2026-08-31T12:25:00',
        timeZone: 'Europe/Warsaw',
        durationMinutes: 15,
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
      },
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      requestBody: expect.objectContaining({
        start: {
          dateTime: '2026-08-31T12:25:00',
          timeZone: 'Europe/Warsaw',
        },
        end: {
          dateTime: '2026-08-31T12:40:00',
          timeZone: 'Europe/Warsaw',
        },
      }),
    }));
  });

  it('carries a local 15-minute end into the following day', async () => {
    const { googleCalendarProvider } = await loadGoogleCalendarProvider();

    await googleCalendarProvider.upsertEvent({
      tokens,
      event: {
        title: 'OurWeek weekly meeting',
        dateTime: '2026-08-31T23:55:00',
        timeZone: 'Europe/Warsaw',
        durationMinutes: 15,
      },
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      requestBody: expect.objectContaining({
        end: {
          dateTime: '2026-09-01T00:10:00',
          timeZone: 'Europe/Warsaw',
        },
      }),
    }));
  });

  it('keeps the one-hour default for local timed events', async () => {
    const { googleCalendarProvider } = await loadGoogleCalendarProvider();

    await googleCalendarProvider.upsertEvent({
      tokens,
      event: {
        title: 'Meeting reminder',
        dateTime: '2026-08-31T12:25:00',
        timeZone: 'Europe/Warsaw',
      },
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      requestBody: expect.objectContaining({
        end: {
          dateTime: '2026-08-31T13:25:00',
          timeZone: 'Europe/Warsaw',
        },
      }),
    }));
  });

  it('keeps elapsed-time arithmetic for offset-bearing timestamps', async () => {
    const { googleCalendarProvider } = await loadGoogleCalendarProvider();

    await googleCalendarProvider.upsertEvent({
      tokens,
      event: {
        title: 'Meeting reminder',
        dateTime: '2026-08-31T12:25:00.000Z',
      },
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      requestBody: expect.objectContaining({
        end: {
          dateTime: '2026-08-31T13:25:00.000Z',
          timeZone: undefined,
        },
      }),
    }));
  });

  it('updates an existing event with the corrected request body', async () => {
    const { googleCalendarProvider } = await loadGoogleCalendarProvider();

    await googleCalendarProvider.upsertEvent({
      tokens,
      providerEventId: 'google-event-existing',
      event: {
        title: 'OurWeek weekly meeting',
        dateTime: '2026-08-31T12:25:00',
        timeZone: 'Europe/Warsaw',
        durationMinutes: 15,
      },
    });

    expect(insert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'google-event-existing',
      requestBody: expect.objectContaining({
        end: {
          dateTime: '2026-08-31T12:40:00',
          timeZone: 'Europe/Warsaw',
        },
      }),
    }));
  });

  it('keeps untimed events as all-day calendar events', async () => {
    const { googleCalendarProvider } = await loadGoogleCalendarProvider();

    await googleCalendarProvider.upsertEvent({
      tokens,
      event: { title: 'Task', date: '2026-08-31' },
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      requestBody: expect.objectContaining({
        start: { date: '2026-08-31' },
        end: { date: '2026-09-01' },
      }),
    }));
  });

  it('deletes a mapped event from the connected user primary calendar', async () => {
    const { googleCalendarProvider } = await loadGoogleCalendarProvider();

    await googleCalendarProvider.deleteEvent({
      tokens,
      providerEventId: 'google-event-1',
    });

    expect(remove).toHaveBeenCalledWith({
      calendarId: 'primary',
      eventId: 'google-event-1',
    });
  });

  it('treats a Google 404 event deletion as successful cleanup', async () => {
    remove.mockRejectedValueOnce({ code: 404 });
    const { googleCalendarProvider } = await loadGoogleCalendarProvider();

    await expect(googleCalendarProvider.deleteEvent({
      tokens,
      providerEventId: 'already-gone',
    })).resolves.toBeUndefined();
  });
});
