import type { Meeting, MeetingSummary, MeetingSummaryTask } from './types';
import { generateAiMeetingSummary } from '@/shared/api/aiApi';
import type { AiMeetingSummaryDto } from '@/shared/api/aiApi';
import { ApiClientError } from '@/shared/api/httpClient';
import { i18n, translate } from '@/features/localization/i18n';

// Backend's OpenAI call worst-case is ~30-32s (15s timeout x 2 attempts +
// backoff, see openai.client.ts) — keep this above that so the backend
// always gives up before the client does.
const backendAiSummaryTimeoutMs = 45000;

export type AiQuotaScope = 'user' | 'workspace';

export interface AiQuotaInfo {
  scope: AiQuotaScope;
  limit: number;
  resetAt: string;
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
  const resetTime = new Intl.DateTimeFormat(i18n.global.locale.value, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(info.resetAt));

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

async function generateBackendAiSummary(meetingId: string) {
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
      },
      { signal: abortController.signal }
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function generateMeetingSummary(meeting: Meeting) {
  const response = await generateBackendAiSummary(meeting.id);

  return normalizeBackendSummary(response.summary, meeting.id);
}
