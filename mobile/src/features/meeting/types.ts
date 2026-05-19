export type MeetingStatus = 'planned' | 'in_progress' | 'completed'

export interface MeetingSummary {
  id: string
  title: string
  status: MeetingStatus
}
