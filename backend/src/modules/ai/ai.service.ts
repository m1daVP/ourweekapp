import { createHash, randomUUID } from 'node:crypto';

import { ZodError } from 'zod';

import { requireMinimumRole, type AuthContext } from '../../shared/auth/index.js';
import { ApiError, isApiError } from '../../shared/errors/index.js';
import type { JsonValue } from '../../shared/repositories/index.js';
import { MeetingsRepository } from '../meetings/meetings.repository.js';
import { ParticipantsRepository } from '../participants/participants.repository.js';
import { AssistantRepository } from '../assistant/assistant.repository.js';
import { SubscriptionsRepository, type SubscriptionDto } from '../billing/subscriptions.repository.js';
import { hasTrustedPremiumEntitlement } from '../billing/feature-access.js';
import { recapAllowanceForPlan } from '../billing/plan-limits.js';
import { meetingSummarySchema, type AiMeetingSummaryRequestDto } from './ai.schema.js';
import {
  AiRepository,
  AI_SUMMARY_RATE_LIMIT_PER_USER,
  AI_SUMMARY_RATE_LIMIT_PER_WORKSPACE,
  AI_SUMMARY_RATE_LIMIT_WINDOW_SECONDS,
} from './ai.repository.js';
import {
  isAiSummaryProviderError,
  type AiSummaryProvider,
} from './openai.client.js';
import {
  buildSummaryPromptPayload,
  normalizeSummaryProviderOutput,
} from './summary-payload.js';
import {
  buildSummarySystemPrompt,
  resolveSummaryPromptConfiguration,
  SUMMARY_MAX_OUTPUT_TOKENS,
} from './summary-prompts.js';

const AI_SUMMARY_DISCLAIMER =
  'AI summaries can miss context. Please review before relying on them.';

type AiRepositoryPort = Pick<
  AiRepository,
  | 'claimSummaryGeneration'
  | 'finalizeSummaryGeneration'
  | 'markSummaryRequestFailed'
>;

type MeetingsRepositoryPort = Pick<
  MeetingsRepository,
  'findMeetingByIdForWorkspace'
>;

type ParticipantsRepositoryPort = Pick<
  ParticipantsRepository,
  'listParticipantNamesForWorkspace'
>;

type AssistantAllowanceRepository = Pick<
  AssistantRepository,
  | 'countUsedRecaps'
  | 'reconcileAbandonedRecaps'
  | 'reserveRecap'
  | 'releaseRecap'
>;
type SubscriptionRepositoryPort = Pick<SubscriptionsRepository, 'findCurrentSubscriptionForWorkspace'>;

type AiSummaryServiceOptions = {
  aiConfigured?: boolean;
  model?: string;
  providerName?: string;
  logger?: AiSummaryLogger;
};

type AiSummaryLogger = {
  info(input: Record<string, unknown>, message?: string): void;
  warn(input: Record<string, unknown>, message?: string): void;
};

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function shortHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function buildSummaryGenerationInputHash(
  systemPrompt: string,
  promptPayload: string,
  model: string,
  promptVersion: string,
) {
  return shortHash(JSON.stringify([systemPrompt, promptPayload, model, promptVersion]));
}

function durationMsSince(startedAtMs: number) {
  return Math.max(0, Date.now() - startedAtMs);
}

function sanitizeSummaryTaskOwnerReferences(
  value: unknown,
  allowedParticipantIds: ReadonlySet<string>,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const output = value as Record<string, unknown>;

  if (!Array.isArray(output.tasks)) {
    return output;
  }

  return {
    ...output,
    tasks: output.tasks.map((task) => {
      if (typeof task !== 'object' || task === null || Array.isArray(task)) {
        return task;
      }

      const taskRecord = task as Record<string, unknown>;

      if (!Array.isArray(taskRecord.responsibleParticipantIds)) {
        return taskRecord;
      }

      const responsibleParticipantIds = [
        ...new Set(
          taskRecord.responsibleParticipantIds.filter(
            (participantId): participantId is string =>
              typeof participantId === 'string' && allowedParticipantIds.has(participantId),
          ),
        ),
      ];
      const { responsibleParticipantIds: _discardedOwnerIds, ...taskWithoutOwners } = taskRecord;

      return responsibleParticipantIds.length > 0
        ? { ...taskWithoutOwners, responsibleParticipantIds }
        : taskWithoutOwners;
    }),
  };
}

export class AiSummaryService {
  constructor(
    private readonly aiRepository: AiRepositoryPort,
    private readonly meetingsRepository: MeetingsRepositoryPort,
    private readonly participantsRepository: ParticipantsRepositoryPort,
    private readonly provider: AiSummaryProvider,
    private readonly options: AiSummaryServiceOptions = {},
    private readonly assistantRepository?: AssistantAllowanceRepository,
    private readonly subscriptionsRepository?: SubscriptionRepositoryPort,
  ) {}

