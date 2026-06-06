import { describe, expect, it, vi } from 'vitest';

import type { AgreementDto as AgreementRepositoryDto, TaskDto as TaskRepositoryDto } from '../src/modules/tasks/tasks.repository.js';
import type { AgreementDto, TaskDto } from '../src/modules/tasks/tasks.schema.js';
import { TasksService } from '../src/modules/tasks/tasks.service.js';
import type { AuthContext } from '../src/shared/auth/index.js';

const now = '2026-06-06T10:00:00.000Z';
const taskId = '11111111-1111-4111-8111-111111111111';
const agreementId = '22222222-2222-4222-8222-222222222222';
const sourceMeetingId = '33333333-3333-4333-8333-333333333333';
const reviewMeetingId = '44444444-4444-4444-8444-444444444444';

const auth = {
  userId: 'user_1',
  sessionId: 'session_1',
  workspaceId: 'workspace_1',
  role: 'owner',
  planType: 'free',
} satisfies AuthContext;

const viewerAuth = {
  ...auth,
  role: 'viewer',
} satisfies AuthContext;

function apiTask(overrides: Partial<TaskDto> = {}): TaskDto {
  return {
    id: taskId,
    title: 'Buy groceries',
    responsibilityType: 'participant',
    responsibleParticipantIds: ['participant_1'],
    status: 'open',
    sourceMeetingId,
    createdAt: '2026-06-06T09:00:00.000Z',
    updatedAt: '2026-06-06T09:00:00.000Z',
    serverRevision: 1,
    ...overrides,
  };
}

function repositoryTask(overrides: Partial<TaskRepositoryDto> = {}): TaskRepositoryDto {
  const task = apiTask(overrides as Partial<TaskDto>);

  return {
    id: task.id,
    workspaceId: 'workspace_1',
    title: task.title,
    description: task.description ?? null,
    responsibilityType: task.responsibilityType,
    responsibleParticipantIds: task.responsibleParticipantIds,
    dueDate: task.dueDate ?? null,
    status: task.status,
    sourceMeetingId: task.sourceMeetingId ?? null,
    serverRevision: task.serverRevision ?? 1,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    deletedAt: task.deletedAt ?? null,
    ...overrides,
  };
}

function apiAgreement(overrides: Partial<AgreementDto> = {}): AgreementDto {
  return {
    id: agreementId,
    title: 'Keep Sunday quiet',
    participantIds: ['participant_1'],
    relatedTaskIds: [taskId],
    sourceMeetingId,
    createdAt: '2026-06-06T09:00:00.000Z',
    updatedAt: '2026-06-06T09:00:00.000Z',
    serverRevision: 1,
    ...overrides,
  };
}

function repositoryAgreement(overrides: Partial<AgreementRepositoryDto> = {}): AgreementRepositoryDto {
  const agreement = apiAgreement(overrides as Partial<AgreementDto>);

  return {
    id: agreement.id,
    workspaceId: 'workspace_1',
    title: agreement.title,
    description: agreement.description ?? null,
    participantIds: agreement.participantIds,
    relatedTaskIds: agreement.relatedTaskIds ?? [],
    sourceMeetingId: agreement.sourceMeetingId,
    serverRevision: agreement.serverRevision ?? 1,
    createdAt: agreement.createdAt,
    updatedAt: agreement.updatedAt,
    deletedAt: agreement.deletedAt ?? null,
    ...overrides,
  };
}

function createRepositories() {
  return {
    tasks: {
      listTasksForWorkspace: vi.fn().mockResolvedValue([]),
      findTaskByIdForWorkspace: vi.fn().mockResolvedValue(null),
      insertTask: vi.fn(),
      updateTaskIfRevisionMatches: vi.fn(),
      softDeleteTaskIfRevisionMatches: vi.fn(),
      listAgreementsForWorkspace: vi.fn().mockResolvedValue([]),
      findAgreementByIdForWorkspace: vi.fn().mockResolvedValue(null),
      insertAgreement: vi.fn(),
      updateAgreementIfRevisionMatches: vi.fn(),
      softDeleteAgreementIfRevisionMatches: vi.fn(),
      listReviewDecisionsForWorkspace: vi.fn().mockResolvedValue([]),
      createReviewDecision: vi.fn(),
    },
    participants: {
      listParticipantsForWorkspace: vi.fn().mockResolvedValue([
        { id: 'participant_1' },
      ]),
    },
    meetings: {
      findMeetingByIdForWorkspace: vi.fn().mockResolvedValue({ id: sourceMeetingId }),
    },
  };
}

