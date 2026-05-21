import type { Participant } from '@/features/participants/types';
import type { TaskResponsibilityType } from '@/features/tasks/types';

export type MeetingStatus = 'draft' | 'in_progress' | 'completed';

export type MeetingTaskStatus = 'open' | 'done' | 'skipped';

export type MeetingSectionId =
  | 'goodThings'
  | 'tensions'
  | 'tasks'
  | 'money'
  | 'familyCare'
  | 'plans'
  | 'finalAgreements';

export type { Participant };

export interface MeetingNote {
  id: string;
  sectionId: MeetingSectionId;
  participantId: string;
  text: string;
  createdAt: string;
}

export interface MeetingTask {
  id: string;
  sectionId: MeetingSectionId;
  title: string;
  description?: string;
  responsibilityType: TaskResponsibilityType;
  responsibleParticipantIds: string[];
  dueDate?: string;
  status: MeetingTaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface MeetingSummaryTask {
  title: string;
  description?: string;
  responsibilityType: TaskResponsibilityType;
  responsibleParticipantIds: string[];
  dueDate?: string;
  status: MeetingTaskStatus;
}

export interface MeetingSummary {
  id: string;
  meetingId: string;
  shortSummary: string;
  mainTopics: string[];
  keyTensions: string[];
  agreements: string[];
  tasks: MeetingSummaryTask[];
  suggestedNextMeetingFocus: string[];
  createdAt: string;
}

export interface Agreement {
  id: string;
  sectionId: MeetingSectionId;
  text: string;
  participantIds: string[];
  createdAt: string;
}

export interface MeetingSection {
  id: MeetingSectionId;
  title: string;
  prompt: string;
  notes: MeetingNote[];
  tasks: MeetingTask[];
  agreements: Agreement[];
}

export interface Meeting {
  id: string;
  title: string;
  status: MeetingStatus;
  participantIds: string[];
  sections: MeetingSection[];
  currentSectionIndex: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  aiSummary?: MeetingSummary;
}