  async generateMeetingSummary(
    auth: AuthContext,
    request: AiMeetingSummaryRequestDto,
    now = new Date(),
  ) {
    requireMinimumRole(auth, 'adult_member');
    const startedAtMs = Date.now();
    const providerName = this.options.providerName ?? 'openai';

    if (this.options.aiConfigured === false) {
      this.options.logger?.warn({
        event: 'ai_summary_generation_rejected',
        status: 'failed',
        errorCode: 'ai_provider_not_configured',
        workspaceId: auth.workspaceId,
        meetingId: request.meetingId,
        provider: providerName,
        durationMs: durationMsSince(startedAtMs),
      }, 'AI summary generation rejected');
      throw new ApiError(
        503,
        'ai_provider_not_configured',
        'AI summaries are not available right now.',
      );
    }

    const meeting = await this.meetingsRepository.findMeetingByIdForWorkspace(
      auth.workspaceId,
      request.meetingId,
    );

    if (!meeting) {
      this.options.logger?.warn({
        event: 'ai_summary_generation_rejected',
        status: 'failed',
        errorCode: 'meeting_not_found',
        workspaceId: auth.workspaceId,
        meetingId: request.meetingId,
        provider: providerName,
        durationMs: durationMsSince(startedAtMs),
      }, 'AI summary generation rejected');
      throw new ApiError(404, 'meeting_not_found', 'Meeting not found.');
    }

    if (
      request.expectedServerRevision !== undefined &&
      request.expectedServerRevision !== meeting.serverRevision
    ) {
      throw new ApiError(
        409,
        'meeting_update_conflict',
        'Meeting changed. Please sync and try again.',
      );
    }

    const { model, promptVersion } = resolveSummaryPromptConfiguration(
      meeting.templateId,
      this.options.model,
    );

    if (meeting.status !== 'completed') {
      this.options.logger?.warn({
        event: 'ai_summary_generation_rejected',
        status: 'failed',
        errorCode: 'meeting_not_completed',
        workspaceId: auth.workspaceId,
        meetingId: meeting.id,
        templateId: meeting.templateId,
        meetingStatus: meeting.status,
        provider: providerName,
        model,
        promptVersion,
        durationMs: durationMsSince(startedAtMs),
      }, 'AI summary generation rejected');
      throw new ApiError(
        409,
        'meeting_not_completed',
        'Meeting must be completed before generating a summary.',
      );
    }

    if (this.assistantRepository) {
      await this.assistantRepository.reconcileAbandonedRecaps(auth.workspaceId);
    }

    const participants =
      await this.participantsRepository.listParticipantNamesForWorkspace(
        auth.workspaceId,
        meeting.participantIds,
      );
    let promptPayload: string;
    try {
      promptPayload = buildSummaryPromptPayload(meeting, participants, request.locale);
    } catch (error) {
      if (isApiError(error) && error.code === 'ai_summary_input_too_large') {
        this.options.logger?.warn({
          event: 'ai_summary_generation_rejected',
          status: 'failed',
          reason: 'input_too_large',
          errorCode: error.code,
          workspaceId: auth.workspaceId,
          meetingId: meeting.id,
          templateId: meeting.templateId,
          provider: providerName,
          model,
          promptVersion,
          maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
          durationMs: durationMsSince(startedAtMs),
          limit: error.details.limit,
        }, 'AI summary generation rejected');
      }

      throw error;
    }
    const systemPrompt = buildSummarySystemPrompt(meeting.templateId);
    const createdAt = now.toISOString();
    const inputHash = buildSummaryGenerationInputHash(
      systemPrompt,
      promptPayload,
      model,
      promptVersion,
    );

    const claim = await this.aiRepository.claimSummaryGeneration({
      workspaceId: auth.workspaceId,
      meetingId: meeting.id,
      userId: auth.userId,
      provider: providerName,
      inputHash,
      effectiveModel: model,
      promptVersion,
    });

    if (claim.status === 'rate_limited') {
      throw new ApiError(
        429,
        'ai_summary_rate_limited',
        'Please wait before generating another AI summary.',
        {
          userLimit: AI_SUMMARY_RATE_LIMIT_PER_USER,
          workspaceLimit: AI_SUMMARY_RATE_LIMIT_PER_WORKSPACE,
          windowSeconds: AI_SUMMARY_RATE_LIMIT_WINDOW_SECONDS,
          scope: claim.scope,
          remaining: 0,
          resetAt: claim.resetAt,
        },
      );
    }

    if (claim.status === 'pending') {
      this.options.logger?.info({
        event: 'ai_summary_generation_duplicate',
        status: 'pending',
        requestId: claim.request.id,
        workspaceId: auth.workspaceId,
        meetingId: meeting.id,
        templateId: meeting.templateId,
        provider: providerName,
        model,
        promptVersion,
        durationMs: durationMsSince(startedAtMs),
      }, 'AI summary generation already in progress');

      throw new ApiError(
        409,
        'ai_summary_generation_in_progress',
        'An identical AI summary is already being generated. Please try again shortly.',
        { requestId: claim.request.id },
      );
    }

    if (claim.status === 'completed') {
      const parsedCachedSummary = meetingSummarySchema.safeParse(
        claim.request.generatedSummary,
      );

      if (!parsedCachedSummary.success) {
        throw new ApiError(
          500,
          'ai_summary_request_cache_invalid',
          'Unable to load AI summary.',
        );
      }

      this.options.logger?.info({
        event: 'ai_summary_generation_cache_hit',
        status: 'completed',
        requestId: claim.request.id,
        workspaceId: auth.workspaceId,
        meetingId: meeting.id,
        templateId: meeting.templateId,
        provider: providerName,
        model,
        promptVersion,
        durationMs: durationMsSince(startedAtMs),
      }, 'AI summary generation served from cache');

      return {
        summary: parsedCachedSummary.data,
        disclaimer: AI_SUMMARY_DISCLAIMER,
        generatedAt: parsedCachedSummary.data.createdAt,
        meetingSync: {
          meetingId: meeting.id,
          sourceServerRevision: meeting.serverRevision,
          serverRevision: meeting.serverRevision,
          updatedAt: meeting.updatedAt,
        },
      };
    }

    const summaryRequest = claim.request;
    let reserved = false;
    let finalizationAttempted = false;

    this.options.logger?.info({
      event: 'ai_summary_generation_started',
      status: 'pending',
      requestId: summaryRequest.id,
      workspaceId: auth.workspaceId,
      meetingId: meeting.id,
      templateId: meeting.templateId,
      provider: providerName,
      model,
      promptVersion,
      maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
      durationMs: durationMsSince(startedAtMs),
    }, 'AI summary generation started');

    try {
      const allowance = await this.resolveAllowance(auth, now);
      if (!allowance.canGenerate) {
        throw new ApiError(429, 'recap_allowance_exhausted', 'No AI recaps are available right now.', {
          limit: allowance.limit, used: allowance.used, remaining: allowance.remaining,
          resetAt: allowance.periodEndsAt,
        });
      }

      if (this.assistantRepository) {
        reserved = await this.assistantRepository.reserveRecap(
          auth.workspaceId, summaryRequest.id, allowance.periodEndsAt, allowance.limit,
        );
        if (!reserved) {
          throw new ApiError(429, 'recap_allowance_exhausted', 'No AI recaps are available right now.', {
            limit: allowance.limit, used: allowance.limit, remaining: 0, resetAt: allowance.periodEndsAt,
          });
        }
      }
      const {
        output: providerOutput,
        usage,
        providerRequestId,
        providerDurationMs,
      } = await this.provider.generateMeetingSummary({
        systemPrompt,
        userPrompt: promptPayload,
        model,
        maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
      });
      const allowedParticipantIds = new Set(participants.map((participant) => participant.id));
      const sanitizedProviderOutput = sanitizeSummaryTaskOwnerReferences(
        normalizeSummaryProviderOutput(providerOutput),
        allowedParticipantIds,
      );
      const summary = meetingSummarySchema.parse({
        ...sanitizedProviderOutput,
        id: randomUUID(),
        meetingId: meeting.id,
        createdAt,
      });
      finalizationAttempted = true;
      const finalization = await this.aiRepository.finalizeSummaryGeneration({
        workspaceId: auth.workspaceId,
        requestId: summaryRequest.id,
        meetingId: meeting.id,
        expectedServerRevision: meeting.serverRevision,
        generatedSummary: toJsonValue(summary),
        completedAt: createdAt,
        usage,
      });

      if (finalization.status === 'revision_conflict') {
        await this.failSummaryRequestAndReleaseRecap(
          auth.workspaceId,
          summaryRequest.id,
          createdAt,
          'meeting_update_conflict',
          reserved,
          meeting.id,
        );
        throw new ApiError(
          409,
          'meeting_update_conflict',
          'Meeting changed while saving summary.',
        );
      }

      if (finalization.serverRevision === null || finalization.updatedAt === null) {
        throw new ApiError(
          500,
          'ai_summary_request_finalization_invalid',
          'Unable to finalize AI summary generation.',
        );
      }

      this.options.logger?.info({
        event: 'ai_summary_generation_completed',
        status: 'completed',
        requestId: summaryRequest.id,
        workspaceId: auth.workspaceId,
        meetingId: meeting.id,
        templateId: meeting.templateId,
        provider: providerName,
        model,
        promptVersion,
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        totalTokens: usage?.totalTokens ?? null,
        providerRequestId,
        providerDurationMs,
        durationMs: durationMsSince(startedAtMs),
      }, 'AI summary generation completed');

      return {
        summary,
        disclaimer: AI_SUMMARY_DISCLAIMER,
        generatedAt: createdAt,
        meetingSync: {
          meetingId: finalization.meetingId,
          sourceServerRevision: finalization.sourceServerRevision,
          serverRevision: finalization.serverRevision,
          updatedAt: finalization.updatedAt,
        },
      };
    } catch (error) {
      const providerFailure = isAiSummaryProviderError(error)
        ? error.metadata
        : null;
      const errorCode = providerFailure?.failureClass
        ?? (error instanceof ZodError ? 'invalid_structured_output' : null)
        ?? (isApiError(error) ? error.code : 'ai_summary_generation_failed');

      if (!finalizationAttempted) {
        await this.failSummaryRequestAndReleaseRecap(
          auth.workspaceId,
          summaryRequest.id,
          createdAt,
          errorCode,
          reserved,
          meeting.id,
        );
      }

      this.options.logger?.warn({
        event: 'ai_summary_generation_failed',
        status: 'failed',
        requestId: summaryRequest.id,
        workspaceId: auth.workspaceId,
        meetingId: meeting.id,
        templateId: meeting.templateId,
        provider: providerName,
        model,
        promptVersion,
        errorCode,
        providerFailureClass: providerFailure?.failureClass ?? null,
        providerStatus: providerFailure?.status ?? null,
        providerCode: providerFailure?.providerCode ?? null,
        providerRequestId: providerFailure?.providerRequestId ?? null,
        providerDurationMs: providerFailure?.durationMs ?? null,
        providerInputTokens: providerFailure?.usage?.inputTokens ?? null,
        providerOutputTokens: providerFailure?.usage?.outputTokens ?? null,
        providerTotalTokens: providerFailure?.usage?.totalTokens ?? null,
        durationMs: durationMsSince(startedAtMs),
      }, 'AI summary generation failed');

      if (isApiError(error)) {
        throw error;
      }

      throw new ApiError(
        503,
        'ai_summary_generation_failed',
        'AI summaries are not available right now.',
      );
    }
  }

