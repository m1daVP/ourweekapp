import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Meeting } from '@/features/meeting/types';
import type { Task } from '@/features/tasks/types';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  bindSyncOwner: vi.fn(),
  ensureFirstSyncBackup: vi.fn(),
  getWorkspace: vi.fn(),
  listMeetings: vi.fn(),
  listParticipants: vi.fn(),
  listTasks: vi.fn(),
  readSyncMetadata: vi.fn(),
  readStorageSlice: vi.fn(),
  readSyncResourceMetadata: vi.fn(),
  resetSyncedAppDataForOwner: vi.fn(),
  syncMeetingsApi: vi.fn(),
  syncTasksApi: vi.fn(),
  writeSettingsStorage: vi.fn(),
  writeStorageSlice: vi.fn(),
  writeSyncResourceMetadata: vi.fn(),
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/shared/services/storageService', () => ({
  bindSyncOwner: mocks.bindSyncOwner,
  ensureFirstSyncBackup: mocks.ensureFirstSyncBackup,
  readSyncMetadata: mocks.readSyncMetadata,
  readSettingsStorage: vi.fn((_: string, fallback: unknown) => fallback),
  readStorageSlice: mocks.readStorageSlice,
  readSyncResourceMetadata: mocks.readSyncResourceMetadata,
  resetSyncedAppDataForOwner: mocks.resetSyncedAppDataForOwner,
  writeSettingsStorage: mocks.writeSettingsStorage,
  writeStorageSlice: mocks.writeStorageSlice,
  writeSyncResourceMetadata: mocks.writeSyncResourceMetadata,
}));

vi.mock('@/shared/api/httpClient', () => ({
  ApiClientError: class ApiClientError extends Error {},
  apiRequest: mocks.apiRequest,
  setApiAuthHandlers: vi.fn(),
}));

vi.mock('@/shared/api/meetingsApi', () => ({
  listMeetings: mocks.listMeetings,
  syncMeetingsApi: mocks.syncMeetingsApi,
}));

vi.mock('@/shared/api/participantsApi', () => ({
  listParticipants: mocks.listParticipants,
}));

vi.mock('@/shared/api/tasksApi', () => ({
  listTasks: mocks.listTasks,
  syncTasksApi: mocks.syncTasksApi,
}));

vi.mock('@/shared/api/workspaceApi', () => ({
  getWorkspace: mocks.getWorkspace,
  createWorkspaceInvitation: vi.fn(),
  removeWorkspaceMember: vi.fn(),
  updateWorkspace: vi.fn(),
  updateWorkspaceMember: vi.fn(),
}));

import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { usePrivateNotesStore } from '@/app/stores/privateNotes';
import { useTasksStore } from '@/app/stores/tasks';
import { useWorkspaceStore } from '@/app/stores/workspace';
import {
  clearSyncSessionState,
  prepareSyncForAuthenticatedUser,
} from '@/shared/services/syncSessionService';
import {
  resetSyncRuntimeStateForTests,
  retrySync,
  syncStatus,
  syncCompletedMeetingForAi,
  syncCoreData,
  syncMeetings,
  syncTasks,
} from '@/shared/services/syncService';

const createdAt = '2026-06-13T12:00:00.000Z';
const updatedAt = '2026-06-13T12:05:00.000Z';
const syncedAt = '2026-06-13T12:10:00.000Z';

function meeting(id: string, title = id): Meeting {
  return {
    id,
    templateId: 'weekly-family-check-in',
    title,
    status: 'draft',
    participantIds: [],
    checkInCompleted: false,
    sections: [],
    currentSectionIndex: 0,
    createdAt,
    updatedAt,
  };
}

function task(id: string, title = id): Task {
  return {
    id,
    title,
    responsibilityType: 'needsDiscussion',
    responsibleParticipantIds: [],
    status: 'open',
    sourceMeetingId: 'meeting-1',
    createdAt,
    updatedAt,
  };
}

