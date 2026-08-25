import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { CalendarService as CalendarServiceInstance } from '../src/modules/calendar/calendar.service.js';
import type {
  CalendarConnectionRecord,
  CalendarEventDto,
  CalendarSourceType,
  UpsertCalendarConnectionInput,
  UpsertCalendarEventInput,
} from '../src/modules/calendar/calendar.repository.js';
import type { CalendarPreferencesDto } from '../src/modules/calendar/calendar.schema.js';
import type {
  GoogleCalendarProvider,
  GoogleCalendarTokens,
} from '../src/modules/calendar/google-oauth.client.js';
import type { MeetingDto } from '../src/modules/meetings/meetings.repository.js';
import type { AgreementDto, TaskDto } from '../src/modules/tasks/tasks.repository.js';
import type { AuthContext } from '../src/shared/auth/index.js';

const now = new Date('2026-06-07T10:00:00.000Z');
const workspaceId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const otherUserId = '66666666-6666-4666-8666-666666666666';
const meetingId = '44444444-4444-4444-8444-444444444444';
const taskId = '55555555-5555-4555-8555-555555555555';
const followUpId = '77777777-7777-4777-8777-777777777777';
const tokenSecret = 'test-token-encryption-key-32-bytes-minimum';

let CalendarService: typeof import('../src/modules/calendar/calendar.service.js').CalendarService;

beforeAll(async () => {
  process.env.PUBLIC_API_BASE_URL ??= 'http://localhost:3000/v1';
  process.env.SUPABASE_URL ??= 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'service-role-key';
  process.env.ACCESS_TOKEN_SECRET ??= 'access-token-secret-with-at-least-32-bytes';
  process.env.REFRESH_TOKEN_SECRET ??= 'refresh-token-secret-with-at-least-32-bytes';
  process.env.PASSWORD_RESET_TOKEN_SECRET ??= 'password-reset-token-secret-with-32-bytes';
  process.env.TOKEN_ENCRYPTION_KEY ??= tokenSecret;
  process.env.CORS_ALLOWED_ORIGINS ??= 'https://app.weeklyus.test';

  ({ CalendarService } = await import('../src/modules/calendar/calendar.service.js'));
});

const auth: AuthContext = {
  userId,
  sessionId: '11111111-1111-4111-8111-111111111111',
  workspaceId,
  role: 'adult_member',
  planType: 'premium',
};

