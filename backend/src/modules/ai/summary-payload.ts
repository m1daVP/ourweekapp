import { ApiError } from '../../shared/errors/index.js';
import { sanitizeSummarySections } from './summary-source.js';
import type { JsonValue } from '../../shared/repositories/index.js';
import type { MeetingDto as MeetingRepositoryDto } from '../meetings/meetings.repository.js';

export const SUMMARY_INPUT_MAX_CHARS = 12_000;
export const SUMMARY_MIN_DISCUSSION_SIGNALS = 2;
export const SUMMARY_MIN_DISCUSSION_SECTIONS = 2;

export type SummaryPromptParticipant = {
  id: string;
  name: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

  for (const section of sanitizeSummarySections(sections)) {
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
    completedAt: meeting.completedAt ?? null,
    locale: locale ?? 'en',
    participants: orderParticipantsForPrompt(meeting, participants),
    steps: sanitizeSummarySections(meeting.sections),
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
