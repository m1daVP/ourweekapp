import { ApiError } from '../../shared/errors/index.js';
import { isPrivateMarkedObject } from '../../shared/privacy/index.js';
import type { JsonValue } from '../../shared/repositories/index.js';
import type { MeetingDto as MeetingRepositoryDto } from '../meetings/meetings.repository.js';

export const SUMMARY_INPUT_MAX_CHARS = 12_000;
export const SUMMARY_MIN_DISCUSSION_SIGNALS = 2;
export const SUMMARY_MIN_DISCUSSION_SECTIONS = 2;

export type SummaryPromptParticipant = {
  id: string;
  name: string;
};

type SanitizedMeetingStep = {
  title?: string;
  prompt?: string;
  notes: Array<{ participantId?: string; text: string }>;
  tasks: Array<{
    title: string;
    description?: string;
    responsibilityType?: string;
    responsibleParticipantIds?: string[];
    dueDate?: string;
    status?: string;
  }>;
  agreements: Array<{
    text: string;
    description?: string;
    participantIds?: string[];
  }>;
};

function trimmedString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter((item): item is string => typeof item === 'string');

  return items.length > 0 ? items : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeNotes(value: JsonValue | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  const notes: SanitizedMeetingStep['notes'] = [];

  for (const item of value) {
    if (!isJsonObject(item) || isPrivateMarkedObject(item)) {
      continue;
    }

    const text = trimmedString(item.text);

    if (!text) {
      continue;
    }

    const participantId = trimmedString(item.participantId);

    notes.push({
      ...(participantId ? { participantId } : {}),
      text,
    });
  }

  return notes;
}

function sanitizeTasks(value: JsonValue | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  const tasks: SanitizedMeetingStep['tasks'] = [];

  for (const item of value) {
    if (!isJsonObject(item) || isPrivateMarkedObject(item)) {
      continue;
    }

    const title = trimmedString(item.title);

    if (!title) {
      continue;
    }

    const description = trimmedString(item.description);
    const responsibilityType = trimmedString(item.responsibilityType);
    const responsibleParticipantIds = stringArray(item.responsibleParticipantIds);
    const dueDate = trimmedString(item.dueDate);
    const status = trimmedString(item.status);

    tasks.push({
      title,
      ...(description ? { description } : {}),
      ...(responsibilityType ? { responsibilityType } : {}),
      ...(responsibleParticipantIds ? { responsibleParticipantIds } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(status ? { status } : {}),
    });
  }

  return tasks;
}

function sanitizeAgreements(value: JsonValue | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  const agreements: SanitizedMeetingStep['agreements'] = [];

  for (const item of value) {
    if (!isJsonObject(item) || isPrivateMarkedObject(item)) {
      continue;
    }

    const text = trimmedString(item.text) ?? trimmedString(item.title);

    if (!text) {
      continue;
    }

    const description = trimmedString(item.description);
    const participantIds = stringArray(item.participantIds);

    agreements.push({
      text,
      ...(description ? { description } : {}),
      ...(participantIds ? { participantIds } : {}),
    });
  }

  return agreements;
}

function sanitizeSectionsForAi(sections: JsonValue[]): SanitizedMeetingStep[] {
  const sanitized: SanitizedMeetingStep[] = [];

  for (const section of sections) {
    if (!isJsonObject(section)) {
      continue;
    }

    const title = trimmedString(section.title);
    const prompt = trimmedString(section.prompt);

    sanitized.push({
      ...(title ? { title } : {}),
      ...(prompt ? { prompt } : {}),
      notes: sanitizeNotes(section.notes),
      tasks: sanitizeTasks(section.tasks),
      agreements: sanitizeAgreements(section.agreements),
    });
  }

  return sanitized;
}

export type SummaryContentReadiness = {
  isReady: boolean;
  discussionSignalCount: number;
  sectionCount: number;
};

export function getSummaryContentReadiness(
  sections: JsonValue[],
): SummaryContentReadiness {
  let discussionSignalCount = 0;
  let sectionCount = 0;

  for (const section of sanitizeSectionsForAi(sections)) {
    const sectionSignals = section.notes.length + section.agreements.length;

    if (sectionSignals > 0) {
      sectionCount += 1;
      discussionSignalCount += sectionSignals;
    }
  }

  return {
    isReady:
      discussionSignalCount >= SUMMARY_MIN_DISCUSSION_SIGNALS &&
      sectionCount >= SUMMARY_MIN_DISCUSSION_SECTIONS,
    discussionSignalCount,
    sectionCount,
  };
}

function orderParticipantsForPrompt(
  meeting: MeetingRepositoryDto,
  participants: SummaryPromptParticipant[],
) {
  const participantsById = new Map(
    participants.map((participant) => [participant.id, participant.name]),
  );

  return meeting.participantIds.flatMap((participantId) => {
    const name = participantsById.get(participantId);

    return name ? [{ id: participantId, name }] : [];
  });
}

export function buildSummaryPromptPayload(
  meeting: MeetingRepositoryDto,
  participants: SummaryPromptParticipant[],
  locale?: string,
) {
  const payload = {
    templateId: meeting.templateId,
    locale: locale ?? 'en',
    participants: orderParticipantsForPrompt(meeting, participants),
    steps: sanitizeSectionsForAi(meeting.sections),
  };
  const serialized = JSON.stringify(payload);

  if (serialized.length > SUMMARY_INPUT_MAX_CHARS) {
    throw new ApiError(
      422,
      'ai_summary_input_too_large',
      'Meeting content is too large to summarize safely.',
      { limit: SUMMARY_INPUT_MAX_CHARS },
    );
  }

  return serialized;
}

export function normalizeSummaryProviderOutput(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  if (!Array.isArray(value.tasks)) {
    return value;
  }

  return {
    ...value,
    tasks: value.tasks.map((task) => {
      if (!isRecord(task)) {
        return task;
      }

      const normalizedTask = { ...task };

      if (normalizedTask.responsibleParticipantIds === null) {
        delete normalizedTask.responsibleParticipantIds;
      }

      if (normalizedTask.dueDate === null) {
        delete normalizedTask.dueDate;
      }

      return normalizedTask;
    }),
  };
}
