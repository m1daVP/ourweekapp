import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useTasksStore } from '@/app/stores/tasks';
import { translate } from '@/features/localization/i18n';
import type { Participant } from '@/features/participants/types';
import type { Agreement, Task } from '@/features/tasks/types';
import { apiRequest } from '@/shared/api/httpClient';
import { syncMeetingsApi } from '@/shared/api/meetingsApi';
import { syncTasksApi } from '@/shared/api/tasksApi';
import { appConfig } from '@/shared/config/env';
import { shallowRef } from 'vue';
import {
  ensureFirstSyncBackup,
  readSyncResourceMetadata,
  writeSyncResourceMetadata,
} from '@/shared/services/storageService';
import {
  mergeReviewDecisions,
  mergeSyncItems,
} from '@/shared/services/syncMergeService';
import type { Meeting } from '@/features/meeting/types';

export type SyncResource = 'meetings' | 'tasks' | 'participants';
export type SyncState =
  | 'idle'
  | 'savedLocally'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'offline';

export interface SyncResult {
  resource: SyncResource;
  mode: 'mock' | 'backend';
  pushedCount: number;
  pulledCount: number;
  conflictCount: number;
  syncedAt: string;
  skippedReason?: string;
}

interface ParticipantDto extends Participant {
  serverRevision?: number;
  deletedAt?: string;
}

interface SyncParticipantsRequestDto {
  participants: ParticipantDto[];
  clientUpdatedAt: string;
  lastSyncedAt?: string;
}

interface SyncParticipantsResponseDto {
  participants: ParticipantDto[];
  conflicts: ParticipantDto[];
  syncedAt: string;
}

interface ResourceSyncStatus {
  state: SyncState;
  lastSyncedAt?: string;
  lastAttemptedAt?: string;
  conflictCount: number;
  errorMessage?: string;
}

export interface AggregateSyncStatus {
  state: SyncState;
  resources: SyncResource[];
  conflictCount: number;
  lastSyncedAt?: string;
  lastAttemptedAt?: string;
  errorMessage?: string;
}

export const syncStatus = shallowRef<Record<SyncResource, ResourceSyncStatus>>({
  meetings: { state: 'idle', conflictCount: 0 },
  tasks: { state: 'idle', conflictCount: 0 },
  participants: { state: 'idle', conflictCount: 0 },
});
export const isApplyingRemoteSync = shallowRef(false);
let remoteSyncDepth = 0;
let remoteSyncClearTimeout: ReturnType<typeof setTimeout> | null = null;

function nowIso() {
  return new Date().toISOString();
}

function beginRemoteSync() {
  if (remoteSyncClearTimeout) {
    clearTimeout(remoteSyncClearTimeout);
    remoteSyncClearTimeout = null;
  }

  remoteSyncDepth += 1;
  isApplyingRemoteSync.value = true;
}

