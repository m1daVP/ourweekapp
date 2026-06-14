import { formatApiDateTime, formatNullableApiDateTime } from '../../shared/dates.js';
import type { JsonValue, SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { requireRow, throwOnSupabaseError } from '../../shared/repositories/index.js';

const MEETING_COLUMNS =
  'id,workspace_id,template_id,title,status,participant_ids,sections,current_section_index,ai_summary,server_revision,created_at,updated_at,completed_at,deleted_at' as const;

type MeetingRow = {
  id: string;
  workspace_id: string;
  template_id: string;
  title: string;
  status: 'draft' | 'in_progress' | 'paused' | 'incomplete' | 'completed';
  participant_ids: JsonValue;
  sections: JsonValue;
  current_section_index: number;
  ai_summary: JsonValue | null;
  server_revision: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
};

export type MeetingDto = {
  id: string;
  workspaceId: string;
  templateId: string;
  title: string;
  status: MeetingRow['status'];
  participantIds: string[];
  sections: JsonValue[];
  currentSectionIndex: number;
  aiSummary: JsonValue | null;
  serverRevision: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
};

export type UpsertMeetingInput = {
  id?: string;
  workspaceId: string;
  templateId: string;
  title: string;
  status: MeetingRow['status'];
  participantIds: string[];
  sections: JsonValue[];
  currentSectionIndex: number;
  aiSummary?: JsonValue | null;
  serverRevision?: number;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
};

function stringArrayFromJson(value: JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function jsonArrayFromJson(value: JsonValue): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

export function mapMeetingRowToDto(row: MeetingRow): MeetingDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    templateId: row.template_id,
    title: row.title,
    status: row.status,
    participantIds: stringArrayFromJson(row.participant_ids),
    sections: jsonArrayFromJson(row.sections),
    currentSectionIndex: row.current_section_index,
    aiSummary: row.ai_summary,
    serverRevision: row.server_revision,
    createdAt: formatApiDateTime(row.created_at),
    updatedAt: formatApiDateTime(row.updated_at),
    completedAt: formatNullableApiDateTime(row.completed_at),
    deletedAt: formatNullableApiDateTime(row.deleted_at),
  };
}

