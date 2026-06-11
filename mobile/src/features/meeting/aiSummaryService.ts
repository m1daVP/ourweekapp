import type {
  Meeting,
  MeetingSection,
  MeetingSummary,
  MeetingSummaryTask,
} from './types';
import { generateAiMeetingSummary } from '@/shared/api/aiApi';
import type { AiMeetingSummaryDto } from '@/shared/api/aiApi';
import { appConfig } from '@/shared/config/env';
import { i18n, translate } from '@/features/localization/i18n';
import { getMeetingSectionTitle } from '@/features/meeting/meetingTemplates';

const backendAiSummaryTimeoutMs = 20000;

export interface AiSummaryProvider {
  generateMeetingSummary(meeting: Meeting): Promise<MeetingSummary>;
}

export function getAiSummaryPromptContract() {
  return i18n.global.tm('ai.promptContract') as string[];
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sectionHasContent(section: MeetingSection) {
  return (
    section.notes.length > 0 ||
    section.tasks.length > 0 ||
    section.agreements.length > 0
  );
}

function getMainTopics(meeting: Meeting) {
  const topics = meeting.sections
    .filter(sectionHasContent)
    .map((section) => getMeetingSectionTitle(section.id, section.title));

  return topics.length ? topics : [translate('ai.noTopics')];
}

function getKeyTensions(meeting: Meeting) {
  const tensionsSection = meeting.sections.find(
    (section) => section.id === 'tensions'
  );

  const tensions =
    tensionsSection?.notes.map((note) => note.text.trim()).filter(Boolean) ??
    [];

  return tensions.length ? tensions : [translate('ai.emptyTensions')];
}

function getAgreements(meeting: Meeting) {
  const agreements = meeting.sections
    .flatMap((section) => section.agreements)
    .map((agreement) => agreement.text.trim())
    .filter(Boolean);

  return agreements.length ? agreements : [translate('ai.emptyAgreements')];
}

function getTasks(meeting: Meeting): MeetingSummaryTask[] {
  return meeting.sections.flatMap((section) =>
    section.tasks.map((task) => ({
      title: task.title,
      description: task.description,
      responsibilityType: task.responsibilityType,
      responsibleParticipantIds: task.responsibleParticipantIds,
      dueDate: task.dueDate,
      status: task.status,
    }))
  );
}

function getSuggestedNextMeetingFocus(
  meeting: Meeting,
  tasks: MeetingSummaryTask[]
) {
  const openTasks = tasks
    .filter((task) => task.status === 'open')
    .map((task) => translate('ai.checkProgress', { title: task.title }));
  const plans = meeting.sections
    .find((section) => section.id === 'plans')
    ?.notes.map((note) => note.text.trim())
    .filter(Boolean);

  const focus = [...openTasks, ...(plans ?? [])];
  return focus.length ? focus : [translate('ai.emptyFocus')];
}

function createShortSummary(
  mainTopics: string[],
  agreements: string[],
  tasks: MeetingSummaryTask[]
) {
  const topicLabel =
    mainTopics.length === 1 ? mainTopics[0] : mainTopics.slice(0, 3).join(', ');
  const agreementCount =
    agreements.length === 1 && agreements[0] === translate('ai.emptyAgreements')
      ? 0
      : agreements.length;
  const agreementWord =
    agreementCount === 1
      ? translate('ai.agreementOne')
      : translate('ai.agreementOther');
  const taskWord =
    tasks.length === 1 ? translate('ai.taskOne') : translate('ai.taskOther');

  return translate('ai.shortSummary', {
    topics: topicLabel,
    agreementCount,
    agreementWord,
    taskCount: tasks.length,
    taskWord,
  });
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

const localPlaceholderAiSummaryProvider: AiSummaryProvider = {
  async generateMeetingSummary(meeting) {
    const mainTopics = getMainTopics(meeting);
    const keyTensions = getKeyTensions(meeting);
    const agreements = getAgreements(meeting);
    const tasks = getTasks(meeting);

    return {
      id: createId('meeting-summary'),
      meetingId: meeting.id,
      shortSummary: createShortSummary(mainTopics, agreements, tasks),
      mainTopics,
      keyTensions,
      agreements,
      tasks,
      suggestedNextMeetingFocus: getSuggestedNextMeetingFocus(meeting, tasks),
      createdAt: new Date().toISOString(),
    };
  },
};

const backendAiSummaryProvider: AiSummaryProvider = {
  async generateMeetingSummary(meeting) {
    const response = await generateBackendAiSummary(meeting.id);

    return normalizeBackendSummary(response.summary, meeting.id);
  },
};

let aiSummaryProvider: AiSummaryProvider | null = null;

export function setAiSummaryProvider(provider: AiSummaryProvider) {
  aiSummaryProvider = provider;
}

export function generateMeetingSummary(meeting: Meeting) {
  const provider =
    aiSummaryProvider ??
    (appConfig.isBackendApiEnabled
      ? backendAiSummaryProvider
      : localPlaceholderAiSummaryProvider);

  return provider.generateMeetingSummary(meeting);
}
