import type { Meeting } from './types';

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  );
}

export function meetingSyncContent(meeting: Meeting) {
  return JSON.stringify({
    id: meeting.id,
    templateId: meeting.templateId,
    title: meeting.title,
    status: meeting.status,
    participantIds: meeting.participantIds,
    checkInCompleted: meeting.checkInCompleted,
    sections: meeting.sections.map((section) =>
      compact({
        id: section.id,
        title: section.title,
        prompt: section.prompt,
        notes: section.notes.map((note) =>
          compact({
            id: note.id,
            participantId: note.participantId,
            text: note.text,
            createdAt: note.createdAt,
          })
        ),
        tasks: section.tasks.map((task) =>
          compact({
            id: task.id,
            title: task.title,
            description: task.description,
            responsibilityType: task.responsibilityType,
            responsibleParticipantIds: task.responsibleParticipantIds,
            dueDate: task.dueDate,
            status: task.status,
          })
        ),
        agreements: section.agreements.map((agreement) =>
          compact({
            id: agreement.id,
            text: agreement.text,
            participantIds: agreement.participantIds,
          })
        ),
      })
    ),
    currentSectionIndex: meeting.currentSectionIndex,
    createdAt: meeting.createdAt,
    completedAt: meeting.completedAt,
  });
}

export function meetingLocalSnapshot(meeting: Meeting) {
  return JSON.stringify(meeting);
}

export function cloneMeeting(meeting: Meeting): Meeting {
  return JSON.parse(JSON.stringify(meeting)) as Meeting;
}