  private async failSummaryRequestAndReleaseRecap(
    workspaceId: string,
    requestId: string,
    completedAt: string,
    errorCode: string,
    reserved: boolean,
    meetingId: string,
  ) {
    if (reserved && this.assistantRepository) {
      try {
        const released = await this.assistantRepository.releaseRecap(workspaceId, requestId);
        if (!released) {
          this.logCleanupFailure(workspaceId, requestId, meetingId, 'release_recap');
          return;
        }
      } catch {
        this.logCleanupFailure(workspaceId, requestId, meetingId, 'release_recap');
        return;
      }
    }

    try {
      await this.aiRepository.markSummaryRequestFailed(
        workspaceId,
        requestId,
        completedAt,
        errorCode,
      );
    } catch {
      this.logCleanupFailure(workspaceId, requestId, meetingId, 'mark_request_failed');
    }
  }

  private logCleanupFailure(
    workspaceId: string,
    requestId: string,
    meetingId: string,
    operation: 'release_recap' | 'mark_request_failed',
  ) {
    this.options.logger?.warn({
      event: 'ai_summary_generation_cleanup_failed',
      status: 'failed',
      workspaceId,
      requestId,
      meetingId,
      operation,
      errorCode: 'ai_summary_generation_cleanup_failed',
    }, 'AI summary generation cleanup failed');
  }

