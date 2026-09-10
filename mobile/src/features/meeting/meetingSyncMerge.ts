import type { Meeting } from './types';
import { cloneMeeting, meetingSyncContent } from './meetingSyncSnapshot';

export interface MeetingSyncRecord {
  pendingUploads?: string[];
  acknowledged?: { revision: number; content: string };
  recoveryVersions?: Meeting[];
}
export type MeetingSyncRecords = Record<string, MeetingSyncRecord>;

export function acknowledgeMeeting(
  record: MeetingSyncRecord,
  remote: Meeting
): MeetingSyncRecord {
  if (!Number.isInteger(remote.serverRevision)) return record;
  return {
    ...record,
    pendingUploads: [],
    acknowledged: {
      revision: remote.serverRevision!,
      content: meetingSyncContent(remote),
    },
  };
}

export function preserveMeetingVersion(
  record: MeetingSyncRecord,
  meeting: Meeting
): MeetingSyncRecord {
  const versions = record.recoveryVersions ?? [];
  if (
    versions.some(
      (version) =>
        meetingSyncContent(version) === meetingSyncContent(meeting) &&
        version.aiSummary?.id === meeting.aiSummary?.id
    )
  )
    return record;
  return { ...record, recoveryVersions: [...versions, cloneMeeting(meeting)] };
}

// The API omits local bookkeeping fields from nested records. Retain those
// fields by ID, without restoring deleted/cleared server-owned fields.
function withLocalFields(local: Meeting, remote: Meeting): Meeting {
  return {
    ...remote,
    sections: remote.sections.map((section) => {
      const previous = local.sections.find((item) => item.id === section.id);
      return {
        ...section,
        notes: section.notes.map((note) => ({
          ...note,
          sectionId: section.id,
        })),
        tasks: section.tasks.map((task) => {
          const old = previous?.tasks.find((item) => item.id === task.id);
          return {
            ...task,
            sectionId: section.id,
            createdAt: task.createdAt ?? old?.createdAt ?? remote.createdAt,
            updatedAt: task.updatedAt ?? old?.updatedAt ?? remote.updatedAt,
            responsibleUserIds:
              task.responsibleUserIds ?? old?.responsibleUserIds,
            carriedFromTaskId: task.carriedFromTaskId ?? old?.carriedFromTaskId,
            completedAt:
              task.completedAt ??
              (task.status === old?.status ? old?.completedAt : undefined),
          };
        }),
        agreements: section.agreements.map((agreement) => ({
          ...agreement,
          sectionId: section.id,
          createdAt:
            agreement.createdAt ??
            previous?.agreements.find((item) => item.id === agreement.id)
              ?.createdAt ??
            remote.createdAt,
        })),
      };
    }),
  };
}

export function mergeHydratedMeeting(
  local: Meeting,
  remote: Meeting,
  record: MeetingSyncRecord
) {
  const localContent = meetingSyncContent(local);
  const remoteContent = meetingSyncContent(remote);
  const localRevision = local.serverRevision ?? 0;
  const remoteRevision = remote.serverRevision ?? 0;
  if (remoteRevision < localRevision) return { meeting: local, record };
  if (localContent === remoteContent) {
    return {
      meeting: {
        ...local,
        serverRevision: remote.serverRevision,
        aiSummary: remote.aiSummary ?? local.aiSummary,
        updatedAt: remote.updatedAt,
      },
      record: acknowledgeMeeting(record, remote),
    };
  }
  if (
    !local.deletedAt &&
    !remote.deletedAt &&
    ((record.acknowledged?.content === remoteContent &&
      record.acknowledged.revision === localRevision) ||
      record.pendingUploads?.includes(remoteContent)) &&
    remoteRevision >= localRevision
  ) {
    return {
      meeting: { ...local, serverRevision: remote.serverRevision },
      record: acknowledgeMeeting(record, remote),
    };
  }
  if (
    record.acknowledged?.content === localContent &&
    record.acknowledged.revision === localRevision &&
    remoteRevision > localRevision
  ) {
    return {
      meeting: withLocalFields(local, remote),
      record: acknowledgeMeeting(preserveMeetingVersion(record, local), remote),
    };
  }
  // Without an acknowledged base, even a later server timestamp proves nothing
  // about local edits. Keep both versions until a safe acknowledgement/resolution.
  return { meeting: local, record: preserveMeetingVersion(record, remote) };
}
