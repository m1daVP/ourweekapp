import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { env } from '../../config/env.js';
import { requireMinimumRole, type AuthContext } from '../../shared/auth/index.js';
import { ApiError } from '../../shared/errors/index.js';
import { MeetingsRepository } from '../meetings/meetings.repository.js';
import { TasksRepository, type TaskDto as TaskRepositoryDto } from '../tasks/tasks.repository.js';
import {
  CalendarRepository,
  type CalendarConnectionRecord,
  type CalendarEventDto,
  type CalendarSourceType,
} from './calendar.repository.js';
import type {
  CalendarConnectRequestDto,
  CalendarConnectionStatusDto,
  CalendarPreferencesDto,
  CalendarFollowUpDateRequestDto,
  CalendarGoogleCallbackQueryDto,
  CalendarMeetingReminderRequestDto,
  CalendarSyncResultDto,
  CalendarTaskDueDateRequestDto,
  UpdateCalendarPreferencesDto,
} from './calendar.schema.js';
import type {
  GoogleCalendarEventInput,
  GoogleCalendarProvider,
  GoogleCalendarTokens,
} from './google-oauth.client.js';

const STATE_TTL_MS = 10 * 60 * 1000;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

type CalendarRepositoryPort = Pick<
  CalendarRepository,
  | 'findConnectionForUser'
  | 'findPublicConnectionForUser'
  | 'upsertConnection'
  | 'disconnectConnection'
  | 'findPreferencesForUser'
  | 'upsertPreferences'
  | 'clearEventMappingsForUser'
  | 'findEventBySource'
  | 'upsertEvent'
>;

type MeetingsRepositoryPort = Pick<MeetingsRepository, 'findMeetingByIdForWorkspace'>;
type TasksRepositoryPort = Pick<
  TasksRepository,
  'findTaskByIdForWorkspace' | 'findAgreementByIdForWorkspace'
>;

type OAuthStatePayload = {
  workspaceId: string;
  userId: string;
  redirectUrl: string;
  expiresAt: number;
};

type CalendarServiceOptions = {
  googleOAuthConfigured?: boolean;
  tokenEncryptionKey?: string;
  allowedRedirectOrigins?: string[];
  allowedRedirectSchemes?: string[];
};

const defaultPreferences: CalendarPreferencesDto = {
  weeklyMeetingSyncEnabled: false,
  assignedTaskSyncEnabled: false,
  weeklyMeetingDay: 'sunday',
  weeklyMeetingTime: '18:00',
  timeZone: 'UTC',
};
const WEEKLY_MEETING_DURATION_MINUTES = 15;

const googleWeekday: Record<CalendarPreferencesDto['weeklyMeetingDay'], string> = {
  sunday: 'SU',
  monday: 'MO',
  tuesday: 'TU',
  wednesday: 'WE',
  thursday: 'TH',
  friday: 'FR',
  saturday: 'SA',
};

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function stateSigningKey(secret: string) {
  return createHash('sha256').update(`calendar-state:${secret}`).digest();
}

function encryptionKey(secret: string) {
  return createHash('sha256').update(`calendar-token:${secret}`).digest();
}

function signState(encodedPayload: string, secret: string) {
  return createHmac('sha256', stateSigningKey(secret))
    .update(encodedPayload)
    .digest('base64url');
}

function appendQuery(url: string, params: Record<string, string>) {
  const parsed = new URL(url);

  for (const [key, value] of Object.entries(params)) {
    parsed.searchParams.set(key, value);
  }

  return parsed.toString();
}

function sameSignature(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual, 'base64url');
  const expectedBuffer = Buffer.from(expected, 'base64url');

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function redirectOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function missingDateResult(attemptedAt: string): CalendarSyncResultDto {
  return {
    provider: 'google',
    synced: false,
    attemptedAt,
    skippedReason: 'missing-calendar-date',
    message: 'No calendar date was provided for this item.',
  };
}

function nextWeeklyOccurrence(preferences: CalendarPreferencesDto, now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: preferences.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const currentDate = `${values.year}-${values.month}-${values.day}`;
  const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    .indexOf(preferences.weeklyMeetingDay);
  const currentDay = new Date(`${currentDate}T00:00:00.000Z`).getUTCDay();
  const targetDate = new Date(`${currentDate}T00:00:00.000Z`);
  targetDate.setUTCDate(targetDate.getUTCDate() + ((targetDay - currentDay + 7) % 7));

  return `${targetDate.toISOString().slice(0, 10)}T${preferences.weeklyMeetingTime}:00`;
}

