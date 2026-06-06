import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { requireRow, throwOnSupabaseError } from '../../shared/repositories/index.js';

const PARTICIPANT_COLUMNS =
  'id,workspace_id,name,initials,avatar_color,type,is_active,server_revision,created_at,updated_at,deleted_at' as const;

type ParticipantRow = {
  id: string;
  workspace_id: string;
  name: string;
  initials: string;
  avatar_color: string;
  type: 'adult' | 'child' | 'other';
  is_active: boolean;
  server_revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ParticipantDto = {
  id: string;
  workspaceId: string;
  name: string;
  initials: string;
  avatarColor: string;
  type: ParticipantRow['type'];
  isActive: boolean;
  serverRevision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type UpsertParticipantInput = {
  id?: string;
  workspaceId: string;
  name: string;
  initials: string;
  avatarColor: string;
  type: ParticipantRow['type'];
  isActive: boolean;
  serverRevision?: number;
};

export type CreateParticipantInput = {
  id: string;
  workspaceId: string;
  name: string;
  initials: string;
  avatarColor: string;
  type: ParticipantRow['type'];
  isActive: boolean;
};

export type UpdateParticipantIfRevisionMatchesInput = {
  id: string;
  workspaceId: string;
  name: string;
  initials: string;
  avatarColor: string;
  type: ParticipantRow['type'];
  isActive: boolean;
  expectedServerRevision: number;
};

export function mapParticipantRowToDto(row: ParticipantRow): ParticipantDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    initials: row.initials,
    avatarColor: row.avatar_color,
    type: row.type,
    isActive: row.is_active,
    serverRevision: row.server_revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class ParticipantsRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async listParticipantsForWorkspace(workspaceId: string, includeDeleted = false) {
    let query = this.supabase
      .from('participants')
      .select(PARTICIPANT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query.returns<ParticipantRow[]>();

    throwOnSupabaseError(error, 'participant_list_failed', 'Unable to list participants.');

    return (data ?? []).map(mapParticipantRowToDto);
  }

  async findParticipantByIdForWorkspace(workspaceId: string, participantId: string, includeDeleted = false) {
    let query = this.supabase
      .from('participants')
      .select(PARTICIPANT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('id', participantId);

    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query.maybeSingle<ParticipantRow>();

    throwOnSupabaseError(error, 'participant_lookup_failed', 'Unable to load the participant.');

    return data ? mapParticipantRowToDto(data) : null;
  }

  async upsertParticipant(input: UpsertParticipantInput) {
    const row = {
      ...(input.id ? { id: input.id } : {}),
      workspace_id: input.workspaceId,
      name: input.name,
      initials: input.initials,
      avatar_color: input.avatarColor,
      type: input.type,
      is_active: input.isActive,
      server_revision: input.serverRevision ?? 1,
      deleted_at: null,
    };

    const { data, error } = await this.supabase
      .from('participants')
      .upsert(row, { onConflict: 'workspace_id,id' })
      .select(PARTICIPANT_COLUMNS)
      .single<ParticipantRow>();

    return mapParticipantRowToDto(
      requireRow(data, error, 'participant_upsert_failed', 'Unable to save the participant.'),
    );
  }

  async createParticipant(input: CreateParticipantInput) {
    const { data, error } = await this.supabase
      .from('participants')
      .insert({
        id: input.id,
        workspace_id: input.workspaceId,
        name: input.name,
        initials: input.initials,
        avatar_color: input.avatarColor,
        type: input.type,
        is_active: input.isActive,
        server_revision: 1,
        deleted_at: null,
      })
      .select(PARTICIPANT_COLUMNS)
      .single<ParticipantRow>();

    return mapParticipantRowToDto(
      requireRow(data, error, 'participant_create_failed', 'Unable to save the participant.'),
    );
  }

  async updateParticipantIfRevisionMatches(input: UpdateParticipantIfRevisionMatchesInput) {
    const { data, error } = await this.supabase
      .from('participants')
      .update({
        name: input.name,
        initials: input.initials,
        avatar_color: input.avatarColor,
        type: input.type,
        is_active: input.isActive,
        server_revision: input.expectedServerRevision + 1,
      })
      .eq('workspace_id', input.workspaceId)
      .eq('id', input.id)
      .eq('server_revision', input.expectedServerRevision)
      .is('deleted_at', null)
      .select(PARTICIPANT_COLUMNS)
      .maybeSingle<ParticipantRow>();

    throwOnSupabaseError(error, 'participant_update_failed', 'Unable to save the participant.');

    return data ? mapParticipantRowToDto(data) : null;
  }

  async softDeleteParticipantIfRevisionMatches(
    workspaceId: string,
    participantId: string,
    expectedServerRevision: number,
    deletedAt: string,
  ) {
    const { data, error } = await this.supabase
      .from('participants')
      .update({
        deleted_at: deletedAt,
        is_active: false,
        server_revision: expectedServerRevision + 1,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', participantId)
      .eq('server_revision', expectedServerRevision)
      .is('deleted_at', null)
      .select(PARTICIPANT_COLUMNS)
      .maybeSingle<ParticipantRow>();

    throwOnSupabaseError(error, 'participant_delete_failed', 'Unable to delete the participant.');

    return data ? mapParticipantRowToDto(data) : null;
  }

  async softDeleteParticipant(workspaceId: string, participantId: string, deletedAt: string) {
    const { data, error } = await this.supabase
      .from('participants')
      .update({ deleted_at: deletedAt, is_active: false })
      .eq('workspace_id', workspaceId)
      .eq('id', participantId)
      .is('deleted_at', null)
      .select(PARTICIPANT_COLUMNS)
      .single<ParticipantRow>();

    return mapParticipantRowToDto(
      requireRow(data, error, 'participant_delete_failed', 'Unable to delete the participant.'),
    );
  }
}

