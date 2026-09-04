import { formatApiDateTime, formatNullableApiDateTime } from '../../shared/dates.js';
import { ApiError } from '../../shared/errors/index.js';
import type { JsonValue, SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { requireRow, throwOnSupabaseError } from '../../shared/repositories/index.js';
import type { AiSummaryTokenUsage } from './openai.client.js';

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
  generated_summary: JsonValue | null;
};

type PublicAiSummaryRequestRow = Omit<
  AiSummaryRequestRow,
  'input_hash' | 'generated_summary'
>;

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
  generatedSummary: JsonValue | null;
};

export type ClaimAiSummaryGenerationInput = {
  workspaceId: string;
  meetingId: string;
  userId: string;
  provider: string;
  inputHash: string;
};

export type AiSummaryGenerationClaim = {
  status: 'created' | 'pending' | 'completed';
  request: AiSummaryRequestRecord;
};

export type FinalizeAiSummaryGenerationInput = {
  workspaceId: string;
  requestId: string;
  meetingId: string;
  expectedServerRevision: number;
  generatedSummary: JsonValue;
  completedAt: string;
  usage: AiSummaryTokenUsage | null;
};

export type AiSummaryGenerationFinalization = {
  status: 'applied' | 'completed' | 'revision_conflict';
  meetingId: string;
  sourceServerRevision: number;
  serverRevision: number | null;
  updatedAt: string | null;
};

type AiSummaryGenerationClaimRow = AiSummaryRequestRow & {
  claim_status: string;
};

type AiSummaryGenerationFinalizationRow = {
  finalization_status: string;
  meeting_id: string;
  source_server_revision: number;
  server_revision: number | null;
  updated_at: string | null;
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
    generatedSummary: row.generated_summary,
  };
}

export class AiRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async claimSummaryGeneration(input: ClaimAiSummaryGenerationInput): Promise<AiSummaryGenerationClaim> {
    const { data, error } = await this.supabase
      .rpc('claim_ai_summary_generation', {
        p_workspace_id: input.workspaceId,
        p_meeting_id: input.meetingId,
        p_user_id: input.userId,
        p_provider: input.provider,
        p_input_hash: input.inputHash,
      })
      .single<AiSummaryGenerationClaimRow>();

    const row = requireRow(
      data,
      error,
      'ai_summary_request_claim_failed',
      'Unable to claim AI summary generation.',
    );

    if (
      row.claim_status !== 'created'
      && row.claim_status !== 'pending'
      && row.claim_status !== 'completed'
    ) {
      throw new ApiError(
        500,
        'ai_summary_request_claim_invalid',
        'Unable to claim AI summary generation.',
      );
    }

    return {
      status: row.claim_status,
      request: mapAiSummaryRequestRowToRecord(row),
    };
  }

  async finalizeSummaryGeneration(
    input: FinalizeAiSummaryGenerationInput,
  ): Promise<AiSummaryGenerationFinalization> {
    const { data, error } = await this.supabase
      .rpc('finalize_ai_summary_generation', {
        p_workspace_id: input.workspaceId,
        p_request_id: input.requestId,
        p_meeting_id: input.meetingId,
        p_expected_server_revision: input.expectedServerRevision,
        p_generated_summary: input.generatedSummary,
        p_completed_at: input.completedAt,
        p_input_tokens: input.usage?.inputTokens ?? null,
        p_output_tokens: input.usage?.outputTokens ?? null,
        p_total_tokens: input.usage?.totalTokens ?? null,
      })
      .single<AiSummaryGenerationFinalizationRow>();

    const row = requireRow(
      data,
      error,
      'ai_summary_request_finalization_failed',
      'Unable to finalize AI summary generation.',
    );

    if (
      row.finalization_status !== 'applied'
      && row.finalization_status !== 'completed'
      && row.finalization_status !== 'revision_conflict'
    ) {
      throw new ApiError(
        500,
        'ai_summary_request_finalization_invalid',
        'Unable to finalize AI summary generation.',
      );
    }

    return {
      status: row.finalization_status,
      meetingId: row.meeting_id,
      sourceServerRevision: row.source_server_revision,
      serverRevision: row.server_revision,
      updatedAt: formatNullableApiDateTime(row.updated_at),
    };
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

