import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useTasksStore } from '@/app/stores/tasks';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { translate } from '@/features/localization/i18n';
import type { Agreement, Task } from '@/features/tasks/types';
import { apiRequest } from '@/shared/api/httpClient';
import { listMeetings, syncMeetingsApi } from '@/shared/api/meetingsApi';
import { listParticipants } from '@/shared/api/participantsApi';
import { listTasks, syncTasksApi } from '@/shared/api/tasksApi';
import {
  bindSyncOwner,
  ensureFirstSyncBackup,
  readSyncMetadata,
  readSyncResourceMetadata,
  writeSyncResourceMetadata,
} from '@/shared/services/storageService';
import {
  mergeReviewDecisions,
  mergeSyncItems,
} from '@/shared/services/syncMergeService';
import {
  fromAgreementDto,
  fromMeetingDto,
  fromParticipantDto,
  fromTaskDto,
  toAgreementDto,
  toMeetingDto,
  toParticipantDto,
  toReviewDecisionDto,
  toTaskDto,
  type ParticipantDto,
} from '@/shared/api/syncDtos';
import { latestIso, nowIso } from '@/shared/utils/dates';
import type { Meeting } from '@/features/meeting/types';
import {
  cloneMeeting,
  meetingLocalSnapshot,
  meetingSyncContent,
} from '@/features/meeting/meetingSyncSnapshot';
import type { Participant } from '@/features/participants/types';
import {
  beginRemoteSync,
  endRemoteSyncSoon,
  hasInitialHydrationCompleted,
  markInitialHydrationComplete,
  resetSyncRuntimeState,
  syncStatus,
  type ResourceSyncStatus,
  type SyncResource,
  type SyncState,
} from '@/shared/services/syncRuntimeService';

export {
  isApplyingRemoteSync,
  resetSyncRuntimeState,
  syncStatus,
} from '@/shared/services/syncRuntimeService';
export type {
  SyncResource,
  SyncState,
} from '@/shared/services/syncRuntimeService';

export interface SyncResult {
  resource: SyncResource;
  mode: 'backend';
  pushedCount: number;
  pulledCount: number;
  conflictCount: number;
  syncedAt: string;
  skippedReason?: string;
  acknowledgedMeetings?: Meeting[];
  conflictedMeetingIds?: string[];
}

export class AiMeetingSyncRequiredError extends Error {
  constructor(
    public readonly reason:
      'offline' | 'conflict' | 'missing' | 'changed' | 'failed'
  ) {
    super(`AI summary requires a completed meeting sync: ${reason}`);
    this.name = 'AiMeetingSyncRequiredError';
  }
}

let meetingSyncQueue: Promise<unknown> = Promise.resolve();

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

export interface AggregateSyncStatus {
  state: SyncState;
  resources: SyncResource[];
  conflictCount: number;
  lastSyncedAt?: string;
  lastAttemptedAt?: string;
  errorMessage?: string;
}

function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
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

export async function retrySync(
  resource?: SyncResource
): Promise<SyncResult[]> {
  if (!resource) {
    await hydrateCoreDataFromBackend();
  }

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
}

function applyRemoteSyncMutation(mutation: () => void) {
  beginRemoteSync();
  try {
    mutation();
  } finally {
    endRemoteSyncSoon();
  }
}

export function resetSyncRuntimeStateForTests() {
  meetingSyncQueue = Promise.resolve();
  resetSyncRuntimeState();
}

function applyMeetingsFromBackend(
  response: Awaited<ReturnType<typeof listMeetings>>
) {
  const meetingsStore = useMeetingsStore();
  const localMeetings = meetingsStore.meetings;
  const remoteMeetings = response.meetings.map(fromMeetingDto);
  const mergedMeetings = mergeSyncItems<Meeting>(localMeetings, remoteMeetings);
  const activeMeetingId =
    meetingsStore.activeMeetingId &&
    mergedMeetings.some(
      (meeting) => meeting.id === meetingsStore.activeMeetingId
    )
      ? meetingsStore.activeMeetingId
      : response.activeMeetingId &&
          mergedMeetings.some(
            (meeting) => meeting.id === response.activeMeetingId
          )
        ? response.activeMeetingId
        : null;

  meetingsStore.meetings = mergedMeetings;
  meetingsStore.activeMeetingId = activeMeetingId;
  meetingsStore.draftSavedAt = latestIso(
    meetingsStore.draftSavedAt,
    response.draftSavedAt
  );
  meetingsStore.persist();
  useTasksStore().syncFromMeetings(mergedMeetings);
}

function applyTasksFromBackend(
  response: Awaited<ReturnType<typeof listTasks>>
) {
  const tasksStore = useTasksStore();

  tasksStore.tasks = mergeSyncItems<Task>(
    tasksStore.tasks,
    response.tasks.map(fromTaskDto)
  );
  tasksStore.agreements = mergeSyncItems<Agreement>(
    tasksStore.agreements,
    response.agreements.map(fromAgreementDto)
  );
  tasksStore.reviewDecisions = mergeReviewDecisions(
    tasksStore.reviewDecisions,
    response.reviewDecisions.map(toReviewDecisionDto)
  );
  tasksStore.persist();
}

