import type { Meeting } from './types';

export const AI_RECAP_MIN_DISCUSSION_SIGNALS = 2;
export const AI_RECAP_MIN_DISCUSSION_SECTIONS = 2;

export type AiRecapContentReadiness = {
  isReady: boolean;
  discussionSignalCount: number;
  sectionCount: number;
};

export function getAiRecapContentReadiness(
  meeting: Meeting
): AiRecapContentReadiness {
  let discussionSignalCount = 0;
  let sectionCount = 0;

  for (const section of meeting.sections) {
    const sectionSignals =
      section.notes.filter((note) => note.text.trim().length > 0).length +
      section.agreements.filter((agreement) => agreement.text.trim().length > 0)
        .length;

    if (sectionSignals > 0) {
      discussionSignalCount += sectionSignals;
      sectionCount += 1;
    }
  }

  return {
    isReady:
      discussionSignalCount >= AI_RECAP_MIN_DISCUSSION_SIGNALS &&
      sectionCount >= AI_RECAP_MIN_DISCUSSION_SECTIONS,
    discussionSignalCount,
    sectionCount,
  };
}
