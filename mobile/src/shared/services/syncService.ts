import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useTasksStore } from '@/app/stores/tasks';
import { translate } from '@/features/localization/i18n';
import type { Participant } from '@/features/participants/types';
import type {
  Agreement,
  Task,
  TaskReviewDecision,
} from '@/features/tasks/types';
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
import type { Meeting } from '@/features/meeting/types';

export type SyncResource = 'meetings' | 'tasks' | 'participants';
export type SyncState = 'idle' | 'syncing' | 'synced' | 'failed' | 'offline';

export interface SyncResult {
  resource: SyncResource;
  mode: 'mock' | 'backend';
  pushedCount: number;
  pulledCount: number;
  conflictCount: number;
  syncedAt: string;
  skippedReason?: string;
}

interface SyncableItem {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
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

export const syncStatus = shallowRef<Record<SyncResource, ResourceSyncStatus>>({
  meetings: { state: 'idle', conflictCount: 0 },
  tasks: { state: 'idle', conflictCount: 0 },
  participants: { state: 'idle', conflictCount: 0 },
});

function nowIso() {
  return new Date().toISOString();
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function getItemTimestamp(item: SyncableItem) {
  return item.deletedAt ?? item.updatedAt ?? item.createdAt ?? '';
}

function isRemoteNewer<TItem extends SyncableItem>(
  localItem: TItem,
  remoteItem: TItem
) {
  return (
    new Date(getItemTimestamp(remoteItem)).getTime() >=
    new Date(getItemTimestamp(localItem)).getTime()
  );
}

function isDeletedNewer<TItem extends SyncableItem>(
  deletedItem: TItem,
  existingItem?: TItem
) {
  if (!deletedItem.deletedAt) {
    return false;
  }

  if (!existingItem) {
    return true;
  }

  return (
    new Date(deletedItem.deletedAt).getTime() >=
    new Date(getItemTimestamp(existingItem)).getTime()
  );
}

function mergeSyncItems<TItem extends SyncableItem>(
  localItems: TItem[],
  remoteItems: TItem[]
) {
  const localById = new Map(localItems.map((item) => [item.id, item]));
  const remoteById = new Map(remoteItems.map((item) => [item.id, item]));
  const mergedItems: TItem[] = [];

  for (const id of new Set([...localById.keys(), ...remoteById.keys()])) {
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);

    if (remoteItem && isDeletedNewer(remoteItem, localItem)) {
      continue;
    }

    if (localItem?.deletedAt && isDeletedNewer(localItem, remoteItem)) {
      continue;
    }

    if (localItem && remoteItem) {
      mergedItems.push(
        isRemoteNewer(localItem, remoteItem) ? remoteItem : localItem
      );
      continue;
    }

    if (remoteItem) {
      mergedItems.push(remoteItem);
      continue;
    }

    if (localItem) {
      mergedItems.push(localItem);
    }
  }

  return mergedItems.filter((item) => !item.deletedAt);
}

function mergeReviewDecisions(
  localItems: TaskReviewDecision[],
  remoteItems: TaskReviewDecision[]
) {
  const decisionsByKey = new Map<string, TaskReviewDecision>();

  for (const decision of [...localItems, ...remoteItems]) {
    const key = `${decision.meetingId}:${decision.sourceMeetingId}`;
    const existingDecision = decisionsByKey.get(key);

    if (
      !existingDecision ||
      new Date(decision.decidedAt).getTime() >=
        new Date(existingDecision.decidedAt).getTime()
    ) {
      decisionsByKey.set(key, decision);
    }
  }

  return [...decisionsByKey.values()];
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