function setupRequiredStatus(
  message: string,
  now: Date,
  preferences: CalendarPreferencesDto,
  authorizationUrl?: string,
): CalendarConnectionStatusDto {
  return {
    provider: 'google',
    state: 'setup_required',
    connected: false,
    connectedAccountEmail: null,
    lastCheckedAt: now.toISOString(),
    message,
    preferences,
    ...(authorizationUrl ? { authorizationUrl } : {}),
  };
}

function disconnectedStatus(now: Date, preferences: CalendarPreferencesDto): CalendarConnectionStatusDto {
  return {
    provider: 'google',
    state: 'disconnected',
    connected: false,
    connectedAccountEmail: null,
    lastCheckedAt: now.toISOString(),
    message: 'Google Calendar is not connected.',
    preferences,
  };
}

function connectedStatus(
  connection: CalendarConnectionRecord,
  now: Date,
  preferences: CalendarPreferencesDto,
): CalendarConnectionStatusDto {
  return {
    provider: 'google',
    state: 'connected',
    connected: true,
    connectedAccountEmail: connection.connectedAccountEmail,
    lastCheckedAt: now.toISOString(),
    message: 'Google Calendar is connected.',
    preferences,
  };
}

export class CalendarService {
  constructor(
    private readonly calendarRepository: CalendarRepositoryPort,
    private readonly meetingsRepository: MeetingsRepositoryPort,
    private readonly tasksRepository: TasksRepositoryPort,
    private readonly googleProvider: GoogleCalendarProvider,
    private readonly options: CalendarServiceOptions = {},
  ) {}

  async getGoogleStatus(auth: AuthContext, now = new Date()) {
    requireMinimumRole(auth, 'adult_member');
    const preferences = await this.getPreferences(auth);

    if (!this.googleOAuthConfigured()) {
      return setupRequiredStatus(
        'Google Calendar setup is not configured yet.',
        now,
        preferences,
      );
    }

    const connection = await this.calendarRepository.findConnectionForUser(
      auth.workspaceId,
      auth.userId,
    );

    if (!connection) {
      return disconnectedStatus(now, preferences);
    }

    if (this.connectionReady(connection)) {
      return connectedStatus(connection, now, preferences);
    }

    return setupRequiredStatus(
      'Google Calendar consent is incomplete. Please reconnect Google Calendar.',
      now,
      preferences,
    );
  }

  async connectGoogle(
    auth: AuthContext,
    request: CalendarConnectRequestDto,
    now = new Date(),
  ) {
    requireMinimumRole(auth, 'adult_member');
    const preferences = await this.getPreferences(auth);

    if (!this.googleOAuthConfigured()) {
      return setupRequiredStatus(
        'Google Calendar setup is not configured yet.',
        now,
        preferences,
      );
    }

    this.assertAllowedRedirectUrl(request.redirectUrl);

    const state = this.encodeOAuthState({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      redirectUrl: request.redirectUrl,
      expiresAt: now.getTime() + STATE_TTL_MS,
    });

    return setupRequiredStatus(
      'Google Calendar authorization is required.',
      now,
      preferences,
      this.googleProvider.buildAuthorizationUrl(state),
    );
  }

  async handleGoogleCallback(
    query: CalendarGoogleCallbackQueryDto,
    now = new Date(),
  ) {
    const state = this.decodeOAuthState(query.state, now);

    if (!this.googleOAuthConfigured()) {
      return appendQuery(state.redirectUrl, {
        calendar: 'setup_required',
        reason: 'oauth_not_configured',
      });
    }

    if (query.error || !query.code) {
      await this.calendarRepository.upsertConnection({
        workspaceId: state.workspaceId,
        userId: state.userId,
        state: 'setup_required',
      });

      return appendQuery(state.redirectUrl, {
        calendar: 'setup_required',
        reason: query.error ?? 'missing_code',
      });
    }

    let exchanged;

    try {
      exchanged = await this.googleProvider.exchangeCode(query.code);
    } catch {
      await this.calendarRepository.upsertConnection({
        workspaceId: state.workspaceId,
        userId: state.userId,
        state: 'setup_required',
      });

      return appendQuery(state.redirectUrl, {
        calendar: 'setup_required',
        reason: 'token_exchange_failed',
      });
    }

    const hasRefreshToken = Boolean(exchanged.tokens.refreshToken);

    await this.calendarRepository.upsertConnection({
      workspaceId: state.workspaceId,
      userId: state.userId,
      connectedAccountEmail: exchanged.connectedAccountEmail,
      accessTokenEncrypted: this.encryptNullable(exchanged.tokens.accessToken),
      refreshTokenEncrypted: this.encryptNullable(exchanged.tokens.refreshToken),
      tokenExpiresAt: exchanged.tokens.expiresAt,
      state: hasRefreshToken ? 'connected' : 'setup_required',
    });

    return appendQuery(state.redirectUrl, {
      calendar: hasRefreshToken ? 'connected' : 'setup_required',
      ...(hasRefreshToken ? {} : { reason: 'missing_refresh_token' }),
    });
  }

