// Protocol v1: mirrored in the mobile app's summarySource.ts. Keep serialization identical.
export type SummarySourceMeeting = {
  templateId: string;
  participantIds: string[];
  completedAt?: string | null;
  sections: unknown[];
};

type RecordValue = Record<string, unknown>;
function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function publicRecord(value: unknown): value is RecordValue {
  return (
    record(value) &&
    value.private !== true &&
    value.isPrivate !== true &&
    value.visibility !== 'private' &&
    value.type !== 'private'
  );
}
function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function strings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value.filter(
    (item): item is string => typeof item === 'string'
  );
  return result.length ? result : undefined;
}

export function sanitizeSummarySections(sections: unknown[]) {
  return sections.flatMap((section, sectionIndex) => {
    if (!publicRecord(section)) return [];
    const sourceRef = `s${sectionIndex}`;
    const items = (key: string) =>
      Array.isArray(section[key]) ? section[key] : [];
    return [
      {
        sourceRef,
        sectionIndex,
        id: text(section.id),
        title: text(section.title),
        prompt: text(section.prompt),
        notes: items('notes').flatMap((note: unknown, index: number) => {
          if (!publicRecord(note) || !text(note.text)) return [];
          return [
            {
              sourceRef: `${sourceRef}.n${index}`,
              id: text(note.id),
              participantId: text(note.participantId),
              text: text(note.text)!,
            },
          ];
        }),
        tasks: items('tasks').flatMap((task: unknown, index: number) => {
          if (!publicRecord(task) || !text(task.title)) return [];
          return [
            {
              sourceRef: `${sourceRef}.t${index}`,
              id: text(task.id),
              title: text(task.title)!,
              description: text(task.description),
              responsibilityType: text(task.responsibilityType),
              responsibleParticipantIds: strings(
                task.responsibleParticipantIds
              ),
              dueDate: text(task.dueDate),
              status: text(task.status),
            },
          ];
        }),
        agreements: items('agreements').flatMap(
          (agreement: unknown, index: number) => {
            if (
              !publicRecord(agreement) ||
              !(text(agreement.text) ?? text(agreement.title))
            )
              return [];
            return [
              {
                sourceRef: `${sourceRef}.a${index}`,
                id: text(agreement.id),
                text: (text(agreement.text) ?? text(agreement.title))!,
                description: text(agreement.description),
                participantIds: strings(agreement.participantIds),
              },
            ];
          }
        ),
      },
    ];
  });
}

export function buildSummarySourceSnapshot(meeting: SummarySourceMeeting) {
  return {
    version: 1,
    templateId: meeting.templateId,
    participantIds: meeting.participantIds,
    completedAt: meeting.completedAt
      ? new Date(meeting.completedAt).toISOString()
      : null,
    steps: sanitizeSummarySections(meeting.sections),
  };
}
