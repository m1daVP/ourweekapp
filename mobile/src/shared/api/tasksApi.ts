import type { TaskReviewDecision } from '@/features/tasks/types';
import { apiRequest, isBackendApiConfigured } from './httpClient';
import { nowIso } from '@/shared/utils/dates';
import type { AgreementDto, TaskDto } from '@/shared/api/syncDtos';

export interface SyncTasksRequestDto {
  tasks: TaskDto[];
  agreements: AgreementDto[];
  reviewDecisions: TaskReviewDecision[];
  lastSyncedAt?: string;
  clientUpdatedAt: string;
}

export interface SyncTasksResponseDto {
  tasks: TaskDto[];
  agreements: AgreementDto[];
  reviewDecisions: TaskReviewDecision[];
  conflicts: Array<TaskDto | AgreementDto>;
  syncedAt: string;
}

function normalizeSyncTasksResponse(
  response: SyncTasksResponseDto
): SyncTasksResponseDto {
  return {
    tasks: Array.isArray(response.tasks) ? response.tasks : [],
    agreements: Array.isArray(response.agreements) ? response.agreements : [],
    reviewDecisions: Array.isArray(response.reviewDecisions)
      ? response.reviewDecisions
      : [],
    conflicts: Array.isArray(response.conflicts) ? response.conflicts : [],
    syncedAt: response.syncedAt ?? nowIso(),
  };
}

export async function syncTasksApi(
  payload: SyncTasksRequestDto
): Promise<SyncTasksResponseDto> {
  if (!isBackendApiConfigured()) {
    return {
      tasks: payload.tasks,
      agreements: payload.agreements,
      reviewDecisions: payload.reviewDecisions,
      conflicts: [],
      syncedAt: nowIso(),
    };
  }

  const response = await apiRequest<SyncTasksResponseDto>('/tasks/sync', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
  });

  return normalizeSyncTasksResponse(response);
}

export async function listTasks(): Promise<SyncTasksResponseDto> {
  if (!isBackendApiConfigured()) {
    return {
      tasks: [],
      agreements: [],
      reviewDecisions: [],
      conflicts: [],
      syncedAt: nowIso(),
    };
  }

  const response = await apiRequest<SyncTasksResponseDto>('/tasks/', {
    requiresAuth: true,
  });

  return normalizeSyncTasksResponse(response);
}
