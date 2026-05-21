export type TaskStatus = 'open' | 'done' | 'skipped';

export type TaskResponsibilityType =
  | 'participant'
  | 'shared'
  | 'needsDiscussion';

export interface Task {
  id: string;
  title: string;
  description?: string;
  responsibilityType: TaskResponsibilityType;
  responsibleParticipantIds: string[];
  dueDate?: string;
  status: TaskStatus;
  sourceMeetingId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agreement {
  id: string;
  title: string;
  description?: string;
  participantIds: string[];
  relatedTaskIds?: string[];
  sourceMeetingId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskReviewDecision {
  meetingId: string;
  sourceMeetingId: string;
  decidedAt: string;
}
