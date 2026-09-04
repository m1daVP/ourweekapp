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

type AiSummaryGenerationClaimRow = AiSummaryRequestRow & {
  claim_status: string;
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

  async markSummaryRequestCompleted(
    workspaceId: string,
    requestId: string,
    completedAt: string,
    usage?: AiSummaryTokenUsage | null,
    generatedSummary?: JsonValue | null,
  ) {
    const { data, error } = await this.supabase
      .from('ai_summary_requests')
      .update({
        status: 'completed',
        completed_at: completedAt,
        error_code: null,
        input_tokens: usage?.inputTokens ?? null,
        output_tokens: usage?.outputTokens ?? null,
        total_tokens: usage?.totalTokens ?? null,
        generated_summary: generatedSummary ?? null,
      })
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