export class MeetingsRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async listMeetingsForWorkspace(
    workspaceId: string,
    limit = 100,
    offset = 0,
    includeDeleted = false,
  ) {
    let query = this.supabase
      .from('meetings')
      .select(MEETING_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query.returns<MeetingRow[]>();

    throwOnSupabaseError(error, 'meeting_list_failed', 'Unable to list meetings.');

    return (data ?? []).map(mapMeetingRowToDto);
  }

  async listCompletedMeetingsForFreePlan(workspaceId: string, limit = 3) {
    const { data, error } = await this.supabase
      .from('meetings')
      .select(MEETING_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(limit)
      .returns<MeetingRow[]>();

    throwOnSupabaseError(error, 'meeting_list_failed', 'Unable to list meetings.');

    return (data ?? []).map(mapMeetingRowToDto);
  }

  async listMeetingsByStatusesForWorkspace(
    workspaceId: string,
    statuses: MeetingRow['status'][],
  ) {
    const { data, error } = await this.supabase
      .from('meetings')
      .select(MEETING_COLUMNS)
      .eq('workspace_id', workspaceId)
      .in('status', statuses)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .returns<MeetingRow[]>();

    throwOnSupabaseError(error, 'meeting_list_failed', 'Unable to list meetings.');

    return (data ?? []).map(mapMeetingRowToDto);
  }

  async findMeetingByIdForWorkspace(
    workspaceId: string,
    meetingId: string,
    includeDeleted = false,
  ) {
    let query = this.supabase
      .from('meetings')
      .select(MEETING_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('id', meetingId);

    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query.maybeSingle<MeetingRow>();

    throwOnSupabaseError(error, 'meeting_lookup_failed', 'Unable to load the meeting.');

    return data ? mapMeetingRowToDto(data) : null;
  }

  async upsertMeeting(input: UpsertMeetingInput) {
    const row = {
      ...(input.id ? { id: input.id } : {}),
      workspace_id: input.workspaceId,
      template_id: input.templateId,
      title: input.title,
      status: input.status,
      participant_ids: input.participantIds,
      sections: input.sections,
      current_section_index: input.currentSectionIndex,
      ai_summary: input.aiSummary ?? null,
      server_revision: input.serverRevision ?? 1,
      completed_at: input.completedAt ?? null,
      deleted_at: null,
    };

    const { data, error } = await this.supabase
      .from('meetings')
      .upsert(row, { onConflict: 'workspace_id,id' })
      .select(MEETING_COLUMNS)
      .single<MeetingRow>();

    return mapMeetingRowToDto(
      requireRow(data, error, 'meeting_upsert_failed', 'Unable to save the meeting.'),
    );
  }

  async insertMeeting(input: UpsertMeetingInput) {
    const row = {
      ...(input.id ? { id: input.id } : {}),
      workspace_id: input.workspaceId,
      template_id: input.templateId,
      title: input.title,
      status: input.status,
      participant_ids: input.participantIds,
      sections: input.sections,
      current_section_index: input.currentSectionIndex,
      ai_summary: input.aiSummary ?? null,
      server_revision: input.serverRevision ?? 1,
      created_at: input.createdAt,
      updated_at: input.updatedAt,
      completed_at: input.completedAt ?? null,
      deleted_at: null,
    };

    const { data, error } = await this.supabase
      .from('meetings')
      .insert(row)
      .select(MEETING_COLUMNS)
      .single<MeetingRow>();

    return mapMeetingRowToDto(
      requireRow(data, error, 'meeting_create_failed', 'Unable to create the meeting.'),
    );
  }

  async updateMeeting(
    workspaceId: string,
    meetingId: string,
    expectedServerRevision: number,
    input: Omit<UpsertMeetingInput, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>,
  ) {
    const { data, error } = await this.supabase
      .from('meetings')
      .update({
        template_id: input.templateId,
        title: input.title,
        status: input.status,
        participant_ids: input.participantIds,
        sections: input.sections,
        current_section_index: input.currentSectionIndex,
        ai_summary: input.aiSummary ?? null,
        server_revision: expectedServerRevision + 1,
        completed_at: input.completedAt ?? null,
        deleted_at: null,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', meetingId)
      .eq('server_revision', expectedServerRevision)
      .select(MEETING_COLUMNS)
      .maybeSingle<MeetingRow>();

    throwOnSupabaseError(error, 'meeting_update_failed', 'Unable to update the meeting.');

    return data ? mapMeetingRowToDto(data) : null;
  }

  async updateMeetingSummary(
    workspaceId: string,
    meetingId: string,
    aiSummary: JsonValue,
  ) {
    const current = await this.findMeetingByIdForWorkspace(workspaceId, meetingId);

    if (!current) {
      return null;
    }

    const { data, error } = await this.supabase
      .from('meetings')
      .update({
        ai_summary: aiSummary,
        server_revision: current.serverRevision + 1,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', meetingId)
      .eq('server_revision', current.serverRevision)
      .is('deleted_at', null)
      .select(MEETING_COLUMNS)
      .maybeSingle<MeetingRow>();

    throwOnSupabaseError(error, 'meeting_update_failed', 'Unable to update the meeting.');

    return data ? mapMeetingRowToDto(data) : null;
  }

  async softDeleteMeeting(
    workspaceId: string,
    meetingId: string,
    deletedAt: string,
    expectedServerRevision?: number,
  ) {
    let query = this.supabase
      .from('meetings')
      .update({
        deleted_at: deletedAt,
        ...(expectedServerRevision
          ? { server_revision: expectedServerRevision + 1 }
          : {}),
      })
      .eq('workspace_id', workspaceId)
      .eq('id', meetingId)
      .is('deleted_at', null);

    if (expectedServerRevision) {
      query = query.eq('server_revision', expectedServerRevision);
    }

    const { data, error } = await query
      .select(MEETING_COLUMNS)
      .maybeSingle<MeetingRow>();

    throwOnSupabaseError(error, 'meeting_delete_failed', 'Unable to delete the meeting.');

    return data ? mapMeetingRowToDto(data) : null;
  }
}