  private async resolveAllowance(auth: AuthContext, now: Date) {
    if (!this.assistantRepository || !this.subscriptionsRepository) {
      return recapAllowanceForPlan({ planType: auth.planType, expiresAt: null, used: 0, role: auth.role });
    }
    const subscription = await this.subscriptionsRepository.findCurrentSubscriptionForWorkspace(auth.workspaceId) as SubscriptionDto | null;
    const planType = hasTrustedPremiumEntitlement(subscription, now)
      ? 'premium'
      : 'free';
    const periodEndsAt = planType === 'premium' ? subscription?.expiresAt ?? null : null;
    const used = await this.assistantRepository.countUsedRecaps(auth.workspaceId, periodEndsAt);
    return recapAllowanceForPlan({ planType, expiresAt: periodEndsAt, used, role: auth.role });
  }

}

export function createDefaultAiSummaryService(
  supabase: ConstructorParameters<typeof AiRepository>[0],
  provider: AiSummaryProvider,
  options: AiSummaryServiceOptions,
) {
  return new AiSummaryService(
    new AiRepository(supabase),
    new MeetingsRepository(supabase),
    new ParticipantsRepository(supabase),
    provider,
    options,
    new AssistantRepository(supabase),
    new SubscriptionsRepository(supabase),
  );
}
