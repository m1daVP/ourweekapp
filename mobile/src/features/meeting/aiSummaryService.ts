import type { Meeting, MeetingSummary, MeetingSummaryTask } from './types';
import { generateAiMeetingSummary } from '@/shared/api/aiApi';
import type { AiMeetingSummaryDto, AiMeetingSyncDto } from '@/shared/api/aiApi';
import { ApiClientError } from '@/shared/api/httpClient';
import { i18n, translate } from '@/features/localization/i18n';
import { useSubscriptionStore } from '@/app/stores/subscription';
import { useMeetingsStore } from '@/app/stores/meetings';
import { listMeetings } from '@/shared/api/meetingsApi';
import {
  AiMeetingSyncRequiredError,
  syncCompletedMeetingForAi,
} from '@/shared/services/syncService';
import { cloneMeeting } from './meetingSyncSnapshot';

// Backend's OpenAI call worst-case is ~30-32s (15s timeout x 2 attempts +
// backoff, see openai.client.ts) — keep this above that so the backend
// always gives up before the client does.
const backendAiSummaryTimeoutMs = 45000;

export class AiRecapUnavailableError extends Error {
  constructor() {
    super('Recap allowance is unavailable.');
    this.name = 'AiRecapUnavailableError';
  }
}

export function isRecapAllowanceExhausted(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    error.status === 429 &&
    error.code === 'recap_allowance_exhausted'
  );
}

export type AiQuotaScope = 'user' | 'workspace';

export interface AiQuotaInfo {
  scope: AiQuotaScope;
  limit: number;
  resetAt: string;
}

export type AiRecapRecoveryKind =
  | 'allowanceExhausted'
  | 'hourlyLimit'
  | 'syncRequired'
  | 'offline'
  | 'revisionConflict'
  | 'providerUnavailable'
  | 'configurationUnavailable'
  | 'timeout'
  | 'unknown';

export interface AiRecapRecovery {
  kind: AiRecapRecoveryKind;
  messageKey: string;
  messageParams: Record<string, string | number>;
  retryable: boolean;
  requestId?: string;
}

function isAiQuotaScope(value: unknown): value is AiQuotaScope {
  return value === 'user' || value === 'workspace';
}

export function parseAiQuotaError(error: unknown): AiQuotaInfo | null {
  if (
    !(error instanceof ApiClientError) ||
    error.status !== 429 ||
    error.code !== 'ai_summary_rate_limited'
  ) {
    return null;
  }

  const details = error.details as Record<string, unknown> | undefined;
  const scope = details?.scope;
  const resetAt = details?.resetAt;

  if (!isAiQuotaScope(scope) || typeof resetAt !== 'string') {
    return null;
  }

  const limit = details?.[scope === 'user' ? 'userLimit' : 'workspaceLimit'];

  if (typeof limit !== 'number') {
    return null;
  }

  return { scope, limit, resetAt };
}

export function formatAiQuotaMessage(info: AiQuotaInfo): string {
  const resetTime = formatAiQuotaResetTime(info.resetAt);

  const key =
    info.scope === 'user'
      ? 'ai.quotaUserLimitReached'
      : 'ai.quotaWorkspaceLimitReached';

  return translate(key, { count: info.limit, resetTime });
}

export function getAiQuotaMessage(error: unknown): string | null {
  const info = parseAiQuotaError(error);
  return info ? formatAiQuotaMessage(info) : null;
}

function createRecovery(
  kind: AiRecapRecoveryKind,
  messageKey: string,
  retryable: boolean,
  error?: unknown,
  messageParams: Record<string, string | number> = {}
): AiRecapRecovery {
  return {
    kind,
    messageKey,
    messageParams,
    retryable,
    ...(error instanceof ApiClientError && error.requestId
      ? { requestId: error.requestId }
      : {}),
  };
}

function formatAiQuotaResetTime(resetAt: string) {
  return new Intl.DateTimeFormat(i18n.global.locale.value, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(resetAt));
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isOfflineOrNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }

  return error instanceof TypeError;
}

export function getAiRecapRecovery(error: unknown): AiRecapRecovery {
  if (isRecapAllowanceExhausted(error)) {
    return createRecovery(
      'allowanceExhausted',
      'ai.recap.recovery.allowanceExhausted',
      false,
      error
    );
  }

  const quota = parseAiQuotaError(error);
  if (quota) {
    return createRecovery(
      'hourlyLimit',
      quota.scope === 'user'
        ? 'ai.quotaUserLimitReached'
        : 'ai.quotaWorkspaceLimitReached',
      false,
      error,
      { count: quota.limit, resetTime: formatAiQuotaResetTime(quota.resetAt) }
    );
  }

  if (error instanceof AiMeetingSyncRequiredError) {
    return createRecovery(
      error.reason === 'offline' ? 'offline' : 'syncRequired',
      error.reason === 'offline'
        ? 'ai.recap.recovery.offline'
        : 'ai.recap.recovery.syncRequired',
      true
    );
  }

  if (error instanceof ApiClientError) {
    if (error.code === 'meeting_update_conflict') {
      return createRecovery(
        'revisionConflict',
        'ai.recap.recovery.revisionConflict',
        true,
        error
      );
    }

    if (error.code === 'ai_provider_not_configured') {
      return createRecovery(
        'configurationUnavailable',
        'ai.recap.recovery.configurationUnavailable',
        false,
        error
      );
    }

    if (error.status === 503) {
      return createRecovery(
        'providerUnavailable',
        'ai.recap.recovery.providerUnavailable',
        true,
        error
      );
    }
  }

  if (isAbortError(error)) {
    return createRecovery('timeout', 'ai.recap.recovery.timeout', true);
  }

  if (isOfflineOrNetworkError(error)) {
    return createRecovery('offline', 'ai.recap.recovery.offline', true);
  }

  return createRecovery('unknown', 'ai.recap.recovery.unknown', false);
}