  async disconnectGoogle(auth: AuthContext, now = new Date()) {
    requireMinimumRole(auth, 'adult_member');

    const connection = await this.calendarRepository.findConnectionForUser(
      auth.workspaceId,
      auth.userId,
    );

    if (connection) {
      try {
        await this.googleProvider.revoke(this.decryptConnectionTokens(connection));
      } catch {
        // Local disconnect must still remove stored tokens even if provider revocation fails.
      }

      await this.calendarRepository.disconnectConnection(
        auth.workspaceId,
        auth.userId,
        now.toISOString(),
      );
      await this.calendarRepository.clearEventMappingsForUser(
        auth.workspaceId,
        auth.userId,
      );
    }

    return disconnectedStatus(now, await this.getPreferences(auth));
  }

  async updateGoogleSettings(
    auth: AuthContext,
    input: UpdateCalendarPreferencesDto,
    now = new Date(),
  ) {
    requireMinimumRole(auth, 'adult_member');
    const current = await this.getPreferences(auth);
    const scheduleChanged = input.weeklyMeetingDay !== undefined;
    const preferences: CalendarPreferencesDto = {
      ...current,
      ...input,
      ...(scheduleChanged ? {
        weeklyMeetingDay: input.weeklyMeetingDay!,
        weeklyMeetingTime: input.weeklyMeetingTime!,
        timeZone: input.timeZone!,
      } : {}),
      lastSyncErrorCode: undefined,
      lastSyncAttemptedAt: undefined,
    };

    await this.calendarRepository.upsertPreferences({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      preferences,
    });

    if (preferences.weeklyMeetingSyncEnabled) {
      await this.syncWeeklyMeetingForUser(auth, now);
    }

    return this.getGoogleStatus(auth, now);
  }

