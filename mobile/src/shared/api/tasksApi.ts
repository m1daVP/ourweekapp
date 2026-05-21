import type {
  Agreement,
  Task,
  TaskReviewDecision,
} from '@/features/tasks/types'
import { apiRequest, isBackendApiConfigured } from './httpClient'

export interface TaskDto extends Task {
  serverRevision?: number
  deletedAt?: string
}

export interface AgreementDto extends Agreement {
  serverRevision?: number
  deletedAt?: string
}

export interface SyncTasksRequestDto {
  tasks: TaskDto[]
  agreements: AgreementDto[]
  reviewDecisions: TaskReviewDecision[]
  lastSyncedAt?: string
  clientUpdatedAt: string
}

export interface SyncTasksResponseDto {
  tasks: TaskDto[]
  agreements: AgreementDto[]
  reviewDecisions: TaskReviewDecision[]
  conflicts: Array<TaskDto | AgreementDto>
  syncedAt: string
}

function nowIso() {
  return new Date().toISOString()
}

export async function syncTasksApi(
  payload: SyncTasksRequestDto,
): Promise<SyncTasksResponseDto> {
  if (!isBackendApiConfigured()) {
    return {
      tasks: payload.tasks,
      agreements: payload.agreements,
      reviewDecisions: payload.reviewDecisions,
      conflicts: [],
      syncedAt: nowIso(),
    }
  }

  return apiRequest<SyncTasksResponseDto>('/tasks/sync', {
    method: 'POST',
    body: payload,
  })
}

export async function listTasks(): Promise<SyncTasksResponseDto> {
  if (!isBackendApiConfigured()) {
    return {
      tasks: [],
      agreements: [],
      reviewDecisions: [],
      conflicts: [],
      syncedAt: nowIso(),
    }
  }

  return apiRequest<SyncTasksResponseDto>('/tasks')
}
