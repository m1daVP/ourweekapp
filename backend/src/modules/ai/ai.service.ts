import { createHash, randomUUID } from 'node:crypto';

import { requireMinimumRole, type AuthContext } from '../../shared/auth/index.js';
import { ApiError, isApiError } from '../../shared/errors/index.js';
import type { JsonValue } from '../../shared/repositories/index.js';
import { MeetingsRepository } from '../meetings/meetings.repository.js';
import { ParticipantsRepository } from '../participants/participants.repository.js';
import { AssistantRepository } from '../assistant/assistant.repository.js';
import { SubscriptionsRepository, type SubscriptionDto } from '../billing/subscriptions.repository.js';
import { resolveEffectivePlan } from '../../shared/repositories/index.js';
import { recapAllowanceForPlan } from '../billing/plan-limits.js';
import { meetingSummarySchema, type AiMeetingSummaryRequestDto } from './ai.schema.js';
import { AiRepository } from './ai.repository.js';
import type { AiSummaryProvider } from './openai.client.js';
import {
  buildSummaryPromptPayload,
  normalizeSummaryProviderOutput,
} from './summary-payload.js';
import {
  buildSummarySystemPrompt,
  resolveSummaryModel,
  SUMMARY_MAX_OUTPUT_TOKENS,
} from './summary-prompts.js';

const AI_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const AI_RATE_LIMIT_PER_USER = 5;
const AI_RATE_LIMIT_PER_WORKSPACE = 20;
const AI_SUMMARY_DISCLAIMER =
  'AI summaries can miss context. Please review before relying on them.';

type AiRepositoryPort = Pick<
  AiRepository,
  | 'claimSummaryGeneration'
  | 'markSummaryRequestCompleted'
  | 'markSummaryRequestFailed'
  | 'countRecentSummaryRequestsForWorkspace'
  | 'countRecentSummaryRequestsForUserInWorkspace'
>;

type MeetingsRepositoryPort = Pick<
  MeetingsRepository,
  'findMeetingByIdForWorkspace' | 'updateMeetingSummary'
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
  | 'settleRecap'
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

