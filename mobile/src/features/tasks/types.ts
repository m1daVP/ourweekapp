export type TaskStatus = 'open' | 'done' | 'skipped'

export interface Task {
  id: string
  title: string
  description?: string
  responsiblePersonId: string
  dueDate?: string
  status: TaskStatus
  sourceMeetingId?: string
  createdAt: string
  updatedAt: string
}

export interface Agreement {
  id: string
  title: string
  description?: string
  participants: string[]
  relatedTaskIds?: string[]
  sourceMeetingId: string
  createdAt: string
  updatedAt: string
}

export interface TaskReviewDecision {
  meetingId: string
  sourceMeetingId: string
  decidedAt: string
}