function mergeParticipants(
  localParticipants: Participant[],
  remoteParticipants: ParticipantDto[]
) {
  const localEmailsById = new Map(
    localParticipants.map((participant) => [participant.id, participant.email])
  );
  const remoteEmailsById = new Map(
    remoteParticipants.map((participant) => [participant.id, participant.email])
  );

  return mergeSyncItems<ParticipantDto>(
    localParticipants.map(toParticipantDto),
    remoteParticipants
  ).map((participant) =>
    fromParticipantDto({
      ...participant,
      email:
        remoteEmailsById.get(participant.id) ??
        localEmailsById.get(participant.id),
    })
  );
}

function applyParticipantsFromBackend(
  response: Awaited<ReturnType<typeof listParticipants>>
) {
  const participantsStore = useParticipantsStore();
  const mergedParticipants = mergeParticipants(
    participantsStore.participants,
    response.participants
  );

  participantsStore.applyParticipants(mergedParticipants);
}

async function hydrateCoreDataFromBackend() {
  if (hasInitialHydrationCompleted() || isOffline()) {
    return;
  }

  ensureFirstSyncBackup();

  try {
    const workspaceStore = useWorkspaceStore();
    const didLoadWorkspace = await workspaceStore.loadWorkspace();

    if (!didLoadWorkspace) {
      throw new Error(translate('workspace.loadFailed'));
    }

    const ownerUserId = readSyncMetadata().ownerUserId;

    if (ownerUserId) {
      bindSyncOwner(ownerUserId, workspaceStore.workspace.id);
    }

    const [participantsResponse, meetingsResponse, tasksResponse] =
      await Promise.all([listParticipants(), listMeetings(), listTasks()]);

    applyRemoteSyncMutation(() => {
      applyParticipantsFromBackend(participantsResponse);
      applyMeetingsFromBackend(meetingsResponse);
      applyTasksFromBackend(tasksResponse);
    });
    markInitialHydrationComplete();
  } catch (error) {
    markSyncFailure('participants', error);
    markSyncFailure('meetings', error);
    markSyncFailure('tasks', error);
    throw error;
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

function conflictMeetingId(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const item = value as {
    id?: unknown;
    resourceId?: unknown;
    serverVersion?: { id?: unknown };
  };
  if (typeof item.resourceId === 'string') return item.resourceId;
  if (typeof item.id === 'string') return item.id;
  return typeof item.serverVersion?.id === 'string'
    ? item.serverVersion.id
    : undefined;
}

async function performMeetingSync(): Promise<SyncResult> {
  const meetingsStore = useMeetingsStore();
  const attemptedAt = nowIso();

  if (isOffline()) {
    return createOfflineResult('meetings');
  }

  ensureFirstSyncBackup();
  markSyncAttempt('meetings', attemptedAt);

  try {
    const metadata = readSyncResourceMetadata('meetings');
    const localMeetings = meetingsStore.meetings.map(cloneMeeting);
    const response = await syncMeetingsApi({
      meetings: localMeetings.map(toMeetingDto),
      activeMeetingId: meetingsStore.activeMeetingId,
      draftSavedAt: meetingsStore.draftSavedAt,
      clientUpdatedAt: attemptedAt,
      lastSyncedAt: metadata.lastSyncedAt,
    });
    const currentMeetings = meetingsStore.meetings;
    const remoteMeetings = response.meetings.map(fromMeetingDto);
    const submittedById = new Map(
      localMeetings.map((meeting) => [meeting.id, meeting])
    );
    const remoteById = new Map(
      remoteMeetings.map((meeting) => [meeting.id, meeting])
    );
    const conflictedMeetingIds = response.conflicts
      .map(conflictMeetingId)
      .filter((id): id is string => Boolean(id));
    const conflictedIds = new Set(conflictedMeetingIds);
    const currentById = new Map(
      currentMeetings.map((meeting) => [meeting.id, meeting])
    );
    const mergedMeetings = [
      ...new Set([...currentById.keys(), ...remoteById.keys()]),
    ]
      .map((id) => {
        const current = currentById.get(id);
        const submitted = submittedById.get(id);
        const remote = remoteById.get(id);
        if (!current) return remote;
        if (
          !submitted ||
          meetingLocalSnapshot(current) !== meetingLocalSnapshot(submitted)
        ) {
          return current;
        }
        if (conflictedIds.has(id)) return current;
        if (
          remote &&
          meetingSyncContent(current) === meetingSyncContent(remote)
        ) {
          return {
            ...current,
            aiSummary: remote.aiSummary ?? current.aiSummary,
            serverRevision: remote.serverRevision,
            updatedAt: remote.updatedAt,
            deletedAt: remote.deletedAt,
          };
        }
        return (
          mergeSyncItems<Meeting>([current], remote ? [remote] : [])[0] ??
          current
        );
      })
      .filter((meeting): meeting is Meeting =>
        Boolean(meeting && !meeting.deletedAt)
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

    const hasConcurrentLocalChanges = currentMeetings.some((current) => {
      const submitted = submittedById.get(current.id);
      return (
        !submitted ||
        meetingLocalSnapshot(current) !== meetingLocalSnapshot(submitted)
      );
    });
    applyRemoteSyncMutation(() => {
      meetingsStore.meetings = mergedMeetings;
      meetingsStore.activeMeetingId = activeMeetingId;
      meetingsStore.draftSavedAt = latestIso(
        meetingsStore.draftSavedAt,
        response.draftSavedAt
      );
      meetingsStore.persist();
      useTasksStore().syncFromMeetings(mergedMeetings);
    });
    markSyncSuccess('meetings', response.syncedAt, response.conflicts.length);
    if (hasConcurrentLocalChanges) markLocalChange('meetings');

    return {
      resource: 'meetings',
      mode: 'backend',
      pushedCount: localMeetings.length,
      pulledCount: response.meetings.length,
      conflictCount: response.conflicts.length,
      syncedAt: response.syncedAt,
      acknowledgedMeetings: remoteMeetings.map(cloneMeeting),
      conflictedMeetingIds,
    };
  } catch (error) {
    markSyncFailure('meetings', error);
    throw error;
  }
}

export function syncMeetings(): Promise<SyncResult> {
  const result = meetingSyncQueue.then(performMeetingSync, performMeetingSync);
  meetingSyncQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export async function syncCompletedMeetingForAi(
  meetingId: string
): Promise<Meeting> {
  try {
    const participantResult = await syncParticipants();
    if (participantResult.skippedReason)
      throw new AiMeetingSyncRequiredError('offline');
    if (participantResult.conflictCount)
      throw new AiMeetingSyncRequiredError('conflict');

    const result = await syncMeetings();
    if (result.skippedReason) throw new AiMeetingSyncRequiredError('offline');
    if (result.conflictedMeetingIds?.includes(meetingId)) {
      throw new AiMeetingSyncRequiredError('conflict');
    }
    const acknowledged = result.acknowledgedMeetings?.find(
      (meeting) => meeting.id === meetingId
    );
    const current = useMeetingsStore().meetings.find(
      (meeting) => meeting.id === meetingId
    );
    if (!acknowledged || !current)
      throw new AiMeetingSyncRequiredError('missing');
    if (
      acknowledged.status !== 'completed' ||
      !Number.isInteger(acknowledged.serverRevision)
    ) {
      throw new AiMeetingSyncRequiredError('changed');
    }
    if (meetingSyncContent(acknowledged) !== meetingSyncContent(current)) {
      throw new AiMeetingSyncRequiredError('changed');
    }
    return cloneMeeting(current);
  } catch (error) {
    if (error instanceof AiMeetingSyncRequiredError) throw error;
    throw new AiMeetingSyncRequiredError('failed');
  }
}

export async function syncTasks(): Promise<SyncResult> {
  const tasksStore = useTasksStore();
  const attemptedAt = nowIso();

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
      tasks: localTasks.map(toTaskDto),
      agreements: localAgreements.map(toAgreementDto),
      reviewDecisions: localReviewDecisions.map(toReviewDecisionDto),
      clientUpdatedAt: attemptedAt,
      lastSyncedAt: metadata.lastSyncedAt,
    });

    applyRemoteSyncMutation(() => {
      tasksStore.tasks = mergeSyncItems<Task>(
        localTasks,
        response.tasks.map(fromTaskDto)
      );
      tasksStore.agreements = mergeSyncItems<Agreement>(
        localAgreements,
        response.agreements.map(fromAgreementDto)
      );
      tasksStore.reviewDecisions = mergeReviewDecisions(
        localReviewDecisions,
        response.reviewDecisions.map(toReviewDecisionDto)
      );
      tasksStore.persist();
    });
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
          participants: localParticipants.map(toParticipantDto),
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

    applyRemoteSyncMutation(() => {
      participantsStore.participants = mergeParticipants(
        localParticipants,
        remoteParticipants
      );
      participantsStore.persist();
    });
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
  const results: SyncResult[] = [];
  let firstError: unknown;

  try {
    results.push(await syncParticipants());
  } catch (error) {
    firstError = error;
  }

  if (!firstError) {
    try {
      results.push(await syncMeetings());
    } catch (error) {
      firstError ??= error;
    }
  }

  if (!firstError) {
    try {
      results.push(await syncTasks());
    } catch (error) {
      firstError ??= error;
    }
  }

  if (!results.length) {
    throw firstError instanceof Error
      ? firstError
      : new Error(translate('sync.failed'));
  }

  return results;
}
