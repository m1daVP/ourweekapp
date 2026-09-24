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
  writeMeetingSyncSnapshot,
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
import {
  acknowledgeMeeting,
  preserveMeetingVersion,
  mergeHydratedMeeting,
  type MeetingSyncRecords,
} from '@/features/meeting/meetingSyncMerge';
import type { Participant } from '@/features/participants/types';
import {
  beginRemoteSync,
  getSyncSessionGeneration,
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
  retryableMeetingIds?: string[];
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
let hydration: { generation: number; promise: Promise<void> } | undefined;

function assertSyncSession(generation: number) {
  if (generation !== getSyncSessionGeneration())
    throw new Error('Sync session changed');
}

function queueMeetingOperation<T>(operation: () => Promise<T>): Promise<T> {
  const generation = getSyncSessionGeneration();
  const run = () => {
    assertSyncSession(generation);
    return operation();
  };
  const result = meetingSyncQueue.then(run, run);
  meetingSyncQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function meetingRecords(): MeetingSyncRecords {
  return structuredClone(
    readSyncResourceMetadata('meetings').meetingRecords ?? {}
  );
}

function saveMergedMeetings(
  meetings: Meeting[],
  records: MeetingSyncRecords,
  preferredId: string | null,
  draftSavedAt: string | null
) {
  const store = useMeetingsStore();
  const active = (id: string | null) =>
    id &&
    meetings.some(
      (meeting) =>
        meeting.id === id &&
        meeting.status !== 'completed' &&
        !meeting.deletedAt
    )
      ? id
      : null;
  const activeMeetingId = active(store.activeMeetingId) ?? active(preferredId);
  const savedAt = latestIso(store.draftSavedAt, draftSavedAt);
  writeMeetingSyncSnapshot(
    { meetings, activeMeetingId, draftSavedAt: savedAt },
    records
  );
  applyRemoteSyncMutation(() => {
    store.meetings = meetings;
    store.activeMeetingId = activeMeetingId;
    store.draftSavedAt = savedAt;
    useTasksStore().syncFromMeetings(meetings);
  });
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
  hydration = undefined;
  resetSyncRuntimeState();
}

function applyMeetingsFromBackend(
  response: Awaited<ReturnType<typeof listMeetings>>
) {
  const store = useMeetingsStore();
  const records = meetingRecords();
  const byId = new Map(store.meetings.map((meeting) => [meeting.id, meeting]));
  for (const dto of response.meetings) {
    const remote = fromMeetingDto(dto);
    const local = byId.get(remote.id);
    const record = records[remote.id] ?? {};
    if (!local) {
      byId.set(remote.id, remote);
      records[remote.id] = acknowledgeMeeting(record, remote);
    } else {
      const merged = mergeHydratedMeeting(local, remote, record);
      byId.set(remote.id, merged.meeting);
      records[remote.id] = merged.record;
    }
  }
  saveMergedMeetings(
    [...byId.values()],
    records,
    response.activeMeetingId,
    response.draftSavedAt
  );
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

function hydrateCoreDataFromBackend(): Promise<void> {
  const generation = getSyncSessionGeneration();
  if (hydration?.generation === generation) return hydration.promise;
  const promise = queueMeetingOperation(performCoreHydration);
  hydration = { generation, promise };
  void promise
    .finally(() => {
      if (hydration?.promise === promise) hydration = undefined;
    })
    .catch(() => undefined);
  return promise;
}

async function performCoreHydration() {
  const generation = getSyncSessionGeneration();
  if (hasInitialHydrationCompleted() || isOffline()) {
    return;
  }

  ensureFirstSyncBackup();

  try {
    const workspaceStore = useWorkspaceStore();
    const didLoadWorkspace = await workspaceStore.loadWorkspace();
    assertSyncSession(generation);

    if (!didLoadWorkspace) {
      throw new Error(translate('workspace.loadFailed'));
    }

    const ownerUserId = readSyncMetadata().ownerUserId;

    if (ownerUserId) {
      bindSyncOwner(ownerUserId, workspaceStore.workspace.id);
    }

    const [participantsResponse, meetingsResponse, tasksResponse] =
      await Promise.all([listParticipants(), listMeetings(), listTasks()]);

    assertSyncSession(generation);
    applyRemoteSyncMutation(() => {
      applyParticipantsFromBackend(participantsResponse);
      applyMeetingsFromBackend(meetingsResponse);
      applyTasksFromBackend(tasksResponse);
    });
    markInitialHydrationComplete();
  } catch (error) {
    assertSyncSession(generation);
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
  const generation = getSyncSessionGeneration();
  const meetingsStore = useMeetingsStore();
  const attemptedAt = nowIso();

  if (isOffline()) {
    return createOfflineResult('meetings');
  }

  ensureFirstSyncBackup();
  markSyncAttempt('meetings', attemptedAt);

  try {
    const localMeetings = meetingsStore.meetings.map(cloneMeeting);
    const pendingRecords = meetingRecords();
    for (const meeting of localMeetings) {
      const record = pendingRecords[meeting.id] ?? {};
      const content = meetingSyncContent(meeting);
      if (record.acknowledged?.content !== content) {
        pendingRecords[meeting.id] = {
          ...record,
          pendingUploads: [
            ...new Set([...(record.pendingUploads ?? []), content]),
          ],
        };
      }
    }
    // Journal submitted content before the request. If its response is lost,
    // a later pull/conflict can recognize that accepted upload after restart.
    writeMeetingSyncSnapshot(
      {
        meetings: localMeetings,
        activeMeetingId: meetingsStore.activeMeetingId,
        draftSavedAt: meetingsStore.draftSavedAt,
      },
      pendingRecords
    );
    const response = await syncMeetingsApi({
      meetings: localMeetings.map(toMeetingDto),
      activeMeetingId: meetingsStore.activeMeetingId,
      draftSavedAt: meetingsStore.draftSavedAt,
      clientUpdatedAt: attemptedAt,
      // Existing rows require a revision. A resource-wide wall-clock cursor
      // cannot prove that an unversioned local meeting is safe to overwrite.
    });
    assertSyncSession(generation);
    const records = meetingRecords();
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
    const retryableMeetingIds: string[] = [];
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
        const record = records[id] ?? {};
        if (!current) {
          // A locally removed record must not be resurrected by its old response.
          if (submitted) return undefined;
          if (remote) records[id] = acknowledgeMeeting(record, remote);
          return remote;
        }
        if (!remote) {
          if (
            submitted?.deletedAt &&
            !conflictedIds.has(id) &&
            meetingLocalSnapshot(current) === meetingLocalSnapshot(submitted)
          ) {
            // The sync endpoint processes explicit tombstones and reports any
            // rejected delete as a conflict. Retain a recovery copy on success.
            records[id] = {
              ...preserveMeetingVersion(record, current),
              pendingUploads: [],
            };
            return undefined;
          }
          return current;
        }
        const contentMatches =
          submitted &&
          meetingSyncContent(submitted) === meetingSyncContent(remote);
        const revisionOnlyConflict = response.conflicts.some(
          (conflict) =>
            conflictMeetingId(conflict) === id &&
            'reason' in conflict &&
            conflict.reason === 'updated_on_client_and_server'
        );
        // A lost response can leave us behind even though the server already has
        // exactly this content. Repair that revision without overwriting either side.
        if (
          revisionOnlyConflict &&
          contentMatches &&
          Number.isInteger(remote.serverRevision) &&
          remote.serverRevision! >= (current.serverRevision ?? 0)
        )
          conflictedIds.delete(id);
        const acknowledged =
          submitted &&
          !conflictedIds.has(id) &&
          meetingSyncContent(submitted) === meetingSyncContent(remote) &&
          Number.isInteger(remote.serverRevision) &&
          (remote.serverRevision ?? 0) >= (current.serverRevision ?? 0);
        if (acknowledged) {
          records[id] = acknowledgeMeeting(record, remote);
          const changed =
            meetingLocalSnapshot(current) !== meetingLocalSnapshot(submitted);
          if (meetingSyncContent(current) !== meetingSyncContent(remote))
            retryableMeetingIds.push(id);
          return {
            ...current,
            serverRevision: remote.serverRevision,
            ...(changed
              ? {}
              : {
                  updatedAt: remote.updatedAt,
                  aiSummary: remote.aiSummary ?? current.aiSummary,
                }),
          };
        }
        if (revisionOnlyConflict) {
          const merged = mergeHydratedMeeting(current, remote, record);
          if (
            merged.meeting !== current &&
            merged.meeting.serverRevision === remote.serverRevision
          ) {
            records[id] = merged.record;
            conflictedIds.delete(id);
            if (
              meetingSyncContent(merged.meeting) !== meetingSyncContent(remote)
            )
              retryableMeetingIds.push(id);
            return merged.meeting;
          }
        }
        // Even a successful HTTP response is not permission to replace content
        // that the server did not acknowledge. Keep a durable recovery copy.
        records[id] = preserveMeetingVersion(record, remote);
        return current;
      })
      .filter((meeting): meeting is Meeting => Boolean(meeting));
    const hasPendingChanges = mergedMeetings.some((meeting) => {
      const base = records[meeting.id]?.acknowledged;
      return (
        !base ||
        base.revision !== meeting.serverRevision ||
        base.content !== meetingSyncContent(meeting)
      );
    });
    saveMergedMeetings(
      mergedMeetings,
      records,
      response.activeMeetingId,
      response.draftSavedAt
    );
    markSyncSuccess('meetings', response.syncedAt, conflictedIds.size);
    if (hasPendingChanges) markLocalChange('meetings');

    return {
      resource: 'meetings',
      mode: 'backend',
      pushedCount: localMeetings.length,
      pulledCount: response.meetings.length,
      conflictCount: conflictedIds.size,
      syncedAt: response.syncedAt,
      acknowledgedMeetings: remoteMeetings.map(cloneMeeting),
      conflictedMeetingIds: [...conflictedIds],
      retryableMeetingIds,
    };
  } catch (error) {
    assertSyncSession(generation);
    markSyncFailure('meetings', error);
    throw error;
  }
}

export function syncMeetings(): Promise<SyncResult> {
  return queueMeetingOperation(performMeetingSync);
}

export async function syncCompletedMeetingForAi(
  meetingId: string
): Promise<Meeting> {
  const generation = getSyncSessionGeneration();
  try {
    const participantResult = await syncParticipants();
    assertSyncSession(generation);
    if (participantResult.skippedReason)
      throw new AiMeetingSyncRequiredError('offline');
    if (participantResult.conflictCount)
      throw new AiMeetingSyncRequiredError('conflict');

    let result = await syncMeetings();
    assertSyncSession(generation);
    if (result.retryableMeetingIds?.includes(meetingId)) {
      result = await syncMeetings();
      assertSyncSession(generation);
    }
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
  const generation = getSyncSessionGeneration();
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

    assertSyncSession(generation);
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
    assertSyncSession(generation);
    markSyncFailure('tasks', error);
    throw error;
  }
}

export async function syncParticipants(): Promise<SyncResult> {
  const generation = getSyncSessionGeneration();
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
    assertSyncSession(generation);
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
    assertSyncSession(generation);
    markSyncFailure('participants', error);
    throw error;
  }
}

export async function syncCoreData() {
  const generation = getSyncSessionGeneration();
  const results: SyncResult[] = [];
  let firstError: unknown;

  try {
    results.push(await syncParticipants());
  } catch (error) {
    firstError = error;
  }

  if (!firstError) {
    try {
      assertSyncSession(generation);
      results.push(await syncMeetings());
    } catch (error) {
      firstError ??= error;
    }
  }

  if (!firstError) {
    try {
      assertSyncSession(generation);
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
