import type { Meeting, MeetingSummary, MeetingSummaryTask } from './types';
import { generateAiMeetingSummary } from '@/shared/api/aiApi';
import type { AiMeetingSummaryDto } from '@/shared/api/aiApi';
import { i18n } from '@/features/localization/i18n';

const backendAiSummaryTimeoutMs = 20000;

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
