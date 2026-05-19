export type MeetingStatus = 'draft' | 'in_progress' | 'completed'

export type MeetingTaskStatus = 'open' | 'done'

export type MeetingSectionId =
  | 'goodThings'
  | 'tensions'
  | 'tasks'
  | 'money'
  | 'familyCare'
  | 'plans'
  | 'finalAgreements'

export interface Participant {
  id: string
  name: string
}

export interface MeetingNote {
  id: string
  sectionId: MeetingSectionId
  participantId: string
  text: string
  createdAt: string
}

export interface MeetingTask {
  id: string
  sectionId: MeetingSectionId
  title: string
  description?: string
  responsiblePersonId: string
  dueDate?: string
  status: MeetingTaskStatus
  createdAt: string
  completedAt?: string
}

export interface Agreement {
  id: string
  sectionId: MeetingSectionId
  text: string
  createdAt: string
}

export interface MeetingSection {
  id: MeetingSectionId
  title: string
  prompt: string
  notes: MeetingNote[]
  tasks: MeetingTask[]
  agreements: Agreement[]
}

export interface Meeting {
  id: string
  title: string
  status: MeetingStatus
  participants: Participant[]
  sections: MeetingSection[]
  currentSectionIndex: number
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface MeetingSummary {
  id: string
  title: string
  status: MeetingStatus
  updatedAt: string
}