describe('TasksService', () => {
  it('lists API DTOs without workspace IDs and returns open tasks first', async () => {
    const repos = createRepositories();
    repos.tasks.listTasksForWorkspace.mockResolvedValue([
      repositoryTask({ id: 'done_task', status: 'done', updatedAt: '2026-06-06T09:30:00.000Z' }),
      repositoryTask({ id: taskId, status: 'open', updatedAt: '2026-06-06T09:00:00.000Z' }),
    ]);
    repos.tasks.listAgreementsForWorkspace.mockResolvedValue([repositoryAgreement()]);
    repos.tasks.listReviewDecisionsForWorkspace.mockResolvedValue([
      {
        workspaceId: 'workspace_1',
        meetingId: reviewMeetingId,
        sourceMeetingId,
        decidedAt: '2026-06-06T09:15:00.000Z',
      },
    ]);

    const service = new TasksService(repos.tasks, repos.participants, repos.meetings);
    const response = await service.listTasks(auth, new Date(now));

    expect(response.tasks.map((task) => task.id)).toEqual([taskId, 'done_task']);
    expect(response.tasks[0]).not.toHaveProperty('workspaceId');
    expect(response.agreements[0]).not.toHaveProperty('workspaceId');
    expect(response.reviewDecisions).toEqual([
      {
        meetingId: reviewMeetingId,
        sourceMeetingId,
        decidedAt: '2026-06-06T09:15:00.000Z',
      },
    ]);
  });

  it('syncs tasks, agreements, and review decisions after validating references', async () => {
    const repos = createRepositories();
    const task = apiTask({ status: 'skipped' });
    const agreement = apiAgreement();
    repos.tasks.listTasksForWorkspace
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([repositoryTask({ status: 'skipped' })]);
    repos.tasks.listAgreementsForWorkspace.mockResolvedValue([repositoryAgreement()]);
    repos.tasks.insertTask.mockResolvedValue(repositoryTask({ status: 'skipped' }));
    repos.tasks.insertAgreement.mockResolvedValue(repositoryAgreement());

    const service = new TasksService(repos.tasks, repos.participants, repos.meetings);
    const response = await service.syncTasks(auth, {
      tasks: [task],
      agreements: [agreement],
      reviewDecisions: [
        {
          meetingId: reviewMeetingId,
          sourceMeetingId,
          decidedAt: '2026-06-06T09:15:00.000Z',
        },
      ],
      clientUpdatedAt: now,
    }, new Date(now));

    expect(repos.meetings.findMeetingByIdForWorkspace).toHaveBeenCalledWith('workspace_1', sourceMeetingId);
    expect(repos.tasks.insertTask).toHaveBeenCalledWith(expect.objectContaining({
      id: taskId,
      status: 'skipped',
      sourceMeetingId,
    }));
    expect(repos.tasks.insertAgreement).toHaveBeenCalledWith(expect.objectContaining({
      id: agreementId,
      relatedTaskIds: [taskId],
    }));
    expect(repos.tasks.createReviewDecision).toHaveBeenCalledWith({
      workspaceId: 'workspace_1',
      meetingId: reviewMeetingId,
      sourceMeetingId,
      decidedAt: '2026-06-06T09:15:00.000Z',
    });
    expect(response.conflicts).toEqual([]);
  });

  it('returns a task invalid-reference conflict for unknown responsible participants', async () => {
    const repos = createRepositories();
    const task = apiTask({ responsibleParticipantIds: ['participant_missing'] });

    const service = new TasksService(repos.tasks, repos.participants, repos.meetings);
    const response = await service.syncTasks(auth, {
      tasks: [task],
      agreements: [],
      reviewDecisions: [],
      clientUpdatedAt: now,
    }, new Date(now));

    expect(repos.tasks.insertTask).not.toHaveBeenCalled();
    expect(response.conflicts).toEqual([
      expect.objectContaining({
        resourceType: 'task',
        resourceId: taskId,
        reason: 'invalid_reference',
      }),
    ]);
  });

  it('validates agreement related task IDs separately from task conflicts', async () => {
    const repos = createRepositories();
    const agreement = apiAgreement({ relatedTaskIds: ['missing_task'] });

    const service = new TasksService(repos.tasks, repos.participants, repos.meetings);
    const response = await service.syncTasks(auth, {
      tasks: [],
      agreements: [agreement],
      reviewDecisions: [],
      clientUpdatedAt: now,
    }, new Date(now));

    expect(repos.tasks.insertAgreement).not.toHaveBeenCalled();
    expect(response.conflicts).toEqual([
      expect.objectContaining({
        resourceType: 'agreement',
        resourceId: agreementId,
        reason: 'invalid_reference',
      }),
    ]);
  });

  it('returns a task conflict instead of overwriting concurrent task edits', async () => {
    const repos = createRepositories();
    const server = repositoryTask({
      title: 'Server title',
      serverRevision: 2,
      updatedAt: '2026-06-06T09:30:00.000Z',
    });
    const client = apiTask({
      title: 'Client title',
      serverRevision: 1,
      updatedAt: '2026-06-06T09:45:00.000Z',
    });
    repos.tasks.findTaskByIdForWorkspace.mockResolvedValue(server);
    repos.tasks.listTasksForWorkspace
      .mockResolvedValueOnce([server])
      .mockResolvedValueOnce([server]);

    const service = new TasksService(repos.tasks, repos.participants, repos.meetings);
    const response = await service.syncTasks(auth, {
      tasks: [client],
      agreements: [],
      reviewDecisions: [],
      clientUpdatedAt: now,
      lastSyncedAt: '2026-06-06T09:15:00.000Z',
    }, new Date(now));

    expect(repos.tasks.updateTaskIfRevisionMatches).not.toHaveBeenCalled();
    expect(response.conflicts).toEqual([
      expect.objectContaining({
        resourceType: 'task',
        reason: 'updated_on_client_and_server',
        baseServerRevision: 1,
        serverRevision: 2,
      }),
    ]);
    expect(response.conflicts[0]?.clientVersion?.title).toBe('Client title');
    expect(response.conflicts[0]?.serverVersion?.title).toBe('Server title');
  });

  it('prevalidates review decisions before mutating tasks or agreements', async () => {
    const repos = createRepositories();
    repos.meetings.findMeetingByIdForWorkspace.mockImplementation(
      async (_workspaceId: string, meetingId: string) => (
        meetingId === reviewMeetingId ? null : { id: meetingId }
      ),
    );

    const service = new TasksService(repos.tasks, repos.participants, repos.meetings);

    await expect(service.syncTasks(auth, {
      tasks: [apiTask()],
      agreements: [apiAgreement()],
      reviewDecisions: [
        {
          meetingId: reviewMeetingId,
          sourceMeetingId,
          decidedAt: '2026-06-06T09:15:00.000Z',
        },
      ],
      clientUpdatedAt: now,
    }, new Date(now))).rejects.toMatchObject({
      statusCode: 422,
      code: 'task_review_decision_invalid_reference',
    });

    expect(repos.participants.listParticipantsForWorkspace).not.toHaveBeenCalled();
    expect(repos.tasks.listTasksForWorkspace).not.toHaveBeenCalled();
    expect(repos.tasks.insertTask).not.toHaveBeenCalled();
    expect(repos.tasks.insertAgreement).not.toHaveBeenCalled();
    expect(repos.tasks.createReviewDecision).not.toHaveBeenCalled();
  });

  it('returns accepted task and agreement deletions as tombstones', async () => {
    const repos = createRepositories();
    const deletedAt = '2026-06-06T09:45:00.000Z';
    const serverTask = repositoryTask({ serverRevision: 1 });
    const deletedTask = repositoryTask({
      serverRevision: 2,
      deletedAt,
      updatedAt: deletedAt,
    });
    const serverAgreement = repositoryAgreement({ serverRevision: 1 });
    const deletedAgreement = repositoryAgreement({
      serverRevision: 2,
      deletedAt,
      updatedAt: deletedAt,
    });

    repos.tasks.listTasksForWorkspace
      .mockResolvedValueOnce([serverTask])
      .mockResolvedValueOnce([]);
    repos.tasks.findTaskByIdForWorkspace.mockResolvedValue(serverTask);
    repos.tasks.softDeleteTaskIfRevisionMatches.mockResolvedValue(deletedTask);
    repos.tasks.findAgreementByIdForWorkspace.mockResolvedValue(serverAgreement);
    repos.tasks.softDeleteAgreementIfRevisionMatches.mockResolvedValue(deletedAgreement);
    repos.tasks.listAgreementsForWorkspace.mockResolvedValue([]);

    const service = new TasksService(repos.tasks, repos.participants, repos.meetings);
    const response = await service.syncTasks(auth, {
      tasks: [apiTask({ deletedAt })],
      agreements: [apiAgreement({ deletedAt })],
      reviewDecisions: [],
      clientUpdatedAt: now,
      lastSyncedAt: '2026-06-06T09:30:00.000Z',
    }, new Date(now));

    expect(repos.tasks.softDeleteTaskIfRevisionMatches)
      .toHaveBeenCalledWith('workspace_1', taskId, 1, deletedAt);
    expect(repos.tasks.softDeleteAgreementIfRevisionMatches)
      .toHaveBeenCalledWith('workspace_1', agreementId, 1, deletedAt);
    expect(response.tasks).toEqual([
      expect.objectContaining({
        id: taskId,
        deletedAt,
        serverRevision: 2,
      }),
    ]);
    expect(response.agreements).toEqual([
      expect.objectContaining({
        id: agreementId,
        deletedAt,
        serverRevision: 2,
      }),
    ]);
    expect(response.conflicts).toEqual([]);
  });

  it('blocks viewers from syncing tasks', async () => {
    const repos = createRepositories();
    const service = new TasksService(repos.tasks, repos.participants, repos.meetings);

    await expect(service.syncTasks(viewerAuth, {
      tasks: [apiTask()],
      agreements: [],
      reviewDecisions: [],
      clientUpdatedAt: now,
    }, new Date(now))).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden',
    });
    expect(repos.participants.listParticipantsForWorkspace).not.toHaveBeenCalled();
    expect(repos.tasks.insertTask).not.toHaveBeenCalled();
  });
});
