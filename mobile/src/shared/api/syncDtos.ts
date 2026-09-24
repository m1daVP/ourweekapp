import type { Meeting } from '@/features/meeting/types';
import type { Participant } from '@/features/participants/types';
import type {
  Agreement,
  Task,
  TaskReviewDecision,
} from '@/features/tasks/types';

export interface SyncMetadataFields {
  serverRevision?: number;
  deletedAt?: string;
}

export type MeetingDto = Meeting & SyncMetadataFields;
export type TaskDto = Task & SyncMetadataFields;
export type AgreementDto = Agreement & SyncMetadataFields;
export type ParticipantDto = Participant & SyncMetadataFields;

export interface SyncConflictDto<TResource> {
  resourceType?: string;
  resourceId?: string;
  reason?: string;
  baseServerRevision?: number;
  serverRevision?: number;
  detectedAt?: string;
  clientVersion?: TResource;
  serverVersion?: TResource;
}

function normalizeServerRevision(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeDeletedAt(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function syncMetadataFields(value: SyncMetadataFields): SyncMetadataFields {
  return {
    serverRevision: normalizeServerRevision(value.serverRevision),
    deletedAt: normalizeDeletedAt(value.deletedAt),
  };
}

export function toMeetingDto(meeting: Meeting): MeetingDto {
  return {
    ...meeting,
    ...syncMetadataFields(meeting),
  };
}

export function fromMeetingDto(meeting: MeetingDto): Meeting {
  return {
    ...meeting,
    checkInCompleted: meeting.checkInCompleted ?? false,
    ...syncMetadataFields(meeting),
  };
}

export function toTaskDto(task: Task): TaskDto {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    responsibilityType: task.responsibilityType,
    responsibleParticipantIds: task.responsibleParticipantIds,
    responsibleUserIds: task.responsibleUserIds,
    dueDate: task.dueDate,
    status: task.status,
    sourceMeetingId: task.sourceMeetingId,
    carriedFromTaskId: task.carriedFromTaskId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    ...syncMetadataFields(task),
  };
}

export function fromTaskDto(task: TaskDto): Task {
  return toTaskDto(task);
}

export function toAgreementDto(agreement: Agreement): AgreementDto {
  return {
    id: agreement.id,
    title: agreement.title,
    description: agreement.description,
    participantIds: agreement.participantIds,
    relatedTaskIds: agreement.relatedTaskIds,
    sourceMeetingId: agreement.sourceMeetingId,
    createdAt: agreement.createdAt,
    updatedAt: agreement.updatedAt,
    ...syncMetadataFields(agreement),
  };
}

export function fromAgreementDto(agreement: AgreementDto): Agreement {
  return toAgreementDto(agreement);
}

export function toParticipantDto(participant: Participant): ParticipantDto {
  return {
    id: participant.id,
    name: participant.name,
    initials: participant.initials,
    avatarColor: participant.avatarColor,
    avatarType: participant.avatarType ?? null,
    type: participant.type,
    isActive: participant.isActive,
    createdAt: participant.createdAt,
    updatedAt: participant.updatedAt,
    ...syncMetadataFields(participant),
  };
}

export function fromParticipantDto(participant: ParticipantDto): Participant {
  const normalizedParticipant: Participant = {
    ...toParticipantDto(participant),
  };

  const email = participant.email?.trim();

  return email ? { ...normalizedParticipant, email } : normalizedParticipant;
}

export function toReviewDecisionDto(
  decision: TaskReviewDecision
): TaskReviewDecision {
  return {
    meetingId: decision.meetingId,
    sourceMeetingId: decision.sourceMeetingId,
    decidedAt: decision.decidedAt,
  };
}