function participant(id: string, name: string, serverRevision?: number) {
  return {
    id,
    name,
    initials: name.slice(0, 1).toUpperCase(),
    avatarColor: '#496a8f',
    type: 'adult' as const,
    isActive: true,
    createdAt,
    updatedAt,
    serverRevision,
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  setActivePinia(createPinia());
  resetSyncRuntimeStateForTests();

  mocks.apiRequest.mockReset();
  mocks.bindSyncOwner.mockReset();
  mocks.ensureFirstSyncBackup.mockReset();
  mocks.getWorkspace.mockReset();
  mocks.listMeetings.mockReset();
  mocks.listParticipants.mockReset();
  mocks.listTasks.mockReset();
  mocks.readSyncMetadata.mockReset();
  mocks.readStorageSlice.mockReset();
  mocks.readSyncResourceMetadata.mockReset();
  mocks.resetSyncedAppDataForOwner.mockReset();
  mocks.syncMeetingsApi.mockReset();
  mocks.syncTasksApi.mockReset();
  mocks.writeSettingsStorage.mockReset();
  mocks.writeStorageSlice.mockReset();
  mocks.writeSyncResourceMetadata.mockReset();

  mocks.readStorageSlice.mockImplementation(
    (_: string, fallback: unknown) => fallback
  );
  mocks.readSyncMetadata.mockReturnValue({
    version: 1,
    resources: {},
    ownerUserId: 'user-1',
  });
  mocks.readSyncResourceMetadata.mockReturnValue({ lastSyncedAt: syncedAt });
  mocks.getWorkspace.mockResolvedValue({
    id: 'workspace-1',
    name: 'Our home',
    ownerId: 'user-1',
    members: [
      {
        userId: 'user-1',
        displayName: 'Rita',
        role: 'owner',
        status: 'active',
      },
    ],
    invitations: [],
    createdAt,
    updatedAt,
  });
  mocks.listMeetings.mockResolvedValue({
    meetings: [],
    activeMeetingId: null,
    draftSavedAt: null,
    syncedAt,
  });
  mocks.listParticipants.mockResolvedValue({ participants: [] });
  mocks.listTasks.mockResolvedValue({
    tasks: [],
    agreements: [],
    reviewDecisions: [],
    conflicts: [],
    syncedAt,
  });
  mocks.syncMeetingsApi.mockImplementation(async (payload) => ({
    meetings: payload.meetings,
    activeMeetingId: payload.activeMeetingId,
    draftSavedAt: payload.draftSavedAt,
    conflicts: [],
    syncedAt,
  }));
  mocks.syncTasksApi.mockImplementation(async (payload) => ({
    tasks: payload.tasks,
    agreements: payload.agreements,
    reviewDecisions: payload.reviewDecisions,
    conflicts: [],
    syncedAt,
  }));
  mocks.apiRequest.mockResolvedValue({
    participants: [],
    conflicts: [],
    syncedAt,
  });
});

