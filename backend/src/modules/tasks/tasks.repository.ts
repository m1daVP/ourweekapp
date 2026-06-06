import type { JsonValue, SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { requireRow, throwOnSupabaseError } from '../../shared/repositories/index.js';

const TASK_COLUMNS =
  'id,workspace_id,title,description,responsibility_type,responsible_participant_ids,due_date,status,source_meeting_id,server_revision,created_at,updated_at,deleted_at' as const;
const AGREEMENT_COLUMNS =
  'id,workspace_id,title,description,participant_ids,related_task_ids,source_meeting_id,server_revision,created_at,updated_at,deleted_at' as const;
const REVIEW_DECISION_COLUMNS = 'workspace_id,meeting_id,source_meeting_id,decided_at' as const;

type TaskRow = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  responsibility_type: 'participant' | 'shared' | 'needsDiscussion';
  responsible_participant_ids: JsonValue;
  due_date: string | null;
  status: 'open' | 'done' | 'skipped';
  source_meeting_id: string | null;
  server_revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type AgreementRow = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  participant_ids: JsonValue;
  related_task_ids: JsonValue | null;
  source_meeting_id: string;
  server_revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type TaskReviewDecisionRow = {
  workspace_id: string;
  meeting_id: string;
  source_meeting_id: string;
  decided_at: string;
};

export type TaskDto = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  responsibilityType: TaskRow['responsibility_type'];
  responsibleParticipantIds: string[];
  dueDate: string | null;
  status: TaskRow['status'];
  sourceMeetingId: string | null;
  serverRevision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AgreementDto = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  participantIds: string[];
  relatedTaskIds: string[];
  sourceMeetingId: string;
  serverRevision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type TaskReviewDecisionDto = {
  workspaceId: string;
  meetingId: string;
  sourceMeetingId: string;
  decidedAt: string;
};

export type UpsertTaskInput = {
  id?: string;
  workspaceId: string;
  title: string;
  description?: string | null;
  responsibilityType: TaskRow['responsibility_type'];
  responsibleParticipantIds: string[];
  dueDate?: string | null;
  status: TaskRow['status'];
  sourceMeetingId?: string | null;
  serverRevision?: number;
};

export type UpsertAgreementInput = {
  id?: string;
  workspaceId: string;
  title: string;
  description?: string | null;
  participantIds: string[];
  relatedTaskIds?: string[];
  sourceMeetingId: string;
  serverRevision?: number;
};

function stringArrayFromJson(value: JsonValue | null): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function mapTaskRowToDto(row: TaskRow): TaskDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    responsibilityType: row.responsibility_type,
    responsibleParticipantIds: stringArrayFromJson(row.responsible_participant_ids),
    dueDate: row.due_date,
    status: row.status,
    sourceMeetingId: row.source_meeting_id,
    serverRevision: row.server_revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapAgreementRowToDto(row: AgreementRow): AgreementDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    participantIds: stringArrayFromJson(row.participant_ids),
    relatedTaskIds: stringArrayFromJson(row.related_task_ids),
    sourceMeetingId: row.source_meeting_id,
    serverRevision: row.server_revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function mapTaskReviewDecisionRowToDto(row: TaskReviewDecisionRow): TaskReviewDecisionDto {
  return {
    workspaceId: row.workspace_id,
    meetingId: row.meeting_id,
    sourceMeetingId: row.source_meeting_id,
    decidedAt: row.decided_at,
  };
}

export class TasksRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async listTasksForWorkspace(workspaceId: string, includeDeleted = false) {
    let query = this.supabase
      .from('tasks')
      .select(TASK_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false });

    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query.returns<TaskRow[]>();

    throwOnSupabaseError(error, 'task_list_failed', 'Unable to list tasks.');

    return (data ?? []).map(mapTaskRowToDto);
  }

  async findTaskByIdForWorkspace(workspaceId: string, taskId: string, includeDeleted = false) {
    let query = this.supabase
      .from('tasks')
      .select(TASK_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('id', taskId);

    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query.maybeSingle<TaskRow>();

    throwOnSupabaseError(error, 'task_lookup_failed', 'Unable to load the task.');

    return data ? mapTaskRowToDto(data) : null;
  }

  async upsertTask(input: UpsertTaskInput) {
    const { data, error } = await this.supabase
      .from('tasks')
      .upsert(
        {
          ...(input.id ? { id: input.id } : {}),
          workspace_id: input.workspaceId,
          title: input.title,
          description: input.description ?? null,
          responsibility_type: input.responsibilityType,
          responsible_participant_ids: input.responsibleParticipantIds,
          due_date: input.dueDate ?? null,
          status: input.status,
          source_meeting_id: input.sourceMeetingId ?? null,
          server_revision: input.serverRevision ?? 1,
          deleted_at: null,
        },
        { onConflict: 'workspace_id,id' },
      )
      .select(TASK_COLUMNS)
      .single<TaskRow>();

    return mapTaskRowToDto(
      requireRow(data, error, 'task_upsert_failed', 'Unable to save the task.'),
    );
  }

  async softDeleteTask(workspaceId: string, taskId: string, deletedAt: string) {
    const { data, error } = await this.supabase
      .from('tasks')
      .update({ deleted_at: deletedAt })
      .eq('workspace_id', workspaceId)
      .eq('id', taskId)
      .is('deleted_at', null)
      .select(TASK_COLUMNS)
      .single<TaskRow>();

    return mapTaskRowToDto(
      requireRow(data, error, 'task_delete_failed', 'Unable to delete the task.'),
    );
  }

  async listAgreementsForWorkspace(workspaceId: string, includeDeleted = false) {
    let query = this.supabase
      .from('agreements')
      .select(AGREEMENT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false });

    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query.returns<AgreementRow[]>();

    throwOnSupabaseError(error, 'agreement_list_failed', 'Unable to list agreements.');

    return (data ?? []).map(mapAgreementRowToDto);
  }

  async findAgreementByIdForWorkspace(workspaceId: string, agreementId: string, includeDeleted = false) {
    let query = this.supabase
      .from('agreements')
      .select(AGREEMENT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('id', agreementId);

    if (!includeDeleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query.maybeSingle<AgreementRow>();

    throwOnSupabaseError(error, 'agreement_lookup_failed', 'Unable to load the agreement.');

    return data ? mapAgreementRowToDto(data) : null;
  }

  async upsertAgreement(input: UpsertAgreementInput) {
    const { data, error } = await this.supabase
      .from('agreements')
      .upsert(
        {
          ...(input.id ? { id: input.id } : {}),
          workspace_id: input.workspaceId,
          title: input.title,
          description: input.description ?? null,
          participant_ids: input.participantIds,
          related_task_ids: input.relatedTaskIds ?? [],
          source_meeting_id: input.sourceMeetingId,
          server_revision: input.serverRevision ?? 1,
          deleted_at: null,
        },
        { onConflict: 'workspace_id,id' },
      )
      .select(AGREEMENT_COLUMNS)
      .single<AgreementRow>();

    return mapAgreementRowToDto(
      requireRow(data, error, 'agreement_upsert_failed', 'Unable to save the agreement.'),
    );
  }

  async softDeleteAgreement(workspaceId: string, agreementId: string, deletedAt: string) {
    const { data, error } = await this.supabase
      .from('agreements')
      .update({ deleted_at: deletedAt })
      .eq('workspace_id', workspaceId)
      .eq('id', agreementId)
      .is('deleted_at', null)
      .select(AGREEMENT_COLUMNS)
      .single<AgreementRow>();

    return mapAgreementRowToDto(
      requireRow(data, error, 'agreement_delete_failed', 'Unable to delete the agreement.'),
    );
  }

  async listReviewDecisionsForWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('task_review_decisions')
      .select(REVIEW_DECISION_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('decided_at', { ascending: false })
      .returns<TaskReviewDecisionRow[]>();

    throwOnSupabaseError(error, 'review_decision_list_failed', 'Unable to list review decisions.');

    return (data ?? []).map(mapTaskReviewDecisionRowToDto);
  }

  async createReviewDecision(input: Omit<TaskReviewDecisionDto, 'decidedAt'> & { decidedAt: string }) {
    const { data, error } = await this.supabase
      .from('task_review_decisions')
      .upsert(
        {
          workspace_id: input.workspaceId,
          meeting_id: input.meetingId,
          source_meeting_id: input.sourceMeetingId,
          decided_at: input.decidedAt,
        },
        { onConflict: 'workspace_id,meeting_id,source_meeting_id' },
      )
      .select(REVIEW_DECISION_COLUMNS)
      .single<TaskReviewDecisionRow>();

    return mapTaskReviewDecisionRowToDto(
      requireRow(data, error, 'review_decision_create_failed', 'Unable to save review decision.'),
    );
  }
}


