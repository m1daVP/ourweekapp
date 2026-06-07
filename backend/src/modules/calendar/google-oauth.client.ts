import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';

import { env } from '../../config/env.js';

const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
];

export type GoogleCalendarTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
};

export type GoogleCalendarEventInput = {
  title: string;
  date?: string;
  dateTime?: string;
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

function addHours(value: string, hours: number) {
  return new Date(new Date(value).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function toGoogleEvent(event: GoogleCalendarEventInput): calendar_v3.Schema$Event {
  if (event.dateTime) {
    return {
      summary: event.title,
      start: { dateTime: event.dateTime },
      end: { dateTime: addHours(event.dateTime, 1) },
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

  async revoke(tokens) {
    const token = tokens.refreshToken ?? tokens.accessToken;

    if (!token) {
      return;
    }

    await createOAuthClient().revokeToken(token);
  },
};

