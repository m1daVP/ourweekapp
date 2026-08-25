import { formatApiDateTime, formatNullableApiDateTime } from '../../shared/dates.js';
import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { requireRow, throwOnSupabaseError } from '../../shared/repositories/index.js';
import type { CalendarPreferencesDto } from './calendar.schema.js';

const CONNECTION_COLUMNS =
  'id,workspace_id,user_id,provider,connected_account_email,access_token_encrypted,refresh_token_encrypted,token_expires_at,state,created_at,updated_at,disconnected_at' as const;
const PUBLIC_CONNECTION_COLUMNS =
  'id,workspace_id,user_id,provider,connected_account_email,token_expires_at,state,created_at,updated_at,disconnected_at' as const;
const EVENT_COLUMNS =
  'id,workspace_id,user_id,provider,source_type,source_id,provider_event_id,created_at,updated_at' as const;
const PREFERENCE_COLUMNS =
  'workspace_id,user_id,provider,weekly_meeting_sync_enabled,assigned_task_sync_enabled,weekly_meeting_day,weekly_meeting_time,time_zone,last_sync_error_code,last_sync_attempted_at' as const;

type CalendarProvider = 'google';
type CalendarConnectionState = 'disconnected' | 'connected' | 'setup_required';
export type CalendarSourceType = 'meeting_reminder' | 'task_due_date' | 'follow_up_date' | 'weekly_meeting';

type CalendarConnectionRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  provider: CalendarProvider;
  connected_account_email: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  state: CalendarConnectionState;
  created_at: string;
  updated_at: string;
  disconnected_at: string | null;
};

type PublicCalendarConnectionRow = Omit<
  CalendarConnectionRow,
  'access_token_encrypted' | 'refresh_token_encrypted'
>;

type CalendarEventRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  provider: CalendarProvider;
  source_type: CalendarSourceType;
  source_id: string;
  provider_event_id: string;
  created_at: string;
  updated_at: string;
};

type CalendarPreferencesRow = {
  workspace_id: string;
  user_id: string;
  provider: CalendarProvider;
  weekly_meeting_sync_enabled: boolean;
  assigned_task_sync_enabled: boolean;
  weekly_meeting_day: CalendarPreferencesDto['weeklyMeetingDay'];
  weekly_meeting_time: string;
  time_zone: string;
  last_sync_error_code: 'provider-error' | null;
  last_sync_attempted_at: string | null;
};

export type CalendarConnectionDto = {
  id: string;
  workspaceId: string;
  userId: string;
  provider: CalendarProvider;
  connectedAccountEmail: string | null;
  tokenExpiresAt: string | null;
  state: CalendarConnectionState;
  createdAt: string;
  updatedAt: string;
  disconnectedAt: string | null;
};

export type CalendarConnectionRecord = CalendarConnectionDto & {
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
};

export type CalendarEventDto = {
  id: string;
  workspaceId: string;
  userId: string;
  provider: CalendarProvider;
  sourceType: CalendarSourceType;
  sourceId: string;
  providerEventId: string;
  createdAt: string;
  updatedAt: string;
};

export type UpsertCalendarConnectionInput = {
  workspaceId: string;
  userId: string;
  connectedAccountEmail?: string | null;
  accessTokenEncrypted?: string | null;
  refreshTokenEncrypted?: string | null;
  tokenExpiresAt?: string | null;
  state: CalendarConnectionState;
};

export type UpsertCalendarEventInput = {
  workspaceId: string;
  userId: string;
  sourceType: CalendarSourceType;
  sourceId: string;
  providerEventId: string;
};

export type UpsertCalendarPreferencesInput = {
  workspaceId: string;
  userId: string;
  preferences: CalendarPreferencesDto;
};

function mapCalendarPreferencesRowToDto(row: CalendarPreferencesRow): CalendarPreferencesDto {
  return {
    weeklyMeetingSyncEnabled: row.weekly_meeting_sync_enabled,
    assignedTaskSyncEnabled: row.assigned_task_sync_enabled,
    weeklyMeetingDay: row.weekly_meeting_day,
    weeklyMeetingTime: row.weekly_meeting_time.slice(0, 5),
    timeZone: row.time_zone,
    ...(row.last_sync_error_code ? { lastSyncErrorCode: row.last_sync_error_code } : {}),
    ...(row.last_sync_attempted_at ? { lastSyncAttemptedAt: formatApiDateTime(row.last_sync_attempted_at) } : {}),
  };
}

export function mapCalendarConnectionRowToDto(row: PublicCalendarConnectionRow): CalendarConnectionDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    provider: row.provider,
    connectedAccountEmail: row.connected_account_email,
    tokenExpiresAt: formatNullableApiDateTime(row.token_expires_at),
    state: row.state,
    createdAt: formatApiDateTime(row.created_at),
    updatedAt: formatApiDateTime(row.updated_at),
    disconnectedAt: formatNullableApiDateTime(row.disconnected_at),
  };
}

export function mapCalendarConnectionRowToRecord(row: CalendarConnectionRow): CalendarConnectionRecord {
  return {
    ...mapCalendarConnectionRowToDto(row),
    accessTokenEncrypted: row.access_token_encrypted,
    refreshTokenEncrypted: row.refresh_token_encrypted,
  };
}

export function mapCalendarEventRowToDto(row: CalendarEventRow): CalendarEventDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    provider: row.provider,
    sourceType: row.source_type,
    sourceId: row.source_id,
    providerEventId: row.provider_event_id,
    createdAt: formatApiDateTime(row.created_at),
    updatedAt: formatApiDateTime(row.updated_at),
  };
}

