import type { MeetingSection, MeetingSectionId, MeetingTask } from './types';

export type SavedMeetingItemKind = 'notes' | 'tasks' | 'agreements';
export type SavedMeetingSectionStatus = 'filled' | 'empty';

export interface SavedMeetingItemRow {
  id: string;
  title: string;
  leadingMeta?: string;
  trailingMeta?: string;
  detail?: string;
  badge?: string;
}

export interface SavedMeetingItemGroup {
  kind: SavedMeetingItemKind;
  rows: SavedMeetingItemRow[];
}

export interface SavedMeetingSectionViewModel {
  id: MeetingSectionId;
  title: string;
  prompt: string;
  status: SavedMeetingSectionStatus;
  groups: SavedMeetingItemGroup[];
}

export interface SavedMeetingFormatters {
  formatNoteDate: (value: string) => string;
  getParticipantName: (participantId?: string) => string;
  getTaskStatusLabel: (status: MeetingTask['status']) => string;
  getTaskResponsibleLabel: (task: MeetingTask) => string;
  formatDueDate: (value: string) => string;
}

export function hasSavedSectionContent(section: MeetingSection) {
  return Boolean(
    section.notes.length || section.tasks.length || section.agreements.length
  );
}

export function splitSavedMeetingSections(sections: MeetingSection[]) {
  const finalSection =
    sections.find((section) => section.id === 'finalAgreements') ?? null;

  return {
    regularSections: sections.filter(
      (section) => section.id !== 'finalAgreements'
    ),
    finalSection,
  };
}

export function createSavedMeetingSectionViewModel(
  section: MeetingSection,
  formatters: SavedMeetingFormatters
): SavedMeetingSectionViewModel {
  const groups: SavedMeetingItemGroup[] = [];

  if (section.notes.length) {
    groups.push({
      kind: 'notes',
      rows: section.notes.map((note) => ({
        id: note.id,
        title: note.text,
        leadingMeta: formatters.getParticipantName(note.participantId),
        trailingMeta: formatters.formatNoteDate(note.createdAt),
      })),
    });
  }

  if (section.tasks.length) {
    groups.push({
      kind: 'tasks',
      rows: section.tasks.map((task) => {
        const detailParts = [
          task.description?.trim(),
          task.dueDate ? formatters.formatDueDate(task.dueDate) : undefined,
        ].filter((value): value is string => Boolean(value));

        return {
          id: task.id,
          title: task.title,
          detail: detailParts.length ? detailParts.join(' · ') : undefined,
          badge: `${formatters.getTaskStatusLabel(task.status)} • ${formatters.getTaskResponsibleLabel(task)}`,
        };
      }),
    });
  }

  if (section.agreements.length) {
    groups.push({
      kind: 'agreements',
      rows: section.agreements.map((agreement) => ({
        id: agreement.id,
        title: agreement.text,
        leadingMeta: agreement.participantIds.length
          ? agreement.participantIds
              .map(formatters.getParticipantName)
              .join(', ')
          : formatters.getParticipantName(),
      })),
    });
  }

  return {
    id: section.id,
    title: section.title,
    prompt: section.prompt,
    status: hasSavedSectionContent(section) ? 'filled' : 'empty',
    groups,
  };
}
