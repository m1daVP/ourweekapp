import { formatApiDateTime, formatNullableApiDateTime } from '../../shared/dates.js';
import { ApiError } from '../../shared/errors/index.js';
import type { JsonValue, SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { requireRow, throwOnSupabaseError } from '../../shared/repositories/index.js';
import type { AiSummaryTokenUsage } from './openai.client.js';

export const AI_SUMMARY_RATE_LIMIT_WINDOW_SECONDS = 60 * 60;
export const AI_SUMMARY_RATE_LIMIT_PER_USER = 5;
export const AI_SUMMARY_RATE_LIMIT_PER_WORKSPACE = 20;

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
  effective_model: string | null;
  prompt_version: string | null;
  created_at: string;
  completed_at: string | null;
  error_code: string | null;
  generated_summary: JsonValue | null;
};

type PublicAiSummaryRequestRow = Omit<
  AiSummaryRequestRow,
  'input_hash' | 'effective_model' | 'prompt_version' | 'generated_summary'
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
  effectiveModel: string | null;
  promptVersion: string | null;
  generatedSummary: JsonValue | null;
};

export type ClaimAiSummaryGenerationInput = {
  workspaceId: string;
  meetingId: string;
  userId: string;
  provider: string;
  inputHash: string;
  effectiveModel: string;
  promptVersion: string;
};

export type AiSummaryGenerationClaim = {
  status: 'created' | 'pending' | 'completed';
  request: AiSummaryRequestRecord;
} | {
  status: 'rate_limited';
  scope: 'user' | 'workspace';
  resetAt: string;
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

type AiSummaryGenerationClaimRow = {
  claim_status: string;
  rate_limit_scope: string | null;
  rate_limit_reset_at: string | null;
  id: string | null;
  workspace_id: string | null;
  user_id: string | null;
  meeting_id: string | null;
  provider: string | null;
  status: string | null;
  input_hash: string | null;
  effective_model: string | null;
  prompt_version: string | null;
  created_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  generated_summary: JsonValue | null;
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
    effectiveModel: row.effective_model,
    promptVersion: row.prompt_version,
    generatedSummary: row.generated_summary,
  };
}

export class AiRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async claimSummaryGeneration(input: ClaimAiSummaryGenerationInput): Promise<AiSummaryGenerationClaim> {
    const { data, error } = await this.supabase
      .rpc('claim_ai_summary_generation_v3', {
        p_workspace_id: input.workspaceId,
        p_meeting_id: input.meetingId,
        p_user_id: input.userId,
        p_provider: input.provider,
        p_input_hash: input.inputHash,
        p_effective_model: input.effectiveModel,
        p_prompt_version: input.promptVersion,
        p_user_limit: AI_SUMMARY_RATE_LIMIT_PER_USER,
        p_workspace_limit: AI_SUMMARY_RATE_LIMIT_PER_WORKSPACE,
        p_window_seconds: AI_SUMMARY_RATE_LIMIT_WINDOW_SECONDS,
      })
      .single<AiSummaryGenerationClaimRow>();

    const row = requireRow(
      data,
      error,
      'ai_summary_request_claim_failed',
      'Unable to claim AI summary generation.',
    );

    if (row.claim_status === 'rate_limited') {
      if (
        (row.rate_limit_scope !== 'user' && row.rate_limit_scope !== 'workspace')
        || row.rate_limit_reset_at === null
        || Number.isNaN(Date.parse(row.rate_limit_reset_at))
      ) {
        throw new ApiError(
          500,
          'ai_summary_request_claim_invalid',
          'Unable to claim AI summary generation.',
        );
      }

      return {
        status: 'rate_limited',
        scope: row.rate_limit_scope,
        resetAt: formatApiDateTime(row.rate_limit_reset_at),
      };
    }

    if (
      row.claim_status !== 'created'
      && row.claim_status !== 'pending'
      && row.claim_status !== 'completed'
      || row.id === null
      || row.workspace_id === null
      || row.user_id === null
      || row.meeting_id === null
      || row.provider === null
      || row.status === null
      || row.input_hash === null
      || row.created_at === null
    ) {
      throw new ApiError(
        500,
        'ai_summary_request_claim_invalid',
        'Unable to claim AI summary generation.',
      );
    }

    return {
      status: row.claim_status,
      request: mapAiSummaryRequestRowToRecord(row as AiSummaryRequestRow),
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

}