export class CalendarRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async findConnectionForUser(workspaceId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('calendar_connections')
      .select(CONNECTION_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle<CalendarConnectionRow>();

    throwOnSupabaseError(error, 'calendar_connection_lookup_failed', 'Unable to load calendar connection.');

    return data ? mapCalendarConnectionRowToRecord(data) : null;
  }

  async findPublicConnectionForUser(workspaceId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('calendar_connections')
      .select(PUBLIC_CONNECTION_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle<PublicCalendarConnectionRow>();

    throwOnSupabaseError(error, 'calendar_connection_lookup_failed', 'Unable to load calendar connection.');

    return data ? mapCalendarConnectionRowToDto(data) : null;
  }

  async upsertConnection(input: UpsertCalendarConnectionInput) {
    const { data, error } = await this.supabase
      .from('calendar_connections')
      .upsert(
        {
          workspace_id: input.workspaceId,
          user_id: input.userId,
          provider: 'google',
          connected_account_email: input.connectedAccountEmail ?? null,
          access_token_encrypted: input.accessTokenEncrypted ?? null,
          refresh_token_encrypted: input.refreshTokenEncrypted ?? null,
          token_expires_at: input.tokenExpiresAt ?? null,
          state: input.state,
          disconnected_at: input.state === 'disconnected' ? new Date().toISOString() : null,
        },
        { onConflict: 'workspace_id,user_id,provider' },
      )
      .select(CONNECTION_COLUMNS)
      .single<CalendarConnectionRow>();

    return mapCalendarConnectionRowToRecord(
      requireRow(data, error, 'calendar_connection_upsert_failed', 'Unable to save calendar connection.'),
    );
  }

  async disconnectConnection(workspaceId: string, userId: string, disconnectedAt: string) {
    const { data, error } = await this.supabase
      .from('calendar_connections')
      .update({
        access_token_encrypted: null,
        refresh_token_encrypted: null,
        token_expires_at: null,
        state: 'disconnected',
        disconnected_at: disconnectedAt,
      })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('provider', 'google')
      .select(PUBLIC_CONNECTION_COLUMNS)
      .single<PublicCalendarConnectionRow>();

    return mapCalendarConnectionRowToDto(
      requireRow(data, error, 'calendar_connection_update_failed', 'Unable to update calendar connection.'),
    );
  }

  async findPreferencesForUser(workspaceId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('calendar_preferences')
      .select(PREFERENCE_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('provider', 'google')
      .maybeSingle<CalendarPreferencesRow>();

    throwOnSupabaseError(error, 'calendar_preferences_lookup_failed', 'Unable to load calendar settings.');
    return data ? mapCalendarPreferencesRowToDto(data) : null;
  }

  async upsertPreferences(input: UpsertCalendarPreferencesInput) {
    const preferences = input.preferences;
    const { data, error } = await this.supabase
      .from('calendar_preferences')
      .upsert({
        workspace_id: input.workspaceId,
        user_id: input.userId,
        provider: 'google',
        weekly_meeting_sync_enabled: preferences.weeklyMeetingSyncEnabled,
        assigned_task_sync_enabled: preferences.assignedTaskSyncEnabled,
        weekly_meeting_day: preferences.weeklyMeetingDay,
        weekly_meeting_time: preferences.weeklyMeetingTime,
        time_zone: preferences.timeZone,
        last_sync_error_code: preferences.lastSyncErrorCode ?? null,
        last_sync_attempted_at: preferences.lastSyncAttemptedAt ?? null,
      }, { onConflict: 'workspace_id,user_id,provider' })
      .select(PREFERENCE_COLUMNS)
      .single<CalendarPreferencesRow>();

    return mapCalendarPreferencesRowToDto(
      requireRow(data, error, 'calendar_preferences_upsert_failed', 'Unable to save calendar settings.'),
    );
  }

  async clearEventMappingsForUser(workspaceId: string, userId: string) {
    const { error } = await this.supabase
      .from('calendar_events')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('provider', 'google');

    throwOnSupabaseError(error, 'calendar_event_delete_failed', 'Unable to disconnect calendar events.');
  }

  async findEventBySource(
    workspaceId: string,
    userId: string,
    sourceType: CalendarSourceType,
    sourceId: string,
  ) {
    const { data, error } = await this.supabase
      .from('calendar_events')
      .select(EVENT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .eq('provider', 'google')
      .maybeSingle<CalendarEventRow>();

    throwOnSupabaseError(error, 'calendar_event_lookup_failed', 'Unable to load calendar event.');

    return data ? mapCalendarEventRowToDto(data) : null;
  }

  async upsertEvent(input: UpsertCalendarEventInput) {
    const { data, error } = await this.supabase
      .from('calendar_events')
      .upsert(
        {
          workspace_id: input.workspaceId,
          user_id: input.userId,
          provider: 'google',
          source_type: input.sourceType,
          source_id: input.sourceId,
          provider_event_id: input.providerEventId,
        },
        { onConflict: 'workspace_id,user_id,provider,source_type,source_id' },
      )
      .select(EVENT_COLUMNS)
      .single<CalendarEventRow>();

    return mapCalendarEventRowToDto(
      requireRow(data, error, 'calendar_event_upsert_failed', 'Unable to save calendar event.'),
    );
  }
}