function durationMsSince(startedAtMs: number) {
  return Math.max(0, Date.now() - startedAtMs);
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

    const model = resolveSummaryModel(meeting.templateId, this.options.model);

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

    await this.requireWithinRateLimits(auth, now);

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
          maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
          durationMs: durationMsSince(startedAtMs),
          limit: error.details.limit,
        }, 'AI summary generation rejected');
      }

      throw error;
    }
    const systemPrompt = buildSummarySystemPrompt(meeting.templateId);
    const createdAt = now.toISOString();
    const inputHash = shortHash([systemPrompt, promptPayload, model].join('\n\n'));

    const claim = await this.aiRepository.claimSummaryGeneration({
      workspaceId: auth.workspaceId,
      meetingId: meeting.id,
      userId: auth.userId,
      provider: providerName,
      inputHash,
    });

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

    this.options.logger?.info({
      event: 'ai_summary_generation_started',
      status: 'pending',
      requestId: summaryRequest.id,
      workspaceId: auth.workspaceId,
      meetingId: meeting.id,
      templateId: meeting.templateId,
      provider: providerName,
      model,
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
      await this.requireReservedRequestWithinRateLimits(
        auth,
        now,
      );

      const { output: providerOutput, usage } = await this.provider.generateMeetingSummary({
        systemPrompt,
        userPrompt: promptPayload,
        model,
        maxOutputTokens: SUMMARY_MAX_OUTPUT_TOKENS,
      });
      const summary = meetingSummarySchema.parse({
        ...normalizeSummaryProviderOutput(providerOutput),
        id: randomUUID(),
        meetingId: meeting.id,
        createdAt,
      });
      const updated = await this.meetingsRepository.updateMeetingSummary(
        auth.workspaceId,
        meeting.id,
        toJsonValue(summary),
        meeting.serverRevision,
      );

      if (!updated) {
        throw new ApiError(
          409,
          'meeting_update_conflict',
          'Meeting changed while saving summary.',
        );
      }

      await this.aiRepository.markSummaryRequestCompleted(
        auth.workspaceId,
        summaryRequest.id,
        now.toISOString(),
        usage,
        toJsonValue(summary),
      );
      if (reserved && this.assistantRepository) {
        await this.assistantRepository.settleRecap(auth.workspaceId, summaryRequest.id);
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
        inputTokens: usage?.inputTokens ?? null,
        outputTokens: usage?.outputTokens ?? null,
        totalTokens: usage?.totalTokens ?? null,
        durationMs: durationMsSince(startedAtMs),
      }, 'AI summary generation completed');

      return {
        summary,
        disclaimer: AI_SUMMARY_DISCLAIMER,
        generatedAt: createdAt,
        meetingSync: {
          meetingId: updated.id,
          sourceServerRevision: meeting.serverRevision,
          serverRevision: updated.serverRevision,
          updatedAt: updated.updatedAt,
        },
      };
    } catch (error) {
      if (reserved && this.assistantRepository) {
        await this.assistantRepository.releaseRecap(auth.workspaceId, summaryRequest.id);
      }
      const errorCode = isApiError(error)
        ? error.code
        : 'ai_summary_generation_failed';

      await this.aiRepository.markSummaryRequestFailed(
        auth.workspaceId,
        summaryRequest.id,
        now.toISOString(),
        errorCode,
      );

      this.options.logger?.warn({
        event: 'ai_summary_generation_failed',
        status: 'failed',
        requestId: summaryRequest.id,
        workspaceId: auth.workspaceId,
        meetingId: meeting.id,
        templateId: meeting.templateId,
        provider: providerName,
        model,
        errorCode,
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

  private async resolveAllowance(auth: AuthContext, now: Date) {
    if (!this.assistantRepository || !this.subscriptionsRepository) {
      return recapAllowanceForPlan({ planType: auth.planType, expiresAt: null, used: 0, role: auth.role });
    }
    const subscription = await this.subscriptionsRepository.findCurrentSubscriptionForWorkspace(auth.workspaceId) as SubscriptionDto | null;
    const planType = resolveEffectivePlan(subscription ? {
      plan_type: subscription.planType, status: subscription.status, expires_at: subscription.expiresAt,
    } : null, now);
    const periodEndsAt = planType === 'premium' ? subscription?.expiresAt ?? null : null;
    const used = await this.assistantRepository.countUsedRecaps(auth.workspaceId, periodEndsAt);
    return recapAllowanceForPlan({ planType, expiresAt: periodEndsAt, used, role: auth.role });
  }

  private async requireWithinRateLimits(auth: AuthContext, now: Date) {
    const since = new Date(now.getTime() - AI_RATE_LIMIT_WINDOW_MS).toISOString();
    const [workspaceCount, userCount] = await Promise.all([
      this.aiRepository.countRecentSummaryRequestsForWorkspace(auth.workspaceId, since),
      this.aiRepository.countRecentSummaryRequestsForUserInWorkspace(
        auth.workspaceId,
        auth.userId,
        since,
      ),
    ]);

    const userExceeded = userCount >= AI_RATE_LIMIT_PER_USER;
    const workspaceExceeded = workspaceCount >= AI_RATE_LIMIT_PER_WORKSPACE;

    if (userExceeded || workspaceExceeded) {
      throw this.buildRateLimitError(now, { userExceeded, workspaceExceeded });
    }
  }

  private async requireReservedRequestWithinRateLimits(
    auth: AuthContext,
    now: Date,
  ) {
    const since = new Date(now.getTime() - AI_RATE_LIMIT_WINDOW_MS).toISOString();
    const [workspaceCount, userCount] = await Promise.all([
      this.aiRepository.countRecentSummaryRequestsForWorkspace(auth.workspaceId, since),
      this.aiRepository.countRecentSummaryRequestsForUserInWorkspace(
        auth.workspaceId,
        auth.userId,
        since,
      ),
    ]);

    const userExceeded = userCount > AI_RATE_LIMIT_PER_USER;
    const workspaceExceeded = workspaceCount > AI_RATE_LIMIT_PER_WORKSPACE;

    if (!userExceeded && !workspaceExceeded) {
      return;
    }

    throw this.buildRateLimitError(now, { userExceeded, workspaceExceeded });
  }

  private buildRateLimitError(
    now: Date,
    { userExceeded }: { userExceeded: boolean; workspaceExceeded: boolean },
  ) {
    const scope: 'user' | 'workspace' = userExceeded ? 'user' : 'workspace';

    return new ApiError(
      429,
      'ai_summary_rate_limited',
      'Please wait before generating another AI summary.',
      {
        userLimit: AI_RATE_LIMIT_PER_USER,
        workspaceLimit: AI_RATE_LIMIT_PER_WORKSPACE,
        windowSeconds: AI_RATE_LIMIT_WINDOW_MS / 1000,
        scope,
        remaining: 0,
        resetAt: new Date(now.getTime() + AI_RATE_LIMIT_WINDOW_MS).toISOString(),
      },
    );
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
