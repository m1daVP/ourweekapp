import type { Participant } from '@/features/participants/types';
import type { TaskResponsibilityType } from '@/features/tasks/types';

export type MeetingStatus =
  'draft' | 'in_progress' | 'paused' | 'incomplete' | 'completed';

export type MeetingTaskStatus = 'open' | 'done' | 'skipped';

export type MeetingSectionId =
  | 'goodThings'
  | 'tensions'
  | 'tasks'
  | 'money'
  | 'familyCare'
  | 'plans'
  | 'finalAgreements'
  | 'appreciation'
  | 'frustrations'
  | 'emotionalLoad'
  | 'timeTogether'
  | 'practicalAgreements'
  | 'childRoutines'
  | 'school'
  | 'health'
  | 'activities'
  | 'parentResponsibilities'
  | 'purchases'
  | 'upcomingExpenses'
  | 'subscriptionsBills'
  | 'savingGoals'
  | 'financialConcerns'
  | 'decisions'
  | 'whatHappened'
  | 'personNeeds'
  | 'whatShouldChange'
  | 'concreteNextStep'
  | 'followUpDate'
  | 'scheduleOverview'
  | 'meals'
  | 'childcare'
  | 'shopping'
  | 'adminTasks'
  | 'backupPlans';

export type MeetingTemplateId =
  | 'weekly-family-check-in'
  | 'couple-reset'
  | 'family-with-kids'
  | 'money-check-in'
  | 'conflict-cleanup'
  | 'busy-week-planning';

export type MeetingTemplateAccess = 'free' | 'premium';

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
  responsibleUserIds?: string[];
  dueDate?: string;
  status: MeetingTaskStatus;
  carriedFromTaskId?: string;
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

export interface MeetingTemplateSection {
  id: MeetingSectionId;
  title: string;
  prompt: string;
}

export interface MeetingTemplate {
  id: MeetingTemplateId;
  name: string;
  description: string;
  access: MeetingTemplateAccess;
  outcomeTagKeys: string[];
  sections: MeetingTemplateSection[];
}

export interface Meeting {
  id: string;
  templateId: MeetingTemplateId;
  title: string;
  status: MeetingStatus;
  participantIds: string[];
  checkInCompleted: boolean;
  sections: MeetingSection[];
  currentSectionIndex: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  aiSummary?: MeetingSummary;
  serverRevision?: number;
  deletedAt?: string;
}
