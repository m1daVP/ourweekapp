import { formatApiDateTime, formatNullableApiDateTime } from '../../shared/dates.js';
import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { requireRow, throwOnSupabaseError } from '../../shared/repositories/index.js';

const AI_SUMMARY_REQUEST_COLUMNS =
  'id,workspace_id,user_id,meeting_id,provider,status,input_hash,created_at,completed_at,error_code' as const;
const PUBLIC_AI_SUMMARY_REQUEST_COLUMNS =
  'id,workspace_id,user_id,meeting_id,provider,status,created_at,completed_at,error_code' as const;

type AiSummaryRequestRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  meeting_id: string;
  provider: string;
  status: string;
  input_hash: string | null;
  created_at: string;
  completed_at: string | null;
  error_code: string | null;
};

type PublicAiSummaryRequestRow = Omit<AiSummaryRequestRow, 'input_hash'>;

export type AiSummaryRequestDto = {
  id: string;
  workspaceId: string;
  userId: string;
  meetingId: string;
  provider: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  errorCode: string | null;
};

export type AiSummaryRequestRecord = AiSummaryRequestDto & {
  inputHash: string | null;
};

export type CreateAiSummaryRequestInput = {
  workspaceId: string;
  userId: string;
  meetingId: string;
  provider: string;
  status: string;
  inputHash?: string | null;
};

export function mapAiSummaryRequestRowToDto(row: PublicAiSummaryRequestRow): AiSummaryRequestDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    meetingId: row.meeting_id,
    provider: row.provider,
    status: row.status,
    createdAt: formatApiDateTime(row.created_at),
    completedAt: formatNullableApiDateTime(row.completed_at),
    errorCode: row.error_code,
  };
}

export function mapAiSummaryRequestRowToRecord(row: AiSummaryRequestRow): AiSummaryRequestRecord {
  return {
    ...mapAiSummaryRequestRowToDto(row),
    inputHash: row.input_hash,
  };
}

export class AiRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async createSummaryRequest(input: CreateAiSummaryRequestInput) {
    const { data, error } = await this.supabase
      .from('ai_summary_requests')
      .insert({
        workspace_id: input.workspaceId,
        user_id: input.userId,
        meeting_id: input.meetingId,
        provider: input.provider,
        status: input.status,
        input_hash: input.inputHash ?? null,
      })
      .select(AI_SUMMARY_REQUEST_COLUMNS)
      .single<AiSummaryRequestRow>();

    return mapAiSummaryRequestRowToRecord(
      requireRow(data, error, 'ai_summary_request_create_failed', 'Unable to create AI summary request.'),
    );
  }

  async findSummaryRequestByIdForWorkspace(workspaceId: string, requestId: string) {
    const { data, error } = await this.supabase
      .from('ai_summary_requests')
      .select(PUBLIC_AI_SUMMARY_REQUEST_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('id', requestId)
      .maybeSingle<PublicAiSummaryRequestRow>();

    throwOnSupabaseError(error, 'ai_summary_request_lookup_failed', 'Unable to load AI summary request.');

    return data ? mapAiSummaryRequestRowToDto(data) : null;
  }

  async markSummaryRequestCompleted(workspaceId: string, requestId: string, completedAt: string) {
    const { data, error } = await this.supabase
      .from('ai_summary_requests')
      .update({ status: 'completed', completed_at: completedAt, error_code: null })
      .eq('workspace_id', workspaceId)
      .eq('id', requestId)
      .select(PUBLIC_AI_SUMMARY_REQUEST_COLUMNS)
      .single<PublicAiSummaryRequestRow>();

    return mapAiSummaryRequestRowToDto(
      requireRow(data, error, 'ai_summary_request_update_failed', 'Unable to update AI summary request.'),
    );
  }

  async markSummaryRequestFailed(
    workspaceId: string,
    requestId: string,
    completedAt: string,
    errorCode: string,
  ) {
    const { data, error } = await this.supabase
      .from('ai_summary_requests')
      .update({ status: 'failed', completed_at: completedAt, error_code: errorCode })
      .eq('workspace_id', workspaceId)
      .eq('id', requestId)
      .select(PUBLIC_AI_SUMMARY_REQUEST_COLUMNS)
      .single<PublicAiSummaryRequestRow>();

    return mapAiSummaryRequestRowToDto(
      requireRow(data, error, 'ai_summary_request_update_failed', 'Unable to update AI summary request.'),
    );
  }

  async countRecentSummaryRequestsForWorkspace(workspaceId: string, since: string) {
    const { count, error } = await this.supabase
      .from('ai_summary_requests')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('created_at', since);

    throwOnSupabaseError(error, 'ai_summary_request_count_failed', 'Unable to count AI summary requests.');

    return count ?? 0;
  }

  async countRecentSummaryRequestsForUserInWorkspace(workspaceId: string, userId: string, since: string) {
    const { count, error } = await this.supabase
      .from('ai_summary_requests')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .gte('created_at', since);

    throwOnSupabaseError(error, 'ai_summary_request_count_failed', 'Unable to count AI summary requests.');

    return count ?? 0;
  }
}

