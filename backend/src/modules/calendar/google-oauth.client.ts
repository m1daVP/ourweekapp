import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';

import { env } from '../../config/env.js';

const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];
const DEFAULT_TIMED_EVENT_DURATION_MINUTES = 60;
const OFFSET_BEARING_DATE_TIME = /(Z|[+-]\d{2}:\d{2})$/i;

export type GoogleCalendarTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
};

export type GoogleCalendarEventInput = {
  title: string;
  date?: string;
  dateTime?: string;
  timeZone?: string;
  durationMinutes?: number;
  recurrence?: string[];
};

export type GoogleCalendarProvider = {
  configured: boolean;
  buildAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<{
    tokens: GoogleCalendarTokens;
    connectedAccountEmail: string | null;
  }>;
  upsertEvent(input: {
    tokens: GoogleCalendarTokens;
    providerEventId?: string;
    event: GoogleCalendarEventInput;
  }): Promise<{ providerEventId: string }>;
  deleteEvent(input: {
    tokens: GoogleCalendarTokens;
    providerEventId: string;
  }): Promise<void>;
  revoke(tokens: GoogleCalendarTokens): Promise<void>;
};

function createOAuthClient() {
  return new google.auth.OAuth2(
    env.GOOGLE_OAUTH_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET,
    env.GOOGLE_OAUTH_REDIRECT_URI,
  );
}

function toTokens(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}): GoogleCalendarTokens {
  return {
    accessToken: tokens.access_token ?? null,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : null,
  };
}

function addMinutes(value: string, minutes: number) {
  if (OFFSET_BEARING_DATE_TIME.test(value)) {
    return new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString();
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);

  if (!match) {
    throw new Error('Invalid local calendar date-time.');
  }

  const [, year, month, day, hour, minute, second = '00'] = match;
  const date = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ));
  date.setUTCMinutes(date.getUTCMinutes() + minutes);

  const datePart = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
  const timePart = [
    String(date.getUTCHours()).padStart(2, '0'),
    String(date.getUTCMinutes()).padStart(2, '0'),
    String(date.getUTCSeconds()).padStart(2, '0'),
  ].join(':');

  return `${datePart}T${timePart}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function toGoogleEvent(event: GoogleCalendarEventInput): calendar_v3.Schema$Event {
  if (event.dateTime) {
    const durationMinutes =
      event.durationMinutes ?? DEFAULT_TIMED_EVENT_DURATION_MINUTES;

    return {
      summary: event.title,
      start: { dateTime: event.dateTime, timeZone: event.timeZone },
      end: {
        dateTime: addMinutes(event.dateTime, durationMinutes),
        timeZone: event.timeZone,
      },
      ...(event.recurrence ? { recurrence: event.recurrence } : {}),
    };
  }

  return {
    summary: event.title,
    start: { date: event.date },
    end: { date: event.date ? addDays(event.date, 1) : undefined },
  };
}

export const googleCalendarProvider: GoogleCalendarProvider = {
  configured: env.GOOGLE_OAUTH_CONFIGURED,

  buildAuthorizationUrl(state: string) {
    return createOAuthClient().generateAuthUrl({
      access_type: 'offline',
      include_granted_scopes: true,
      prompt: 'consent',
      scope: GOOGLE_CALENDAR_SCOPES,
      state,
    });
  },

  async exchangeCode(code: string) {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();

    return {
      tokens: toTokens(tokens),
      connectedAccountEmail: data.email ?? null,
    };
  },

  async upsertEvent(input) {
    const client = createOAuthClient();
    client.setCredentials({
      access_token: input.tokens.accessToken ?? undefined,
      refresh_token: input.tokens.refreshToken ?? undefined,
      expiry_date: input.tokens.expiresAt
        ? new Date(input.tokens.expiresAt).getTime()
        : undefined,
    });

    const calendar = google.calendar({ version: 'v3', auth: client });
    const request = {
      calendarId: 'primary',
      requestBody: toGoogleEvent(input.event),
    };

    const response = input.providerEventId
      ? await calendar.events.update({
          ...request,
          eventId: input.providerEventId,
        })
      : await calendar.events.insert(request);

    if (!response.data.id) {
      throw new Error('Google Calendar did not return an event ID.');
    }

    return { providerEventId: response.data.id };
  },

  async deleteEvent(input) {
    const client = createOAuthClient();
    client.setCredentials({
      access_token: input.tokens.accessToken ?? undefined,
      refresh_token: input.tokens.refreshToken ?? undefined,
      expiry_date: input.tokens.expiresAt
        ? new Date(input.tokens.expiresAt).getTime()
        : undefined,
    });

    const calendar = google.calendar({ version: 'v3', auth: client });

    try {
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: input.providerEventId,
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 404
      ) {
        return;
      }

      throw error;
    }
  },

  async revoke(tokens) {
    const token = tokens.refreshToken ?? tokens.accessToken;

    if (!token) {
      return;
    }

    await createOAuthClient().revokeToken(token);
  },
};