function meeting(overrides: Partial<MeetingDto> = {}): MeetingDto {
  return {
    id: meetingId,
    workspaceId,
    templateId: 'weekly-family-check-in',
    title: 'Weekly check-in',
    status: 'completed',
    participantIds: [],
    sections: [],
    currentSectionIndex: 0,
    aiSummary: null,
    serverRevision: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    completedAt: now.toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

function task(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: taskId,
    workspaceId,
    title: 'Book appointment',
    description: null,
    responsibilityType: 'shared',
    responsibleParticipantIds: [],
    responsibleUserIds: [userId],
    dueDate: '2026-06-10',
    status: 'open',
    sourceMeetingId: meetingId,
    serverRevision: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

function agreement(overrides: Partial<AgreementDto> = {}): AgreementDto {
  return {
    id: followUpId,
    workspaceId,
    title: 'Check in next week',
    description: null,
    participantIds: [],
    relatedTaskIds: [],
    sourceMeetingId: meetingId,
    serverRevision: 1,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

class FakeCalendarRepository {
  public connection: CalendarConnectionRecord | null = null;
  public events = new Map<string, CalendarEventDto>();
  public connectionUpserts: UpsertCalendarConnectionInput[] = [];
  public eventUpserts: UpsertCalendarEventInput[] = [];
  public disconnects: Array<{ workspaceId: string; userId: string; disconnectedAt: string }> = [];
  public preferences: CalendarPreferencesDto | null = {
    weeklyMeetingSyncEnabled: false,
    assignedTaskSyncEnabled: true,
    weeklyMeetingDay: 'sunday',
    weeklyMeetingTime: '18:00',
    timeZone: 'UTC',
  };
  public clearedMappings: Array<{ workspaceId: string; userId: string }> = [];

  async findConnectionForUser(_workspaceId: string, _userId: string) {
    return this.connection;
  }

  async findPublicConnectionForUser(_workspaceId: string, _userId: string) {
    return this.connection;
  }

  async upsertConnection(input: UpsertCalendarConnectionInput) {
    this.connectionUpserts.push(input);
    this.connection = {
      id: 'connection-1',
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: 'google',
      connectedAccountEmail: input.connectedAccountEmail ?? null,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      state: input.state,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      disconnectedAt: input.state === 'disconnected' ? now.toISOString() : null,
      accessTokenEncrypted: input.accessTokenEncrypted ?? null,
      refreshTokenEncrypted: input.refreshTokenEncrypted ?? null,
    };

    return this.connection;
  }

  async disconnectConnection(workspaceId: string, userId: string, disconnectedAt: string) {
    this.disconnects.push({ workspaceId, userId, disconnectedAt });
    this.connection = {
      id: 'connection-1',
      workspaceId,
      userId,
      provider: 'google',
      connectedAccountEmail: null,
      tokenExpiresAt: null,
      state: 'disconnected',
      createdAt: now.toISOString(),
      updatedAt: disconnectedAt,
      disconnectedAt,
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
    };

    return this.connection;
  }

  async findPreferencesForUser(_workspaceId: string, _userId: string) {
    return this.preferences;
  }

  async upsertPreferences(input: {
    workspaceId: string;
    userId: string;
    preferences: CalendarPreferencesDto;
  }) {
    this.preferences = input.preferences;
    return input.preferences;
  }

  async clearEventMappingsForUser(workspaceId: string, userId: string) {
    this.clearedMappings.push({ workspaceId, userId });
  }

  async findEventBySource(
    _workspaceId: string,
    userIdValue: string,
    sourceType: CalendarSourceType,
    sourceId: string,
  ) {
    return this.events.get(`${userIdValue}:${sourceType}:${sourceId}`) ?? null;
  }

  async upsertEvent(input: UpsertCalendarEventInput) {
    this.eventUpserts.push(input);
    const event: CalendarEventDto = {
      id: `${input.userId}-${input.sourceType}-${input.sourceId}`,
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: 'google',
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      providerEventId: input.providerEventId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    this.events.set(`${input.userId}:${input.sourceType}:${input.sourceId}`, event);

    return event;
  }
}

class FakeGoogleProvider implements GoogleCalendarProvider {
  public configured = true;
  public exchangedTokens: GoogleCalendarTokens = {
    accessToken: 'access-token-plain',
    refreshToken: 'refresh-token-plain',
    expiresAt: '2026-06-07T11:00:00.000Z',
  };
  public exchangeError: unknown;
  public upsertEvent = vi.fn().mockResolvedValue({ providerEventId: 'google-event-new' });
  public revoke = vi.fn().mockResolvedValue(undefined);

  buildAuthorizationUrl(state: string) {
    return `https://accounts.google.test/oauth?state=${encodeURIComponent(state)}`;
  }

  async exchangeCode(_code: string) {
    if (this.exchangeError) {
      throw this.exchangeError;
    }

    return {
      tokens: this.exchangedTokens,
      connectedAccountEmail: 'adult@example.com',
    };
  }
}

function createHarness(input: {
  googleConfigured?: boolean;
  meeting?: MeetingDto | null;
  task?: TaskDto | null;
  agreement?: AgreementDto | null;
} = {}) {
  const calendarRepository = new FakeCalendarRepository();
  const meetingsRepository = {
    findMeetingByIdForWorkspace: vi.fn().mockResolvedValue(
      input.meeting === undefined ? meeting() : input.meeting,
    ),
  };
  const tasksRepository = {
    findTaskByIdForWorkspace: vi.fn().mockResolvedValue(
      input.task === undefined ? task() : input.task,
    ),
    findAgreementByIdForWorkspace: vi.fn().mockResolvedValue(
      input.agreement === undefined ? agreement() : input.agreement,
    ),
  };
  const provider = new FakeGoogleProvider();
  const service = new CalendarService(
    calendarRepository,
    meetingsRepository,
    tasksRepository,
    provider,
    {
      googleOAuthConfigured: input.googleConfigured ?? true,
      tokenEncryptionKey: tokenSecret,
      allowedRedirectOrigins: ['https://app.weeklyus.test'],
    },
  );

  return { calendarRepository, meetingsRepository, tasksRepository, provider, service };
}

async function authorizationState(
  service: CalendarServiceInstance,
  redirectUrl = 'weeklyus://calendar-connected',
  issuedAt = now,
) {
  const connect = await service.connectGoogle(auth, { redirectUrl }, issuedAt);
  const authorizationUrl = new URL(connect.authorizationUrl ?? '');
  const state = authorizationUrl.searchParams.get('state');

  expect(state).toBeTruthy();

  return state ?? '';
}

async function connectThroughCallback(service: CalendarServiceInstance) {
  const state = await authorizationState(service);

  return service.handleGoogleCallback({ code: 'oauth-code', state }, now);
}

describe('CalendarService', () => {
  it('returns setup_required when Google OAuth is not configured', async () => {
    const { service } = createHarness({ googleConfigured: false });

    await expect(service.getGoogleStatus(auth, now)).resolves.toMatchObject({
      state: 'setup_required',
      connected: false,
    });
    await expect(
      service.syncTaskDueDate(auth, { taskId, title: 'Book appointment', dueDate: '2026-06-10' }, now),
    ).resolves.toMatchObject({
      synced: false,
      skippedReason: 'setup-required',
    });
  });

  it('builds an authorization URL while consent is incomplete', async () => {
    const { service } = createHarness();

    const response = await service.connectGoogle(
      auth,
      { redirectUrl: 'weeklyus://calendar-connected' },
      now,
    );

    expect(response).toMatchObject({
      state: 'setup_required',
      connected: false,
    });
    expect(response.authorizationUrl).toContain('state=');
  });

  it('allows configured web redirect origins and rejects arbitrary https redirect URLs', async () => {
    const { service } = createHarness();

    await expect(
      service.connectGoogle(auth, { redirectUrl: 'https://app.weeklyus.test/calendar/done' }, now),
    ).resolves.toMatchObject({ state: 'setup_required' });
    await expect(
      service.connectGoogle(auth, { redirectUrl: 'https://evil.example/callback' }, now),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'invalid_calendar_redirect_url',
    });
  });

  it('encrypts tokens during OAuth callback and marks the connection as connected', async () => {
    const { calendarRepository, service } = createHarness();

    const redirectUrl = await connectThroughCallback(service);

    expect(redirectUrl).toBe('weeklyus://calendar-connected?calendar=connected');
    expect(calendarRepository.connection).toMatchObject({
      state: 'connected',
      connectedAccountEmail: 'adult@example.com',
    });
    expect(calendarRepository.connection?.accessTokenEncrypted).toBeTruthy();
    expect(calendarRepository.connection?.refreshTokenEncrypted).toBeTruthy();
    expect(calendarRepository.connection?.accessTokenEncrypted).not.toContain('access-token-plain');
    expect(calendarRepository.connection?.refreshTokenEncrypted).not.toContain('refresh-token-plain');
  });

  it('rejects invalid, tampered, and expired OAuth state', async () => {
    const { service } = createHarness();
    const validState = await authorizationState(service);
    const tamperedState = `${validState.slice(0, -1)}x`;
    const expiredState = await authorizationState(
      service,
      'weeklyus://calendar-connected',
      new Date(now.getTime() - 11 * 60 * 1000),
    );

    await expect(
      service.handleGoogleCallback({ code: 'oauth-code', state: 'invalid' }, now),
    ).rejects.toMatchObject({ code: 'invalid_oauth_state' });
    await expect(
      service.handleGoogleCallback({ code: 'oauth-code', state: tamperedState }, now),
    ).rejects.toMatchObject({ code: 'invalid_oauth_state' });
    await expect(
      service.handleGoogleCallback({ code: 'oauth-code', state: expiredState }, now),
    ).rejects.toMatchObject({ code: 'invalid_oauth_state' });
  });

  it('stores setup_required when callback exchange fails', async () => {
    const { calendarRepository, provider, service } = createHarness();
    provider.exchangeError = new Error('bad code');
    const state = await authorizationState(service);

    const redirectUrl = await service.handleGoogleCallback({ code: 'oauth-code', state }, now);

    expect(redirectUrl).toContain('calendar=setup_required');
    expect(redirectUrl).toContain('reason=token_exchange_failed');
    expect(calendarRepository.connectionUpserts[0]).toMatchObject({
      workspaceId,
      userId,
      state: 'setup_required',
    });
  });

  it('stores setup_required when callback does not include a refresh token', async () => {
    const { calendarRepository, provider, service } = createHarness();
    provider.exchangedTokens = {
      accessToken: 'access-token-plain',
      refreshToken: null,
      expiresAt: '2026-06-07T11:00:00.000Z',
    };

    const redirectUrl = await connectThroughCallback(service);

    expect(redirectUrl).toContain('calendar=setup_required');
    expect(redirectUrl).toContain('reason=missing_refresh_token');
    expect(calendarRepository.connection?.state).toBe('setup_required');
  });

  it('disconnects locally even when provider revocation fails', async () => {
    const { calendarRepository, provider, service } = createHarness();
    await connectThroughCallback(service);
    provider.revoke.mockRejectedValueOnce(new Error('revocation failed'));

    const status = await service.disconnectGoogle(auth, now);

    expect(status).toMatchObject({ state: 'disconnected', connected: false });
    expect(provider.revoke).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: 'access-token-plain',
      refreshToken: 'refresh-token-plain',
    }));
    expect(calendarRepository.disconnects[0]).toMatchObject({ workspaceId, userId });
    expect(calendarRepository.connection).toMatchObject({
      state: 'disconnected',
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
    });
  });

  it('creates a Google event and stores the provider event ID for the connected user', async () => {
    const { calendarRepository, provider, service } = createHarness();
    await connectThroughCallback(service);

    const result = await service.syncMeetingReminder(
      auth,
      {
        meetingId,
        title: 'Weekly check-in',
        startsAt: '2026-06-08T18:00:00.000Z',
      },
      now,
    );

    expect(result).toMatchObject({
      synced: true,
      providerEventId: 'google-event-new',
    });
    expect(provider.upsertEvent).toHaveBeenCalledWith(expect.objectContaining({
      providerEventId: undefined,
      tokens: expect.objectContaining({
        accessToken: 'access-token-plain',
        refreshToken: 'refresh-token-plain',
      }),
      event: {
        title: 'Weekly check-in',
        dateTime: '2026-06-08T18:00:00.000Z',
      },
    }));
    expect(calendarRepository.eventUpserts[0]).toMatchObject({
      workspaceId,
      userId,
      sourceType: 'meeting_reminder',
      sourceId: meetingId,
      providerEventId: 'google-event-new',
    });
  });

  it('isolates stored event IDs by connected user', async () => {
    const { calendarRepository, provider, service } = createHarness();
    await connectThroughCallback(service);
    await calendarRepository.upsertEvent({
      workspaceId,
      userId: otherUserId,
      sourceType: 'task_due_date',
      sourceId: taskId,
      providerEventId: 'other-user-event',
    });

    await service.syncTaskDueDate(
      auth,
      { taskId, title: 'Book appointment', dueDate: '2026-06-10' },
      now,
    );

    expect(provider.upsertEvent).toHaveBeenCalledWith(expect.objectContaining({
      providerEventId: undefined,
    }));
    expect(calendarRepository.eventUpserts.at(-1)).toMatchObject({
      userId,
      providerEventId: 'google-event-new',
    });
  });

  it('updates existing Google events using stored provider event IDs for the same user', async () => {
    const { calendarRepository, provider, service } = createHarness();
    await connectThroughCallback(service);
    await calendarRepository.upsertEvent({
      workspaceId,
      userId,
      sourceType: 'task_due_date',
      sourceId: taskId,
      providerEventId: 'google-event-existing',
    });
    provider.upsertEvent.mockResolvedValueOnce({ providerEventId: 'google-event-existing' });

    await service.syncTaskDueDate(
      auth,
      { taskId, title: 'Book appointment', dueDate: '2026-06-10' },
      now,
    );

    expect(provider.upsertEvent).toHaveBeenCalledWith(expect.objectContaining({
      providerEventId: 'google-event-existing',
      event: { title: 'Book appointment', date: '2026-06-10' },
    }));
  });

  it('does not persist an event when Google provider sync fails', async () => {
    const { calendarRepository, provider, service } = createHarness();
    await connectThroughCallback(service);
    provider.upsertEvent.mockRejectedValueOnce(new Error('provider unavailable'));

    const result = await service.syncTaskDueDate(
      auth,
      { taskId, title: 'Book appointment', dueDate: '2026-06-10' },
      now,
    );

    expect(result).toMatchObject({
      synced: false,
      skippedReason: 'provider-error',
    });
    expect(calendarRepository.eventUpserts).toEqual([]);
  });

  it('checks workspace ownership before syncing meeting reminders', async () => {
    const { provider, service } = createHarness({ meeting: null });

    await expect(
      service.syncMeetingReminder(
        auth,
        {
          meetingId,
          title: 'Weekly check-in',
          startsAt: '2026-06-08T18:00:00.000Z',
        },
        now,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'meeting_not_found',
    });
    expect(provider.upsertEvent).not.toHaveBeenCalled();
  });

  it('requires the follow-up agreement to exist and match the source meeting before provider sync', async () => {
    const missing = createHarness({ agreement: null });
    await expect(
      missing.service.syncFollowUpDate(
        auth,
        { followUpId, sourceMeetingId: meetingId, title: 'Follow up', followUpDate: '2026-06-14' },
        now,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'follow_up_not_found',
    });
    expect(missing.provider.upsertEvent).not.toHaveBeenCalled();

    const mismatch = createHarness({
      agreement: agreement({ sourceMeetingId: '88888888-8888-4888-8888-888888888888' }),
    });
    await expect(
      mismatch.service.syncFollowUpDate(
        auth,
        { followUpId, sourceMeetingId: meetingId, title: 'Follow up', followUpDate: '2026-06-14' },
        now,
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'follow_up_not_found',
    });
    expect(mismatch.provider.upsertEvent).not.toHaveBeenCalled();
  });

  it('skips sync when no calendar date is present', async () => {
    const { tasksRepository, provider, service } = createHarness();

    await expect(
      service.syncTaskDueDate(auth, { taskId, title: 'Book appointment' }, now),
    ).resolves.toMatchObject({
      synced: false,
      skippedReason: 'missing-calendar-date',
    });
    expect(tasksRepository.findTaskByIdForWorkspace).not.toHaveBeenCalled();
    expect(provider.upsertEvent).not.toHaveBeenCalled();
  });
});