describe('syncService', () => {
  it('acknowledges a completed meeting after participant and meeting sync', async () => {
    const meetingsStore = useMeetingsStore();
    const completed = meeting('meeting-ai', 'Completed meeting');
    Object.assign(completed, {
      status: 'completed',
      completedAt: updatedAt,
      serverRevision: 2,
    });
    meetingsStore.meetings = [completed];
    mocks.syncMeetingsApi.mockImplementationOnce(async (payload) => ({
      meetings: payload.meetings.map((item) => ({
        ...item,
        serverRevision: 3,
      })),
      activeMeetingId: null,
      draftSavedAt: null,
      conflicts: [],
      syncedAt,
    }));

    const acknowledged = await syncCompletedMeetingForAi(completed.id);

    expect(mocks.apiRequest.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.syncMeetingsApi.mock.invocationCallOrder[0]!
    );
    expect(acknowledged).toMatchObject({
      status: 'completed',
      serverRevision: 3,
    });
    expect(meetingsStore.meetings[0]).toMatchObject({ serverRevision: 3 });
  });

  it('rejects AI preflight while offline without attempting meeting sync', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await expect(syncCompletedMeetingForAi('meeting-ai')).rejects.toMatchObject(
      {
        name: 'AiMeetingSyncRequiredError',
        reason: 'offline',
      }
    );
    expect(mocks.syncMeetingsApi).not.toHaveBeenCalled();
  });

  it('rejects a conflicted target meeting without accepting its revision', async () => {
    const meetingsStore = useMeetingsStore();
    const completed = Object.assign(meeting('meeting-ai'), {
      status: 'completed' as const,
      completedAt: updatedAt,
      serverRevision: 2,
    });
    meetingsStore.meetings = [completed];
    mocks.syncMeetingsApi.mockResolvedValueOnce({
      meetings: [{ ...completed, serverRevision: 3 }],
      activeMeetingId: null,
      draftSavedAt: null,
      conflicts: [{ resourceId: completed.id }],
      syncedAt,
    });
    await expect(syncCompletedMeetingForAi(completed.id)).rejects.toMatchObject(
      { reason: 'conflict' }
    );
    expect(meetingsStore.meetings[0]!.serverRevision).toBe(2);
  });

  it('rejects AI preflight when the server does not acknowledge the target', async () => {
    const meetingsStore = useMeetingsStore();
    meetingsStore.meetings = [
      Object.assign(meeting('meeting-ai'), {
        status: 'completed' as const,
        completedAt: updatedAt,
      }),
    ];
    mocks.syncMeetingsApi.mockResolvedValueOnce({
      meetings: [],
      activeMeetingId: null,
      draftSavedAt: null,
      conflicts: [],
      syncedAt,
    });
    await expect(syncCompletedMeetingForAi('meeting-ai')).rejects.toMatchObject(
      { reason: 'missing' }
    );
  });

  it('preserves edits made while the meeting sync request is in flight', async () => {
    const meetingsStore = useMeetingsStore();
    const completed = Object.assign(meeting('meeting-ai'), {
      status: 'completed' as const,
      completedAt: updatedAt,
      serverRevision: 2,
    });
    meetingsStore.meetings = [completed];
    let respond!: () => void;
    mocks.syncMeetingsApi.mockImplementationOnce(async (payload) => {
      await new Promise<void>((resolve) => {
        respond = resolve;
      });
      return {
        meetings: payload.meetings.map((item) => ({
          ...item,
          serverRevision: 3,
        })),
        activeMeetingId: null,
        draftSavedAt: null,
        conflicts: [],
        syncedAt,
      };
    });
    const pending = syncCompletedMeetingForAi(completed.id);
    await vi.waitFor(() =>
      expect(mocks.syncMeetingsApi).toHaveBeenCalledOnce()
    );
    meetingsStore.meetings[0]!.title = 'Changed during sync';
    respond();
    await expect(pending).rejects.toMatchObject({ reason: 'changed' });
    expect(meetingsStore.meetings[0]).toMatchObject({
      title: 'Changed during sync',
      serverRevision: 2,
    });
    expect(syncStatus.value.meetings.state).toBe('savedLocally');
  });

  it('serializes overlapping meeting sync requests', async () => {
    const meetingsStore = useMeetingsStore();
    meetingsStore.meetings = [meeting('meeting-ai')];
    let respond!: () => void;
    mocks.syncMeetingsApi.mockImplementationOnce(async (payload) => {
      await new Promise<void>((resolve) => {
        respond = resolve;
      });
      return {
        meetings: payload.meetings,
        activeMeetingId: null,
        draftSavedAt: null,
        conflicts: [],
        syncedAt,
      };
    });
    const first = syncMeetings();
    const second = syncMeetings();
    await vi.waitFor(() =>
      expect(mocks.syncMeetingsApi).toHaveBeenCalledOnce()
    );
    respond();
    await first;
    await second;
    expect(mocks.syncMeetingsApi).toHaveBeenCalledTimes(2);
  });

  it('keeps meetings that exist only in the server sync response', async () => {
    const remote = Object.assign(meeting('remote-meeting'), {
      serverRevision: 1,
    });
    mocks.syncMeetingsApi.mockResolvedValueOnce({
      meetings: [remote],
      activeMeetingId: null,
      draftSavedAt: null,
      conflicts: [],
      syncedAt,
    });
    await syncMeetings();
    expect(useMeetingsStore().meetings).toEqual([remote]);
  });

  it('syncs an authoritative AI revision again without manufacturing a conflict', async () => {
    const meetingsStore = useMeetingsStore();
    const authoritative = Object.assign(meeting('meeting-ai'), {
      status: 'completed' as const,
      completedAt: updatedAt,
      serverRevision: 4,
      aiSummary: {
        id: 'summary-1',
        meetingId: 'meeting-ai',
        shortSummary: 'A useful conversation.',
        mainTopics: [],
        keyTensions: [],
        agreements: [],
        tasks: [],
        suggestedNextMeetingFocus: [],
        createdAt: syncedAt,
      },
    });
    meetingsStore.meetings = [authoritative];
    mocks.syncMeetingsApi.mockImplementationOnce(async (payload) => ({
      meetings: payload.meetings,
      activeMeetingId: null,
      draftSavedAt: null,
      conflicts: [],
      syncedAt,
    }));
    const result = await syncMeetings();
    expect(result.conflictCount).toBe(0);
    expect(meetingsStore.meetings).toEqual([authoritative]);
  });

  it('hydrates renamed server participants before a fresh-login push', async () => {
    const participantsStore = useParticipantsStore();
    const remoteParticipants = [
      participant('participant-1', 'Rita', 3),
      participant('participant-2', 'Alex', 2),
    ];
    mocks.listParticipants.mockResolvedValueOnce({
      participants: remoteParticipants,
    });
    mocks.apiRequest.mockImplementationOnce(async (_path, options) => ({
      participants: (options?.body as { participants: unknown[] }).participants,
      conflicts: [],
      syncedAt,
    }));

    expect(participantsStore.participants).toEqual([]);

    await retrySync();

    expect(mocks.listParticipants.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.apiRequest.mock.invocationCallOrder[0]
    );
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      '/participants/sync',
      expect.objectContaining({
        body: expect.objectContaining({
          participants: expect.arrayContaining([
            expect.objectContaining({ name: 'Rita', serverRevision: 3 }),
            expect.objectContaining({ name: 'Alex', serverRevision: 2 }),
          ]),
        }),
      })
    );
    const pushedParticipants = (
      mocks.apiRequest.mock.calls[0]?.[1]?.body as {
        participants: Array<{ name: string }>;
      }
    ).participants;
    expect(pushedParticipants.map(({ name }) => name)).toEqual([
      'Rita',
      'Alex',
    ]);
    expect(pushedParticipants.some(({ name }) => name === 'Me')).toBe(false);
    expect(pushedParticipants.some(({ name }) => name === 'Partner')).toBe(
      false
    );
    expect(participantsStore.participants.map(({ name }) => name)).toEqual([
      'Rita',
      'Alex',
    ]);
  });

  it('preserves a server-owned participant email when timestamps are equal', async () => {
    const participantsStore = useParticipantsStore();
    participantsStore.participants = [participant('participant-1', 'Rita', 3)];
    mocks.listParticipants.mockResolvedValueOnce({
      participants: [
        {
          ...participant('participant-1', 'Rita', 3),
          email: 'rita@example.com',
        },
      ],
    });
    mocks.apiRequest.mockImplementationOnce(async (_path, options) => ({
      participants: (options?.body as { participants: unknown[] }).participants,
      conflicts: [],
      syncedAt,
    }));

    await retrySync();

    expect(participantsStore.participants).toEqual([
      expect.objectContaining({
        id: 'participant-1',
        email: 'rita@example.com',
      }),
    ]);
  });

  it('does not push any core data when participant hydration fails', async () => {
    mocks.listParticipants.mockRejectedValueOnce(
      new Error('participant hydration failed')
    );

    await expect(retrySync()).rejects.toThrow('participant hydration failed');

    expect(mocks.apiRequest).not.toHaveBeenCalled();
    expect(mocks.syncMeetingsApi).not.toHaveBeenCalled();
    expect(mocks.syncTasksApi).not.toHaveBeenCalled();
    expect(mocks.writeSyncResourceMetadata).toHaveBeenCalledWith(
      'participants',
      expect.objectContaining({ lastFailedAt: expect.any(String) })
    );
  });

  it('preserves same-owner local participant changes through hydration', async () => {
    const participantsStore = useParticipantsStore();
    participantsStore.participants = [
      participant('local-participant', 'Local addition'),
    ];
    mocks.listParticipants.mockResolvedValueOnce({
      participants: [participant('server-participant', 'Rita', 2)],
    });
    mocks.apiRequest.mockImplementationOnce(async (_path, options) => ({
      participants: (options?.body as { participants: unknown[] }).participants,
      conflicts: [],
      syncedAt,
    }));

    await retrySync();

    const pushedParticipants = (
      mocks.apiRequest.mock.calls[0]?.[1]?.body as {
        participants: Array<{ id: string }>;
      }
    ).participants;
    expect(pushedParticipants.map(({ id }) => id)).toEqual([
      'local-participant',
      'server-participant',
    ]);
  });

  it('hydrates backend data before the first full push sync', async () => {
    const meetingsStore = useMeetingsStore();
    const tasksStore = useTasksStore();

    meetingsStore.meetings = [meeting('local-meeting', 'Local')];
    tasksStore.tasks = [task('local-task', 'Local task')];
    mocks.listMeetings.mockResolvedValueOnce({
      meetings: [meeting('remote-meeting', 'Remote')],
      activeMeetingId: 'remote-meeting',
      draftSavedAt: updatedAt,
      syncedAt,
    });
    mocks.listTasks.mockResolvedValueOnce({
      tasks: [task('remote-task', 'Remote task')],
      agreements: [],
      reviewDecisions: [
        {
          meetingId: 'remote-meeting',
          sourceMeetingId: 'source-meeting',
          decidedAt: updatedAt,
        },
      ],
      conflicts: [],
      syncedAt,
    });

    await retrySync();

    expect(mocks.ensureFirstSyncBackup).toHaveBeenCalled();
    expect(mocks.getWorkspace).toHaveBeenCalled();
    expect(mocks.listMeetings.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.syncMeetingsApi.mock.invocationCallOrder[0]
    );
    expect(mocks.listTasks.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.syncTasksApi.mock.invocationCallOrder[0]
    );
    expect(meetingsStore.meetings.map((item) => item.id)).toEqual([
      'local-meeting',
      'remote-meeting',
    ]);
    expect(tasksStore.tasks.map((item) => item.id)).toEqual([
      'local-task',
      'remote-task',
    ]);
    expect(mocks.syncTasksApi).toHaveBeenCalledWith(
      expect.objectContaining({
        lastSyncedAt: syncedAt,
        tasks: expect.arrayContaining([
          expect.objectContaining({ id: 'local-task' }),
          expect.objectContaining({ id: 'remote-task' }),
        ]),
      })
    );
  });

  it('keeps a locally selected active meeting during hydration', async () => {
    const meetingsStore = useMeetingsStore();
    const local = meeting('local-active', 'Local active');
    const remote = meeting('server-active', 'Server active');
    meetingsStore.meetings = [local, remote];
    meetingsStore.activeMeetingId = local.id;
    mocks.listMeetings.mockResolvedValueOnce({
      meetings: [remote],
      activeMeetingId: remote.id,
      draftSavedAt: null,
      syncedAt,
    });

    await retrySync();

    expect(meetingsStore.activeMeetingId).toBe(local.id);
  });

  it('keeps synced data when preparing sync for the same account', () => {
    const meetingsStore = useMeetingsStore();
    const tasksStore = useTasksStore();

    meetingsStore.meetings = [meeting('meeting-1')];
    tasksStore.tasks = [task('task-1')];
    mocks.readSyncMetadata.mockReturnValueOnce({
      version: 1,
      resources: {},
      ownerUserId: 'user-1',
      ownerWorkspaceId: 'workspace-1',
    });

    const result = prepareSyncForAuthenticatedUser('user-1');

    expect(result.didResetSyncedData).toBe(false);
    expect(meetingsStore.meetings).toHaveLength(1);
    expect(tasksStore.tasks).toHaveLength(1);
    expect(mocks.bindSyncOwner).toHaveBeenCalledWith('user-1', 'workspace-1');
    expect(mocks.resetSyncedAppDataForOwner).not.toHaveBeenCalled();
  });

  it('clears active synced stores when preparing sync for a different account', () => {
    const meetingsStore = useMeetingsStore();
    const participantsStore = useParticipantsStore();
    const tasksStore = useTasksStore();
    const privateNotesStore = usePrivateNotesStore();
    const workspaceStore = useWorkspaceStore();

    meetingsStore.meetings = [meeting('meeting-1')];
    meetingsStore.activeMeetingId = 'meeting-1';
    tasksStore.tasks = [task('task-1')];
    participantsStore.currentParticipantId = 'old-participant';
    workspaceStore.workspace = {
      id: 'old-workspace',
      name: 'Old household',
      ownerId: 'old-user',
      members: [
        {
          userId: 'old-user',
          displayName: 'Old owner',
          role: 'owner',
          status: 'active',
        },
        {
          userId: 'old-member',
          displayName: 'Old member',
          role: 'adult_member',
          status: 'active',
        },
      ],
      createdAt,
      updatedAt,
    };
    workspaceStore.currentUserId = 'old-user';
    workspaceStore.errorMessage = 'old error';
    workspaceStore.lastSyncedAt = syncedAt;
    privateNotesStore.notes = [
      {
        id: 'private-note-1',
        title: 'Private',
        content: 'Kept local',
        createdAt,
        updatedAt,
      },
    ];
    mocks.readSyncMetadata.mockReturnValueOnce({
      version: 1,
      resources: {},
      ownerUserId: 'old-user',
    });
    mocks.readStorageSlice.mockImplementation(
      (key: string, fallback: unknown) =>
        key === 'privateNotes'
          ? {
              notesByUserId: {
                'old-user': { notes: privateNotesStore.notes },
                'new-user': { notes: [] },
              },
            }
          : fallback
    );

    const result = prepareSyncForAuthenticatedUser('new-user');

    expect(result.didResetSyncedData).toBe(true);
    expect(mocks.resetSyncedAppDataForOwner).toHaveBeenCalledWith('new-user');
    expect(meetingsStore.meetings).toEqual([]);
    expect(meetingsStore.activeMeetingId).toBeNull();
    expect(tasksStore.tasks).toEqual([]);
    expect(participantsStore.currentParticipantId).toBeNull();
    expect(workspaceStore.workspace.ownerId).toBe('new-user');
    expect(workspaceStore.currentUserId).toBe('new-user');
    expect(workspaceStore.currentUserRole).toBe('viewer');
    expect(workspaceStore.workspace.name).not.toBe('Old household');
    expect(
      workspaceStore.workspace.members.some((member) =>
        ['Old owner', 'Old member'].includes(member.displayName)
      )
    ).toBe(false);
    expect(workspaceStore.errorMessage).toBe('');
    expect(workspaceStore.lastSyncedAt).toBeNull();
    expect(mocks.writeSettingsStorage).toHaveBeenCalledWith(
      'workspace',
      expect.objectContaining({
        currentUserId: 'new-user',
        workspace: expect.objectContaining({
          ownerId: 'new-user',
        }),
      })
    );
    expect(privateNotesStore.ownerUserId).toBe('new-user');
    expect(privateNotesStore.notes).toEqual([]);
  });

  it('clears notes on logout and restores only the returning owner namespace', () => {
    const privateNotesStore = usePrivateNotesStore();
    const noteA = {
      id: 'note-a',
      title: 'A',
      content: 'Private A',
      createdAt,
      updatedAt,
    };
    const noteB = { ...noteA, id: 'note-b', title: 'B', content: 'Private B' };
    mocks.readStorageSlice.mockImplementation(
      (key: string, fallback: unknown) =>
        key === 'privateNotes'
          ? {
              notesByUserId: {
                'user-a': { notes: [noteA] },
                'user-b': { notes: [noteB] },
              },
            }
          : fallback
    );

    prepareSyncForAuthenticatedUser('user-a');
    expect(privateNotesStore.notes).toEqual([noteA]);

    clearSyncSessionState();
    expect(privateNotesStore.ownerUserId).toBeNull();
    expect(privateNotesStore.notes).toEqual([]);

    prepareSyncForAuthenticatedUser('user-b');
    expect(privateNotesStore.notes).toEqual([noteB]);

    clearSyncSessionState();
    prepareSyncForAuthenticatedUser('user-a');
    expect(privateNotesStore.notes).toEqual([noteA]);
  });

  it('fails closed when workspace hydration fails before pulling core data', async () => {
    mocks.getWorkspace.mockRejectedValueOnce(new Error('workspace failed'));

    await expect(retrySync()).rejects.toThrow('workspace.loadFailed');

    expect(mocks.bindSyncOwner).not.toHaveBeenCalled();
    expect(mocks.listMeetings).not.toHaveBeenCalled();
    expect(mocks.listTasks).not.toHaveBeenCalled();
    expect(mocks.syncMeetingsApi).not.toHaveBeenCalled();
    expect(mocks.syncTasksApi).not.toHaveBeenCalled();
  });

  it('binds workspace ownership during hydration', async () => {
    mocks.readSyncMetadata.mockReturnValue({
      version: 1,
      resources: {},
      ownerUserId: 'user-1',
    });

    await retrySync();

    expect(mocks.bindSyncOwner).toHaveBeenCalledWith('user-1', 'workspace-1');
  });

  it('runs full core sync in participant, meeting, task order', async () => {
    await syncCoreData();

    expect(mocks.apiRequest.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.syncMeetingsApi.mock.invocationCallOrder[0]
    );
    expect(mocks.syncMeetingsApi.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.syncTasksApi.mock.invocationCallOrder[0]
    );
  });

  it('does not sync meetings or tasks when participant sync fails during full core sync', async () => {
    mocks.apiRequest.mockRejectedValueOnce(new Error('participant failed'));

    await expect(syncCoreData()).rejects.toThrow('participant failed');

    expect(mocks.syncMeetingsApi).not.toHaveBeenCalled();
    expect(mocks.syncTasksApi).not.toHaveBeenCalled();
  });

  it('does not sync tasks when meeting sync fails during full core sync', async () => {
    mocks.syncMeetingsApi.mockRejectedValueOnce(new Error('meeting failed'));

    await syncCoreData();

    expect(mocks.syncTasksApi).not.toHaveBeenCalled();
  });

  it('sends local tombstones and removes them after a successful sync', async () => {
    const tasksStore = useTasksStore();
    tasksStore.tasks = [task('task-1', 'Buy shoes')];

    tasksStore.deleteTask('task-1');

    expect(tasksStore.tasks).toHaveLength(1);
    expect(tasksStore.tasks[0].deletedAt).toEqual(expect.any(String));
    expect(tasksStore.openTasks).toEqual([]);

    await syncTasks();

    expect(mocks.syncTasksApi).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: [
          expect.objectContaining({
            id: 'task-1',
            deletedAt: expect.any(String),
          }),
        ],
      })
    );
    expect(tasksStore.tasks).toEqual([]);
  });

  it('applies remote deletion tombstones without deleting unrelated local data', async () => {
    const tasksStore = useTasksStore();
    tasksStore.tasks = [
      task('task-1', 'Remote deleted'),
      task('task-2', 'Keep local'),
    ];
    mocks.syncTasksApi.mockResolvedValueOnce({
      tasks: [
        {
          ...task('task-1', 'Remote deleted'),
          deletedAt: '2026-06-13T12:15:00.000Z',
        },
      ],
      agreements: [],
      reviewDecisions: [],
      conflicts: [],
      syncedAt,
    });

    await syncTasks();

    expect(tasksStore.tasks.map((item) => item.id)).toEqual(['task-2']);
  });

  it('keeps local data when backend sync fails', async () => {
    const tasksStore = useTasksStore();
    tasksStore.tasks = [task('task-1', 'Keep me')];
    mocks.syncTasksApi.mockRejectedValueOnce(new Error('backend failed'));

    await expect(syncTasks()).rejects.toThrow('backend failed');

    expect(tasksStore.tasks).toEqual([
      expect.objectContaining({ id: 'task-1' }),
    ]);
    expect(mocks.writeSyncResourceMetadata).toHaveBeenCalledWith(
      'tasks',
      expect.objectContaining({ lastFailedAt: expect.any(String) })
    );
  });

  it('keeps authenticated local data queued while offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const tasksStore = useTasksStore();
    tasksStore.tasks = [task('task-1', 'Keep offline')];

    const result = await syncTasks();

    expect(result.mode).toBe('backend');
    expect(result.skippedReason).toBe('sync.offline');
    expect(tasksStore.tasks).toEqual([
      expect.objectContaining({ id: 'task-1' }),
    ]);
    expect(mocks.syncTasksApi).not.toHaveBeenCalled();
  });
});