function endRemoteSyncSoon() {
  remoteSyncClearTimeout = setTimeout(() => {
    remoteSyncDepth = Math.max(0, remoteSyncDepth - 1);

    if (remoteSyncDepth === 0) {
      isApplyingRemoteSync.value = false;
    }
  }, 0);
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function latestNullableDate(first: string | null, second: string | null) {
  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  return new Date(second).getTime() > new Date(first).getTime()
    ? second
    : first;
}

function setResourceStatus(
  resource: SyncResource,
  status: Partial<ResourceSyncStatus>
) {
  syncStatus.value = {
    ...syncStatus.value,
    [resource]: {
      ...syncStatus.value[resource],
      ...status,
    },
  };
}

export function markLocalChange(resource: SyncResource) {
  if (!appConfig.isBackendApiEnabled) {
    return;
  }

  const changedAt = nowIso();

  setResourceStatus(resource, {
    state: 'savedLocally',
    lastAttemptedAt: changedAt,
    errorMessage: undefined,
  });
}

function markSyncAttempt(resource: SyncResource, attemptedAt: string) {
  setResourceStatus(resource, {
    state: 'syncing',
    lastAttemptedAt: attemptedAt,
    errorMessage: undefined,
  });
  writeSyncResourceMetadata(resource, { lastAttemptedAt: attemptedAt });
}

function markSyncSuccess(
  resource: SyncResource,
  syncedAt: string,
  conflictCount: number
) {
  setResourceStatus(resource, {
    state: 'synced',
    lastSyncedAt: syncedAt,
    conflictCount,
    errorMessage: undefined,
  });
  writeSyncResourceMetadata(resource, {
    lastSyncedAt: syncedAt,
    lastSuccessfulAt: syncedAt,
    conflictCount,
  });
}

function markSyncFailure(resource: SyncResource, error: unknown) {
  const failedAt = nowIso();
  void error;

  setResourceStatus(resource, {
    state: 'failed',
    lastAttemptedAt: failedAt,
    errorMessage: translate('sync.failed'),
  });
  writeSyncResourceMetadata(resource, {
    lastFailedAt: failedAt,
  });
}

function createOfflineResult(resource: SyncResource): SyncResult {
  const syncedAt = nowIso();

  setResourceStatus(resource, {
    state: 'offline',
    lastAttemptedAt: syncedAt,
    errorMessage: translate('sync.offline'),
  });

  return {
    resource,
    mode: 'backend',
    pushedCount: 0,
    pulledCount: 0,
    conflictCount: 0,
    syncedAt,
    skippedReason: translate('sync.offline'),
  };
}

function createMockResult(
  resource: SyncResource,
  pushedCount: number
): SyncResult {
  return {
    resource,
    mode: 'mock',
    pushedCount,
    pulledCount: 0,
    conflictCount: 0,
    syncedAt: nowIso(),
    skippedReason: translate('sync.backendUnavailable'),
  };
}

export async function retrySync(
  resource?: SyncResource
): Promise<SyncResult[]> {
  beginRemoteSync();

  try {
    if (resource === 'meetings') {
      return [await syncMeetings()];
    }

    if (resource === 'tasks') {
      return [await syncTasks()];
    }

    if (resource === 'participants') {
      return [await syncParticipants()];
    }

    return await syncCoreData();
  } finally {
    endRemoteSyncSoon();
  }
}

function getMostRecentTimestamp(
  statuses: ResourceSyncStatus[],
  key: 'lastSyncedAt' | 'lastAttemptedAt'
) {
  return statuses
    .map((status) => status[key])
    .filter((value): value is string => Boolean(value))
    .sort((first, second) => second.localeCompare(first))[0];
}

export function getAggregateSyncStatus(): AggregateSyncStatus {
  const entries = Object.entries(syncStatus.value) as Array<
    [SyncResource, ResourceSyncStatus]
  >;
  const statuses = entries.map(([, status]) => status);
  const statePriority: SyncState[] = [
    'failed',
    'offline',
    'syncing',
    'savedLocally',
    'synced',
    'idle',
  ];
  const state =
    statePriority.find((candidate) =>
      statuses.some((status) => status.state === candidate)
    ) ?? 'idle';
  const matchingEntries = entries.filter(
    ([, status]) => status.state === state
  );

  return {
    state,
    resources: matchingEntries.map(([resource]) => resource),
    conflictCount: statuses.reduce(
      (total, status) => total + status.conflictCount,
      0
    ),
    lastSyncedAt: getMostRecentTimestamp(statuses, 'lastSyncedAt'),
    lastAttemptedAt: getMostRecentTimestamp(statuses, 'lastAttemptedAt'),
    errorMessage: matchingEntries.find(([, status]) => status.errorMessage)?.[1]
      .errorMessage,
  };
}

export async function syncMeetings(): Promise<SyncResult> {
  const meetingsStore = useMeetingsStore();
  const attemptedAt = nowIso();

  if (!appConfig.isBackendApiEnabled) {
    return createMockResult('meetings', meetingsStore.meetings.length);
  }

  if (isOffline()) {
    return createOfflineResult('meetings');
  }

  ensureFirstSyncBackup();
  markSyncAttempt('meetings', attemptedAt);

  try {
    const metadata = readSyncResourceMetadata('meetings');
    const localMeetings = meetingsStore.meetings;
    const response = await syncMeetingsApi({
      meetings: localMeetings,
      activeMeetingId: meetingsStore.activeMeetingId,
      draftSavedAt: meetingsStore.draftSavedAt,
      clientUpdatedAt: attemptedAt,
      lastSyncedAt: metadata.lastSyncedAt,
    });
    const mergedMeetings = mergeSyncItems<Meeting>(
      localMeetings,
      response.meetings
    );
    const activeMeetingId =
      response.activeMeetingId &&
      mergedMeetings.some((meeting) => meeting.id === response.activeMeetingId)
        ? response.activeMeetingId
        : meetingsStore.activeMeetingId &&
            mergedMeetings.some(
              (meeting) => meeting.id === meetingsStore.activeMeetingId
            )
          ? meetingsStore.activeMeetingId
          : null;

    meetingsStore.meetings = mergedMeetings;
    meetingsStore.activeMeetingId = activeMeetingId;
    meetingsStore.draftSavedAt = latestNullableDate(
      meetingsStore.draftSavedAt,
      response.draftSavedAt
    );
    meetingsStore.persist();
    useTasksStore().syncFromMeetings(mergedMeetings);
    markSyncSuccess('meetings', response.syncedAt, response.conflicts.length);

    return {
      resource: 'meetings',
      mode: 'backend',
      pushedCount: localMeetings.length,
      pulledCount: response.meetings.length,
      conflictCount: response.conflicts.length,
      syncedAt: response.syncedAt,
    };
  } catch (error) {
    markSyncFailure('meetings', error);
    throw error;
  }
}

export async function syncTasks(): Promise<SyncResult> {
  const tasksStore = useTasksStore();
  const attemptedAt = nowIso();

  if (!appConfig.isBackendApiEnabled) {
    return createMockResult(
      'tasks',
      tasksStore.tasks.length + tasksStore.agreements.length
    );
  }

  if (isOffline()) {
    return createOfflineResult('tasks');
  }

  ensureFirstSyncBackup();
  markSyncAttempt('tasks', attemptedAt);

  try {
    const metadata = readSyncResourceMetadata('tasks');
    const localTasks = tasksStore.tasks;
    const localAgreements = tasksStore.agreements;
    const localReviewDecisions = tasksStore.reviewDecisions;
    const response = await syncTasksApi({
      tasks: localTasks,
      agreements: localAgreements,
      reviewDecisions: localReviewDecisions,
      clientUpdatedAt: attemptedAt,
      lastSyncedAt: metadata.lastSyncedAt,
    });

    tasksStore.tasks = mergeSyncItems<Task>(localTasks, response.tasks);
    tasksStore.agreements = mergeSyncItems<Agreement>(
      localAgreements,
      response.agreements
    );
    tasksStore.reviewDecisions = mergeReviewDecisions(
      localReviewDecisions,
      response.reviewDecisions
    );
    tasksStore.persist();
    markSyncSuccess('tasks', response.syncedAt, response.conflicts.length);

    return {
      resource: 'tasks',
      mode: 'backend',
      pushedCount: localTasks.length + localAgreements.length,
      pulledCount: response.tasks.length + response.agreements.length,
      conflictCount: response.conflicts.length,
      syncedAt: response.syncedAt,
    };
  } catch (error) {
    markSyncFailure('tasks', error);
    throw error;
  }
}

export async function syncParticipants(): Promise<SyncResult> {
  const participantsStore = useParticipantsStore();
  const attemptedAt = nowIso();

  if (!appConfig.isBackendApiEnabled) {
    return createMockResult(
      'participants',
      participantsStore.participants.length
    );
  }

  if (isOffline()) {
    return createOfflineResult('participants');
  }

  ensureFirstSyncBackup();
  markSyncAttempt('participants', attemptedAt);

  try {
    const metadata = readSyncResourceMetadata('participants');
    const localParticipants = participantsStore.participants;
    const response = await apiRequest<SyncParticipantsResponseDto>(
      '/participants/sync',
      {
        method: 'POST',
        body: {
          participants: localParticipants,
          clientUpdatedAt: attemptedAt,
          lastSyncedAt: metadata.lastSyncedAt,
        } satisfies SyncParticipantsRequestDto,
        requiresAuth: true,
      }
    );
    const remoteParticipants = Array.isArray(response.participants)
      ? response.participants
      : [];
    const remoteConflicts = Array.isArray(response.conflicts)
      ? response.conflicts
      : [];
    const syncedAt = response.syncedAt ?? nowIso();

    participantsStore.participants = mergeSyncItems<ParticipantDto>(
      localParticipants,
      remoteParticipants
    );
    participantsStore.persist();
    markSyncSuccess('participants', syncedAt, remoteConflicts.length);

    return {
      resource: 'participants',
      mode: 'backend',
      pushedCount: localParticipants.length,
      pulledCount: remoteParticipants.length,
      conflictCount: remoteConflicts.length,
      syncedAt,
    };
  } catch (error) {
    markSyncFailure('participants', error);
    throw error;
  }
}

export async function syncCoreData() {
  const syncResults = await Promise.allSettled([
    syncParticipants(),
    syncMeetings(),
    syncTasks(),
  ]);
  const results = syncResults
    .filter(
      (result): result is PromiseFulfilledResult<SyncResult> =>
        result.status === 'fulfilled'
    )
    .map((result) => result.value);

  if (!results.length) {
    const firstError = syncResults.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )?.reason;

    throw firstError instanceof Error
      ? firstError
      : new Error(translate('sync.failed'));
  }

  return results;
}