export function getAiSummaryPromptContract() {
  return i18n.global.tm('ai.promptContract') as string[];
}

function normalizeBackendSummaryTask(
  task: AiMeetingSummaryDto['tasks'][number]
): MeetingSummaryTask {
  return {
    title: task.title,
    responsibilityType: 'needsDiscussion',
    responsibleParticipantIds: task.responsibleParticipantIds ?? [],
    ...(task.dueDate ? { dueDate: task.dueDate } : {}),
    status: 'open',
  };
}

function isBackendSummaryTask(
  value: unknown
): value is AiMeetingSummaryDto['tasks'][number] {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const task = value as Partial<AiMeetingSummaryDto['tasks'][number]>;

  return (
    typeof task.title === 'string' &&
    (!task.responsibleParticipantIds ||
      task.responsibleParticipantIds.every(
        (participantId) => typeof participantId === 'string'
      )) &&
    (!task.dueDate || typeof task.dueDate === 'string')
  );
}

function normalizeBackendSummary(
  summary: AiMeetingSummaryDto,
  meetingId: string
): MeetingSummary {
  if (summary.meetingId !== meetingId) {
    throw new Error('AI summary did not match the completed meeting.');
  }

  const tasks = Array.isArray(summary.tasks)
    ? summary.tasks.filter(isBackendSummaryTask)
    : [];

  return {
    ...summary,
    tasks: tasks.map(normalizeBackendSummaryTask),
  };
}

async function generateBackendAiSummary(
  meetingId: string,
  expectedServerRevision: number
) {
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(
    () => abortController.abort(),
    backendAiSummaryTimeoutMs
  );

  try {
    return await generateAiMeetingSummary(
      {
        meetingId,
        locale: i18n.global.locale.value,
        expectedServerRevision,
      },
      { signal: abortController.signal }
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function generateMeetingSummary(meeting: Meeting) {
  const subscription = useSubscriptionStore();
  const epoch = subscription.subscriptionEpoch;
  const isCurrentSession = () => subscription.subscriptionEpoch === epoch;
  if (!subscription.canGenerateAssistantRecap)
    throw new AiRecapUnavailableError();
  const acknowledged = await syncCompletedMeetingForAi(meeting.id);
  if (!isCurrentSession() || !subscription.canGenerateAssistantRecap) {
    throw new AiRecapUnavailableError();
  }
  if (!Number.isInteger(acknowledged.serverRevision)) {
    throw new Error('AI summary requires an acknowledged server revision.');
  }
  const source = cloneMeeting(acknowledged);
  let refreshAllowance = false;
  try {
    const response = await generateBackendAiSummary(
      meeting.id,
      acknowledged.serverRevision!
    );
    refreshAllowance = true;
    if (!isCurrentSession()) throw new AiRecapUnavailableError();
    const summary = normalizeBackendSummary(response.summary, meeting.id);
    let meetingSync = response.meetingSync;

    if (!meetingSync) {
      const authoritative = (await listMeetings()).meetings.find(
        (item) => item.id === meeting.id
      );
      if (
        !authoritative?.aiSummary ||
        authoritative.aiSummary.id !== summary.id ||
        !Number.isInteger(authoritative.serverRevision)
      ) {
        throw new Error('AI summary could not be synchronized.');
      }
      meetingSync = {
        meetingId: meeting.id,
        sourceServerRevision: source.serverRevision!,
        serverRevision: authoritative.serverRevision!,
        updatedAt: authoritative.updatedAt,
      } satisfies AiMeetingSyncDto;
    }

    if (!isCurrentSession()) throw new AiRecapUnavailableError();
    const applied = useMeetingsStore().applyRemoteAiSummary(
      source,
      summary,
      meetingSync
    );
    if (!applied)
      throw new Error('Meeting changed while applying the AI summary.');

    return summary;
  } catch (error) {
    if (isRecapAllowanceExhausted(error)) refreshAllowance = true;
    throw error;
  } finally {
    if (refreshAllowance && isCurrentSession()) {
      subscription.invalidateAssistantRecap();
      try {
        await subscription.refreshCurrentPlan();
      } catch {
        // Preserve the generation result/error even if a refresh implementation rejects.
        if (isCurrentSession()) subscription.invalidateAssistantRecap();
      }
    }
  }
}
