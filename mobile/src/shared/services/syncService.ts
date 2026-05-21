import { useMeetingsStore } from '@/app/stores/meetings'
import { useParticipantsStore } from '@/app/stores/participants'
import { useTasksStore } from '@/app/stores/tasks'
import type { Participant } from '@/features/participants/types'
import { apiRequest } from '@/shared/api/httpClient'
import { syncMeetingsApi } from '@/shared/api/meetingsApi'
import { syncTasksApi } from '@/shared/api/tasksApi'
import { appConfig } from '@/shared/config/env'

export type SyncResource = 'meetings' | 'tasks' | 'participants'

export interface SyncResult {
  resource: SyncResource
  mode: 'mock' | 'backend'
  pushedCount: number
  pulledCount: number
  conflictCount: number
  syncedAt: string
  skippedReason?: string
}

interface SyncParticipantsRequestDto {
  participants: Participant[]
  clientUpdatedAt: string
  lastSyncedAt?: string
}

interface SyncParticipantsResponseDto {
  participants: Participant[]
  conflicts: Participant[]
  syncedAt: string
}

function nowIso() {
  return new Date().toISOString()
}

function createMockResult(
  resource: SyncResource,
  pushedCount: number,
): SyncResult {
  return {
    resource,
    mode: 'mock',
    pushedCount,
    pulledCount: 0,
    conflictCount: 0,
    syncedAt: nowIso(),
    skippedReason:
      'Backend API is not configured. Local data remains stored on this device.',
  }
}

export async function syncMeetings(): Promise<SyncResult> {
  const meetingsStore = useMeetingsStore()

  if (!appConfig.isBackendApiEnabled) {
    return createMockResult('meetings', meetingsStore.meetings.length)
  }

  const response = await syncMeetingsApi({
    meetings: meetingsStore.meetings,
    activeMeetingId: meetingsStore.activeMeetingId,
    draftSavedAt: meetingsStore.draftSavedAt,
    clientUpdatedAt: nowIso(),
  })

  if (response.meetings.length) {
    meetingsStore.meetings = response.meetings
    meetingsStore.activeMeetingId = response.activeMeetingId
    meetingsStore.draftSavedAt = response.draftSavedAt
    meetingsStore.persist()
  }

  return {
    resource: 'meetings',
    mode: 'backend',
    pushedCount: meetingsStore.meetings.length,
    pulledCount: response.meetings.length,
    conflictCount: response.conflicts.length,
    syncedAt: response.syncedAt,
  }
}

export async function syncTasks(): Promise<SyncResult> {
  const tasksStore = useTasksStore()

  if (!appConfig.isBackendApiEnabled) {
    return createMockResult(
      'tasks',
      tasksStore.tasks.length + tasksStore.agreements.length,
    )
  }

  const response = await syncTasksApi({
    tasks: tasksStore.tasks,
    agreements: tasksStore.agreements,
    reviewDecisions: tasksStore.reviewDecisions,
    clientUpdatedAt: nowIso(),
  })

  if (response.tasks.length || response.agreements.length) {
    tasksStore.tasks = response.tasks
    tasksStore.agreements = response.agreements
    tasksStore.reviewDecisions = response.reviewDecisions
    tasksStore.persist()
  }

  return {
    resource: 'tasks',
    mode: 'backend',
    pushedCount: tasksStore.tasks.length + tasksStore.agreements.length,
    pulledCount: response.tasks.length + response.agreements.length,
    conflictCount: response.conflicts.length,
    syncedAt: response.syncedAt,
  }
}

export async function syncParticipants(): Promise<SyncResult> {
  const participantsStore = useParticipantsStore()

  if (!appConfig.isBackendApiEnabled) {
    return createMockResult(
      'participants',
      participantsStore.participants.length,
    )
  }

  const response = await apiRequest<SyncParticipantsResponseDto>(
    '/participants/sync',
    {
      method: 'POST',
      body: {
        participants: participantsStore.participants,
        clientUpdatedAt: nowIso(),
      } satisfies SyncParticipantsRequestDto,
    },
  )

  if (response.participants.length) {
    participantsStore.participants = response.participants
    participantsStore.persist()
  }

  return {
    resource: 'participants',
    mode: 'backend',
    pushedCount: participantsStore.participants.length,
    pulledCount: response.participants.length,
    conflictCount: response.conflicts.length,
    syncedAt: response.syncedAt,
  }
}
