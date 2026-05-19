export type TaskStatus = 'open' | 'done'

export interface TaskSummary {
  id: string
  title: string
  status: TaskStatus
}