  async syncWeeklyMeetingForUser(
    auth: AuthContext,
    now = new Date(),
  ): Promise<CalendarSyncResultDto> {
    requireMinimumRole(auth, 'adult_member');
    const preferences = await this.getPreferences(auth);

    if (!preferences.weeklyMeetingSyncEnabled) {
      return {
        provider: 'google' as const,
        synced: false,
        attemptedAt: now.toISOString(),
        skippedReason: 'not-connected' as const,
        message: 'Weekly meeting sync is turned off.',
      };
    }

    return this.syncEvent(auth, {
      sourceType: 'weekly_meeting',
      sourceId: 'personal-weekly-meeting',
      event: {
        title: 'OurWeek weekly meeting',
        dateTime: nextWeeklyOccurrence(preferences, now),
        timeZone: preferences.timeZone,
        durationMinutes: WEEKLY_MEETING_DURATION_MINUTES,
        recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${googleWeekday[preferences.weeklyMeetingDay]}`],
      },
      now,
    });
  }

  async syncMeetingReminder(
    auth: AuthContext,
    request: CalendarMeetingReminderRequestDto,
    now = new Date(),
  ) {
    requireMinimumRole(auth, 'adult_member');

    if (!request.startsAt) {
      return missingDateResult(now.toISOString());
    }

    const meeting = await this.meetingsRepository.findMeetingByIdForWorkspace(
      auth.workspaceId,
      request.meetingId,
    );

    if (!meeting) {
      throw new ApiError(404, 'meeting_not_found', 'Meeting not found.');
    }

    return this.syncEvent(auth, {
      sourceType: 'meeting_reminder',
      sourceId: request.meetingId,
      event: { title: request.title, dateTime: request.startsAt },
      now,
    });
  }

  async syncTaskDueDate(
    auth: AuthContext,
    request: CalendarTaskDueDateRequestDto,
    now = new Date(),
  ): Promise<CalendarSyncResultDto> {
    requireMinimumRole(auth, 'adult_member');

    if (!request.dueDate) {
      return missingDateResult(now.toISOString());
    }

    const task = await this.tasksRepository.findTaskByIdForWorkspace(
      auth.workspaceId,
      request.taskId,
    );

    if (!task) {
      throw new ApiError(404, 'task_not_found', 'Task not found.');
    }

    if (task.responsibleUserIds && !task.responsibleUserIds.includes(auth.userId)) {
      throw new ApiError(404, 'task_not_found', 'Task not found.');
    }

    return this.syncAssignedTaskForUser({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      task,
    }, now);
  }

  async syncAssignedTaskForUser(
    input: {
      workspaceId: string;
      userId: string;
      task: Pick<TaskRepositoryDto, 'id' | 'title' | 'dueDate' | 'status' | 'deletedAt'>;
    },
    now = new Date(),
  ): Promise<CalendarSyncResultDto> {
    const task = input.task;
    const preferences = await this.calendarRepository.findPreferencesForUser(
      input.workspaceId,
      input.userId,
    );

    if (!preferences?.assignedTaskSyncEnabled || task.status !== 'open' || task.deletedAt || !task.dueDate) {
      return {
        provider: 'google',
        synced: false,
        attemptedAt: now.toISOString(),
        skippedReason: !task.dueDate ? 'missing-calendar-date' : 'not-connected',
        message: !task.dueDate
          ? 'No calendar date was provided for this item.'
          : 'Task calendar sync is turned off.',
      };
    }

    return this.syncEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
    } as AuthContext, {
      sourceType: 'task_due_date',
      sourceId: task.id,
      event: { title: task.title, date: task.dueDate },
      now,
    });
  }

  async syncFollowUpDate(
    auth: AuthContext,
    request: CalendarFollowUpDateRequestDto,
    now = new Date(),
  ) {
    requireMinimumRole(auth, 'adult_member');

    if (!request.followUpDate) {
      return missingDateResult(now.toISOString());
    }

    const [sourceMeeting, agreement] = await Promise.all([
      this.meetingsRepository.findMeetingByIdForWorkspace(
        auth.workspaceId,
        request.sourceMeetingId,
      ),
      this.tasksRepository.findAgreementByIdForWorkspace(
        auth.workspaceId,
        request.followUpId,
      ),
    ]);

    if (!sourceMeeting || !agreement || agreement.sourceMeetingId !== request.sourceMeetingId) {
      throw new ApiError(404, 'follow_up_not_found', 'Follow-up not found.');
    }

    return this.syncEvent(auth, {
      sourceType: 'follow_up_date',
      sourceId: request.followUpId,
      event: { title: request.title, date: request.followUpDate },
      now,
    });
  }

  private async syncEvent(
    auth: AuthContext,
    input: {
      sourceType: CalendarSourceType;
      sourceId: string;
      event: GoogleCalendarEventInput;
      now: Date;
    },
  ): Promise<CalendarSyncResultDto> {
    const attemptedAt = input.now.toISOString();

    if (!this.googleOAuthConfigured()) {
      return {
        provider: 'google',
        synced: false,
        attemptedAt,
        skippedReason: 'setup-required',
        message: 'Google Calendar setup is not configured yet.',
      };
    }

    const connection = await this.calendarRepository.findConnectionForUser(
      auth.workspaceId,
      auth.userId,
    );

    if (!connection) {
      return {
        provider: 'google',
        synced: false,
        attemptedAt,
        skippedReason: 'not-connected',
        message: 'Connect Google Calendar before syncing reminders.',
      };
    }

    if (!this.connectionReady(connection)) {
      return {
        provider: 'google',
        synced: false,
        attemptedAt,
        skippedReason: 'setup-required',
        message: 'Google Calendar consent is incomplete. Please reconnect Google Calendar.',
      };
    }

    const existingEvent = await this.calendarRepository.findEventBySource(
      auth.workspaceId,
      auth.userId,
      input.sourceType,
      input.sourceId,
    );

    let providerEventId: string;

    try {
      const result = await this.googleProvider.upsertEvent({
        tokens: this.decryptConnectionTokens(connection),
        providerEventId: existingEvent?.providerEventId,
        event: input.event,
      });
      providerEventId = result.providerEventId;
    } catch {
      return {
        provider: 'google',
        synced: false,
        attemptedAt,
        skippedReason: 'provider-error',
        message: 'Google Calendar is not available right now.',
      };
    }

    const savedEvent: CalendarEventDto = await this.calendarRepository.upsertEvent({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      providerEventId,
    });

    return {
      provider: 'google',
      synced: true,
      attemptedAt,
      message: existingEvent
        ? 'Google Calendar event was updated.'
        : 'Google Calendar event was created.',
      providerEventId: savedEvent.providerEventId,
    };
  }

  private async getPreferences(auth: AuthContext) {
    return (await this.calendarRepository.findPreferencesForUser(
      auth.workspaceId,
      auth.userId,
    )) ?? defaultPreferences;
  }

  private googleOAuthConfigured() {
    return this.options.googleOAuthConfigured ?? this.googleProvider.configured;
  }

  private tokenSecret() {
    return this.options.tokenEncryptionKey ?? env.TOKEN_ENCRYPTION_KEY;
  }

  private allowedRedirectOrigins() {
    const configured = [
      redirectOrigin(env.PUBLIC_API_BASE_URL),
      ...env.CORS_ALLOWED_ORIGINS.map(redirectOrigin),
    ].filter((origin): origin is string => Boolean(origin));

    return new Set([...(this.options.allowedRedirectOrigins ?? []), ...configured]);
  }

  private allowedRedirectSchemes() {
    return new Set(this.options.allowedRedirectSchemes ?? ['weeklyus:']);
  }

  private assertAllowedRedirectUrl(redirectUrl: string) {
    let parsed: URL;

    try {
      parsed = new URL(redirectUrl);
    } catch {
      throw new ApiError(422, 'invalid_calendar_redirect_url', 'Calendar redirect URL is not allowed.');
    }

    if (this.allowedRedirectSchemes().has(parsed.protocol)) {
      return;
    }

    if ((parsed.protocol === 'https:' || parsed.protocol === 'http:') && this.allowedRedirectOrigins().has(parsed.origin)) {
      return;
    }

    throw new ApiError(422, 'invalid_calendar_redirect_url', 'Calendar redirect URL is not allowed.');
  }

  private connectionReady(connection: CalendarConnectionRecord) {
    return (
      connection.state === 'connected' &&
      Boolean(connection.accessTokenEncrypted) &&
      Boolean(connection.refreshTokenEncrypted)
    );
  }

  private encodeOAuthState(payload: OAuthStatePayload) {
    const encodedPayload = base64Url(JSON.stringify(payload));
    const signature = signState(encodedPayload, this.tokenSecret());

    return `${encodedPayload}.${signature}`;
  }

  private decodeOAuthState(state: string, now: Date): OAuthStatePayload {
    const [encodedPayload, signature, extra] = state.split('.');

    if (!encodedPayload || !signature || extra) {
      throw new ApiError(422, 'invalid_oauth_state', 'Invalid OAuth state.');
    }

    const expectedSignature = signState(encodedPayload, this.tokenSecret());

    if (!sameSignature(signature, expectedSignature)) {
      throw new ApiError(422, 'invalid_oauth_state', 'Invalid OAuth state.');
    }

    let payload: OAuthStatePayload;

    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as OAuthStatePayload;
    } catch {
      throw new ApiError(422, 'invalid_oauth_state', 'Invalid OAuth state.');
    }

    if (
      typeof payload.workspaceId !== 'string' ||
      typeof payload.userId !== 'string' ||
      typeof payload.redirectUrl !== 'string' ||
      typeof payload.expiresAt !== 'number' ||
      payload.expiresAt < now.getTime()
    ) {
      throw new ApiError(422, 'invalid_oauth_state', 'Invalid OAuth state.');
    }

    return payload;
  }

  private encryptNullable(value: string | null) {
    if (!value) {
      return null;
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv(
      ENCRYPTION_ALGORITHM,
      encryptionKey(this.tokenSecret()),
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      'v1',
      iv.toString('base64url'),
      tag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join(':');
  }

  private decryptNullable(value: string | null) {
    if (!value) {
      return null;
    }

    const [version, encodedIv, encodedTag, encodedEncrypted, extra] = value.split(':');

    if (
      version !== 'v1' ||
      !encodedIv ||
      !encodedTag ||
      !encodedEncrypted ||
      extra
    ) {
      throw new ApiError(500, 'calendar_token_decrypt_failed', 'Unable to use stored calendar tokens.');
    }

    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      encryptionKey(this.tokenSecret()),
      Buffer.from(encodedIv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));

    try {
      return Buffer.concat([
        decipher.update(Buffer.from(encodedEncrypted, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ApiError(500, 'calendar_token_decrypt_failed', 'Unable to use stored calendar tokens.');
    }
  }

  private decryptConnectionTokens(connection: CalendarConnectionRecord): GoogleCalendarTokens {
    return {
      accessToken: this.decryptNullable(connection.accessTokenEncrypted),
      refreshToken: this.decryptNullable(connection.refreshTokenEncrypted),
      expiresAt: connection.tokenExpiresAt,
    };
  }
}

export function createDefaultCalendarService(
  supabase: ConstructorParameters<typeof CalendarRepository>[0],
  provider: GoogleCalendarProvider,
  options: CalendarServiceOptions = {},
) {
  return new CalendarService(
    new CalendarRepository(supabase),
    new MeetingsRepository(supabase),
    new TasksRepository(supabase),
    provider,
    options,
  );
}



