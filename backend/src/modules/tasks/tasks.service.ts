import { requireMinimumRole, type AuthContext } from '../../shared/auth/index.js';
import { ApiError } from '../../shared/errors/index.js';
import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import type { SyncConflictDto } from '../../shared/sync/index.js';
import { MeetingsRepository } from '../meetings/meetings.repository.js';
import { ParticipantsRepository } from '../participants/participants.repository.js';
import { WorkspacesRepository } from '../workspace/workspaces.repository.js';
import {
  TasksRepository,
  type AgreementDto as AgreementRepositoryDto,
  type TaskDto as TaskRepositoryDto,
  type TaskReviewDecisionDto as TaskReviewDecisionRepositoryDto,
  type UpdateAgreementIfRevisionMatchesInput,
  type UpdateTaskIfRevisionMatchesInput,
  type UpsertAgreementInput,
  type UpsertTaskInput,
} from './tasks.repository.js';
import {
  agreementSchema,
  taskReviewDecisionSchema,
  taskSchema,
  type AgreementDto,
  type SyncTasksRequestDto,
  type SyncTasksResponseDto,
  type TaskDto,
  type TaskReviewDecisionDto,
} from './tasks.schema.js';

type TaskConflict = SyncConflictDto<TaskDto> & { resourceType: 'task' };
type AgreementConflict = SyncConflictDto<AgreementDto> & { resourceType: 'agreement' };
type TaskOrAgreementConflict = TaskConflict | AgreementConflict;

type TaskSyncApplyResult = {
  state: 'active' | 'deleted' | 'unchanged';
  tombstone?: TaskDto;
};

type TaskRepositoryPort = Pick<
  TasksRepository,
  | 'listTasksForWorkspace'
  | 'findTaskByIdForWorkspace'
  | 'insertTask'
  | 'updateTaskIfRevisionMatches'
  | 'softDeleteTaskIfRevisionMatches'
  | 'listAgreementsForWorkspace'
  | 'findAgreementByIdForWorkspace'
  | 'insertAgreement'
  | 'updateAgreementIfRevisionMatches'
  | 'softDeleteAgreementIfRevisionMatches'
  | 'listReviewDecisionsForWorkspace'
  | 'createReviewDecision'
>;

type ParticipantRepositoryPort = {
  listParticipantsForWorkspace(workspaceId: string): Promise<Array<{ id: string }>>;
};

type MeetingRepositoryPort = {
  findMeetingByIdForWorkspace(
    workspaceId: string,
    meetingId: string,
    includeDeleted?: boolean,
  ): Promise<unknown | null>;
};

type WorkspaceMembersPort = Pick<WorkspacesRepository, 'listActiveMembersForWorkspace'>;

type CalendarTaskSyncPort = {
  syncAssignedTaskForUser(input: {
    workspaceId: string;
    userId: string;
    task: Pick<TaskRepositoryDto, 'id' | 'title' | 'dueDate' | 'status' | 'deletedAt'>;
  }): Promise<unknown>;
};

function taskRepositoryDtoToApiDto(row: TaskRepositoryDto): TaskDto {
  return taskSchema.parse({
    id: row.id,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    responsibilityType: row.responsibilityType,
    responsibleParticipantIds: row.responsibleParticipantIds,
    responsibleUserIds: row.responsibleUserIds,
    ...(row.dueDate ? { dueDate: row.dueDate } : {}),
    status: row.status,
    ...(row.sourceMeetingId ? { sourceMeetingId: row.sourceMeetingId } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    serverRevision: row.serverRevision,
    ...(row.deletedAt ? { deletedAt: row.deletedAt } : {}),
  });
}

function agreementRepositoryDtoToApiDto(row: AgreementRepositoryDto): AgreementDto {
  return agreementSchema.parse({
    id: row.id,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    participantIds: row.participantIds,
    relatedTaskIds: row.relatedTaskIds.length > 0 ? row.relatedTaskIds : undefined,
    sourceMeetingId: row.sourceMeetingId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    serverRevision: row.serverRevision,
    ...(row.deletedAt ? { deletedAt: row.deletedAt } : {}),
  });
}

function reviewDecisionRepositoryDtoToApiDto(row: TaskReviewDecisionRepositoryDto): TaskReviewDecisionDto {
  return taskReviewDecisionSchema.parse({
    meetingId: row.meetingId,
    sourceMeetingId: row.sourceMeetingId,
    decidedAt: row.decidedAt,
  });
}

function sortTasks(tasks: TaskDto[]) {
  const statusRank: Record<TaskDto['status'], number> = {
    open: 0,
    done: 1,
    skipped: 1,
  };

  return [...tasks].sort((left, right) => {
    const byStatus = statusRank[left.status] - statusRank[right.status];

    if (byStatus !== 0) {
      return byStatus;
    }

    const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);

    return byUpdatedAt === 0 ? left.id.localeCompare(right.id) : byUpdatedAt;
  });
}

function sortAgreements(agreements: AgreementDto[]) {
  return [...agreements].sort((left, right) => {
    const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);

    return byUpdatedAt === 0 ? left.id.localeCompare(right.id) : byUpdatedAt;
  });
}

function taskToUpsertInput(task: TaskDto, workspaceId: string): UpsertTaskInput & { id: string } {
  return {
    id: task.id,
    workspaceId,
    title: task.title,
    description: task.description ?? null,
    responsibilityType: task.responsibilityType,
    responsibleParticipantIds: [...task.responsibleParticipantIds],
    responsibleUserIds: [...(task.responsibleUserIds ?? [])],
    dueDate: task.dueDate ?? null,
    status: task.status,
    sourceMeetingId: task.sourceMeetingId ?? null,
    serverRevision: 1,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

function agreementToUpsertInput(agreement: AgreementDto, workspaceId: string): UpsertAgreementInput & { id: string } {
  return {
    id: agreement.id,
    workspaceId,
    title: agreement.title,
    description: agreement.description ?? null,
    participantIds: [...agreement.participantIds],
    relatedTaskIds: [...(agreement.relatedTaskIds ?? [])],
    sourceMeetingId: agreement.sourceMeetingId,
    serverRevision: 1,
    createdAt: agreement.createdAt,
    updatedAt: agreement.updatedAt,
  };
}

function taskToUpdateInput(
  task: TaskDto,
  workspaceId: string,
  expectedServerRevision: number,
): UpdateTaskIfRevisionMatchesInput {
  return {
    id: task.id,
    workspaceId,
    title: task.title,
    description: task.description ?? null,
    responsibilityType: task.responsibilityType,
    responsibleParticipantIds: [...task.responsibleParticipantIds],
    responsibleUserIds: [...(task.responsibleUserIds ?? [])],
    dueDate: task.dueDate ?? null,
    status: task.status,
    sourceMeetingId: task.sourceMeetingId ?? null,
    expectedServerRevision,
  };
}

function agreementToUpdateInput(
  agreement: AgreementDto,
  workspaceId: string,
  expectedServerRevision: number,
): UpdateAgreementIfRevisionMatchesInput {
  return {
    id: agreement.id,
    workspaceId,
    title: agreement.title,
    description: agreement.description ?? null,
    participantIds: [...agreement.participantIds],
    relatedTaskIds: [...(agreement.relatedTaskIds ?? [])],
    sourceMeetingId: agreement.sourceMeetingId,
    expectedServerRevision,
  };
}

function sameStringArray(left: string[], right: string[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function hasTaskContentChanged(client: TaskDto, server: TaskRepositoryDto) {
  return (
    client.title !== server.title ||
    (client.description ?? null) !== server.description ||
    client.responsibilityType !== server.responsibilityType ||
    !sameStringArray(client.responsibleParticipantIds, server.responsibleParticipantIds) ||
    !sameStringArray(client.responsibleUserIds ?? [], server.responsibleUserIds) ||
    (client.dueDate ?? null) !== server.dueDate ||
    client.status !== server.status ||
    (client.sourceMeetingId ?? null) !== server.sourceMeetingId
  );
}

function hasAgreementContentChanged(client: AgreementDto, server: AgreementRepositoryDto) {
  return (
    client.title !== server.title ||
    (client.description ?? null) !== server.description ||
    !sameStringArray(client.participantIds, server.participantIds) ||
    !sameStringArray(client.relatedTaskIds ?? [], server.relatedTaskIds) ||
    client.sourceMeetingId !== server.sourceMeetingId
  );
}

function hasServerConflict(
  client: { serverRevision?: number },
  server: { serverRevision: number; updatedAt: string },
  lastSyncedAt?: string,
) {
  if (client.serverRevision !== undefined) {
    return client.serverRevision !== server.serverRevision;
  }

  if (!lastSyncedAt) {
    return true;
  }

  return server.updatedAt > lastSyncedAt;
}

function createTaskConflict(input: {
  client: TaskDto;
  server?: TaskRepositoryDto | null;
  reason: TaskConflict['reason'];
  detectedAt: string;
}): TaskConflict {
  const serverVersion = input.server ? taskRepositoryDtoToApiDto(input.server) : undefined;
  const baseRevision = input.client.serverRevision !== undefined
    ? { baseServerRevision: input.client.serverRevision }
    : {};
  const serverRevision = serverVersion?.serverRevision !== undefined
    ? { serverRevision: serverVersion.serverRevision }
    : {};

  return {
    resourceType: 'task',
    resourceId: input.client.id,
    reason: input.reason,
    ...baseRevision,
    ...serverRevision,
    detectedAt: input.detectedAt,
    clientVersion: input.client,
    ...(serverVersion ? { serverVersion } : {}),
  };
}

function createAgreementConflict(input: {
  client: AgreementDto;
  server?: AgreementRepositoryDto | null;
  reason: AgreementConflict['reason'];
  detectedAt: string;
}): AgreementConflict {
  const serverVersion = input.server ? agreementRepositoryDtoToApiDto(input.server) : undefined;
  const baseRevision = input.client.serverRevision !== undefined
    ? { baseServerRevision: input.client.serverRevision }
    : {};
  const serverRevision = serverVersion?.serverRevision !== undefined
    ? { serverRevision: serverVersion.serverRevision }
    : {};

  return {
    resourceType: 'agreement',
    resourceId: input.client.id,
    reason: input.reason,
    ...baseRevision,
    ...serverRevision,
    detectedAt: input.detectedAt,
    clientVersion: input.client,
    ...(serverVersion ? { serverVersion } : {}),
  };
}

function assertUniqueIds(items: Array<{ id: string }>, code: string, label: string) {
  const seen = new Set<string>();

  for (const item of items) {
    if (seen.has(item.id)) {
      throw new ApiError(422, code, `${label} IDs must be unique.`, { id: item.id });
    }

    seen.add(item.id);
  }
}

function missingIds(ids: Iterable<string>, validIds: Set<string>) {
  return [...new Set(ids)].filter((id) => !validIds.has(id)).sort();
}

export class TasksService {
  constructor(
    private readonly tasksRepository: TaskRepositoryPort,
    private readonly participantsRepository: ParticipantRepositoryPort,
    private readonly meetingsRepository: MeetingRepositoryPort,
    private readonly calendarSync?: CalendarTaskSyncPort,
    private readonly workspaceMembersRepository?: WorkspaceMembersPort,
  ) {}

  async listTasks(auth: AuthContext, now = new Date()): Promise<SyncTasksResponseDto> {
    const [tasks, agreements, reviewDecisions] = await Promise.all([
      this.tasksRepository.listTasksForWorkspace(auth.workspaceId),
      this.tasksRepository.listAgreementsForWorkspace(auth.workspaceId),
      this.tasksRepository.listReviewDecisionsForWorkspace(auth.workspaceId),
    ]);

    return {
      tasks: sortTasks(tasks.map(taskRepositoryDtoToApiDto)),
      agreements: sortAgreements(agreements.map(agreementRepositoryDtoToApiDto)),
      reviewDecisions: reviewDecisions.map(reviewDecisionRepositoryDtoToApiDto),
      conflicts: [],
      syncedAt: now.toISOString(),
    };
  }

  async syncTasks(
    auth: AuthContext,
    request: SyncTasksRequestDto,
    now = new Date(),
  ): Promise<SyncTasksResponseDto> {
    requireMinimumRole(auth, 'adult_member');
    assertUniqueIds(request.tasks, 'duplicate_task_id', 'Task');
    assertUniqueIds(request.agreements, 'duplicate_agreement_id', 'Agreement');

    const syncedAt = now.toISOString();
    const sourceMeetingCache = new Map<string, boolean>();
    await this.validateReviewDecisions(
      auth.workspaceId,
      request.reviewDecisions,
      sourceMeetingCache,
    );

    const participants = await this.participantsRepository.listParticipantsForWorkspace(
      auth.workspaceId,
    );
    const validParticipantIds = new Set(participants.map((participant) => participant.id));
    const activeMembers = this.workspaceMembersRepository
      ? await this.workspaceMembersRepository.listActiveMembersForWorkspace(auth.workspaceId)
      : [];
    const validResponsibleUserIds = new Set(
      activeMembers
        .filter((member) => member.role === 'owner' || member.role === 'adult_member')
        .map((member) => member.userId),
    );
    const existingTasks = await this.tasksRepository.listTasksForWorkspace(auth.workspaceId);
    const validTaskIds = new Set(existingTasks.map((task) => task.id));
    const conflicts: TaskOrAgreementConflict[] = [];
    const deletedTaskTombstones: TaskDto[] = [];
    const deletedAgreementTombstones: AgreementDto[] = [];

    for (const task of request.tasks) {
      const valid = await this.validateTaskReferences(
        auth.workspaceId,
        task,
        validParticipantIds,
        validResponsibleUserIds,
        sourceMeetingCache,
      );

      if (!valid) {
        conflicts.push(createTaskConflict({
          client: task,
          reason: 'invalid_reference',
          detectedAt: syncedAt,
        }));
        continue;
      }

      const accepted = await this.applyTaskSync(
        auth.workspaceId,
        task,
        request.lastSyncedAt,
        syncedAt,
        conflicts,
      );

      if (accepted.state === 'active') {
        validTaskIds.add(task.id);
        if ((task.responsibleUserIds ?? []).length > 0 && this.calendarSync) {
          try {
            await Promise.all((task.responsibleUserIds ?? []).map((userId) =>
              this.calendarSync!.syncAssignedTaskForUser({
                workspaceId: auth.workspaceId,
                userId,
                task: {
                  id: task.id,
                  title: task.title,
                  dueDate: task.dueDate ?? null,
                  status: task.status,
                  deletedAt: task.deletedAt ?? null,
                },
              }),
            ));
          } catch {
            // Calendar is an optional integration; a sync failure cannot reject a task save.
          }
        }
      }

      if (accepted.state === 'deleted') {
        validTaskIds.delete(task.id);
      }

      if (accepted.tombstone) {
        deletedTaskTombstones.push(accepted.tombstone);
      }
    }

    for (const agreement of request.agreements) {
      const valid = await this.validateAgreementReferences(
        auth.workspaceId,
        agreement,
        validParticipantIds,
        validTaskIds,
        sourceMeetingCache,
      );

      if (!valid) {
        conflicts.push(createAgreementConflict({
          client: agreement,
          reason: 'invalid_reference',
          detectedAt: syncedAt,
        }));
        continue;
      }

      const deletedAgreement = await this.applyAgreementSync(
        auth.workspaceId,
        agreement,
        request.lastSyncedAt,
        syncedAt,
        conflicts,
      );

      if (deletedAgreement) {
        deletedAgreementTombstones.push(deletedAgreement);
      }
    }

    await this.syncReviewDecisions(auth.workspaceId, request.reviewDecisions);

    const response = await this.listTasks(auth, now);

    return {
      ...response,
      tasks: sortTasks([...response.tasks, ...deletedTaskTombstones]),
      agreements: sortAgreements([...response.agreements, ...deletedAgreementTombstones]),
      conflicts,
      syncedAt,
    };
  }

  private async validateTaskReferences(
    workspaceId: string,
    task: TaskDto,
    validParticipantIds: Set<string>,
    validResponsibleUserIds: Set<string>,
    sourceMeetingCache: Map<string, boolean>,
  ) {
    if (task.deletedAt) {
      return true;
    }

    if (missingIds(task.responsibleParticipantIds, validParticipantIds).length > 0) {
      return false;
    }

    if (missingIds(task.responsibleUserIds ?? [], validResponsibleUserIds).length > 0) {
      return false;
    }

    if (!task.sourceMeetingId) {
      return true;
    }

    return this.meetingExists(workspaceId, task.sourceMeetingId, sourceMeetingCache);
  }

  private async validateAgreementReferences(
    workspaceId: string,
    agreement: AgreementDto,
    validParticipantIds: Set<string>,
    validTaskIds: Set<string>,
    sourceMeetingCache: Map<string, boolean>,
  ) {
    if (agreement.deletedAt) {
      return true;
    }

    if (missingIds(agreement.participantIds, validParticipantIds).length > 0) {
      return false;
    }

    if (missingIds(agreement.relatedTaskIds ?? [], validTaskIds).length > 0) {
      return false;
    }

    return this.meetingExists(workspaceId, agreement.sourceMeetingId, sourceMeetingCache);
  }

  private async meetingExists(
    workspaceId: string,
    meetingId: string,
    cache: Map<string, boolean>,
  ) {
    const cached = cache.get(meetingId);

    if (cached !== undefined) {
      return cached;
    }

    const meeting = await this.meetingsRepository.findMeetingByIdForWorkspace(
      workspaceId,
      meetingId,
      true,
    );
    const exists = Boolean(meeting);
    cache.set(meetingId, exists);

    return exists;
  }

  private async applyTaskSync(
    workspaceId: string,
    task: TaskDto,
    lastSyncedAt: string | undefined,
    detectedAt: string,
    conflicts: TaskOrAgreementConflict[],
  ): Promise<TaskSyncApplyResult> {
    const serverTask = await this.tasksRepository.findTaskByIdForWorkspace(
      workspaceId,
      task.id,
      true,
    );

    if (!serverTask) {
      if (task.deletedAt) {
        return { state: 'unchanged' };
      }

      await this.tasksRepository.insertTask(taskToUpsertInput(task, workspaceId));
      return { state: 'active' };
    }

    if (serverTask.deletedAt && !task.deletedAt) {
      conflicts.push(createTaskConflict({
        client: task,
        server: serverTask,
        reason: 'deleted_on_server_updated_on_client',
        detectedAt,
      }));
      return { state: 'unchanged' };
    }

    const hasConflict = hasServerConflict(task, serverTask, lastSyncedAt);

    if (task.deletedAt) {
      if (serverTask.deletedAt) {
        return {
          state: 'deleted',
          tombstone: taskRepositoryDtoToApiDto(serverTask),
        };
      }

      if (hasConflict) {
        conflicts.push(createTaskConflict({
          client: task,
          server: serverTask,
          reason: 'deleted_on_client_updated_on_server',
          detectedAt,
        }));
        return { state: 'unchanged' };
      }

      const deleted = await this.tasksRepository.softDeleteTaskIfRevisionMatches(
        workspaceId,
        task.id,
        serverTask.serverRevision,
        task.deletedAt,
      );

      if (!deleted) {
        await this.addTaskWriteGuardConflict(workspaceId, task, serverTask, detectedAt, conflicts);
        return { state: 'unchanged' };
      }

      return {
        state: 'deleted',
        tombstone: taskRepositoryDtoToApiDto(deleted),
      };
    }

    if (hasConflict) {
      conflicts.push(createTaskConflict({
        client: task,
        server: serverTask,
        reason: 'updated_on_client_and_server',
        detectedAt,
      }));
      return { state: 'unchanged' };
    }

    if (!hasTaskContentChanged(task, serverTask)) {
      return { state: 'active' };
    }

    const updated = await this.tasksRepository.updateTaskIfRevisionMatches(
      taskToUpdateInput(task, workspaceId, serverTask.serverRevision),
    );

    if (!updated) {
      await this.addTaskWriteGuardConflict(workspaceId, task, serverTask, detectedAt, conflicts);
      return { state: 'unchanged' };
    }

    return { state: 'active' };
  }

  private async applyAgreementSync(
    workspaceId: string,
    agreement: AgreementDto,
    lastSyncedAt: string | undefined,
    detectedAt: string,
    conflicts: TaskOrAgreementConflict[],
  ): Promise<AgreementDto | null> {
    const serverAgreement = await this.tasksRepository.findAgreementByIdForWorkspace(
      workspaceId,
      agreement.id,
      true,
    );

    if (!serverAgreement) {
      if (!agreement.deletedAt) {
        await this.tasksRepository.insertAgreement(agreementToUpsertInput(agreement, workspaceId));
      }

      return null;
    }

    if (serverAgreement.deletedAt && !agreement.deletedAt) {
      conflicts.push(createAgreementConflict({
        client: agreement,
        server: serverAgreement,
        reason: 'deleted_on_server_updated_on_client',
        detectedAt,
      }));

      return null;
    }

    const hasConflict = hasServerConflict(agreement, serverAgreement, lastSyncedAt);

    if (agreement.deletedAt) {
      if (serverAgreement.deletedAt) {
        return agreementRepositoryDtoToApiDto(serverAgreement);
      }

      if (hasConflict) {
        conflicts.push(createAgreementConflict({
          client: agreement,
          server: serverAgreement,
          reason: 'deleted_on_client_updated_on_server',
          detectedAt,
        }));

        return null;
      }

      const deleted = await this.tasksRepository.softDeleteAgreementIfRevisionMatches(
        workspaceId,
        agreement.id,
        serverAgreement.serverRevision,
        agreement.deletedAt,
      );

      if (!deleted) {
        await this.addAgreementWriteGuardConflict(workspaceId, agreement, serverAgreement, detectedAt, conflicts);

        return null;
      }

      return agreementRepositoryDtoToApiDto(deleted);
    }

    if (hasConflict) {
      conflicts.push(createAgreementConflict({
        client: agreement,
        server: serverAgreement,
        reason: 'updated_on_client_and_server',
        detectedAt,
      }));

      return null;
    }

    if (!hasAgreementContentChanged(agreement, serverAgreement)) {
      return null;
    }

    const updated = await this.tasksRepository.updateAgreementIfRevisionMatches(
      agreementToUpdateInput(agreement, workspaceId, serverAgreement.serverRevision),
    );

    if (!updated) {
      await this.addAgreementWriteGuardConflict(
        workspaceId,
        agreement,
        serverAgreement,
        detectedAt,
        conflicts,
      );
    }

    return null;
  }
  private async addTaskWriteGuardConflict(
    workspaceId: string,
    task: TaskDto,
    fallbackServer: TaskRepositoryDto,
    detectedAt: string,
    conflicts: TaskOrAgreementConflict[],
  ) {
    const latest = await this.tasksRepository.findTaskByIdForWorkspace(
      workspaceId,
      task.id,
      true,
    );

    conflicts.push(createTaskConflict({
      client: task,
      server: latest ?? fallbackServer,
      reason: latest?.deletedAt
        ? 'deleted_on_server_updated_on_client'
        : 'updated_on_client_and_server',
      detectedAt,
    }));
  }

  private async addAgreementWriteGuardConflict(
    workspaceId: string,
    agreement: AgreementDto,
    fallbackServer: AgreementRepositoryDto,
    detectedAt: string,
    conflicts: TaskOrAgreementConflict[],
  ) {
    const latest = await this.tasksRepository.findAgreementByIdForWorkspace(
      workspaceId,
      agreement.id,
      true,
    );

    conflicts.push(createAgreementConflict({
      client: agreement,
      server: latest ?? fallbackServer,
      reason: latest?.deletedAt
        ? 'deleted_on_server_updated_on_client'
        : 'updated_on_client_and_server',
      detectedAt,
    }));
  }

  private async validateReviewDecisions(
    workspaceId: string,
    reviewDecisions: TaskReviewDecisionDto[],
    sourceMeetingCache: Map<string, boolean>,
  ) {
    for (const decision of reviewDecisions) {
      const [meetingExists, sourceMeetingExists] = await Promise.all([
        this.meetingExists(workspaceId, decision.meetingId, sourceMeetingCache),
        this.meetingExists(workspaceId, decision.sourceMeetingId, sourceMeetingCache),
      ]);

      if (!meetingExists || !sourceMeetingExists) {
        throw new ApiError(
          422,
          'task_review_decision_invalid_reference',
          'Review decision references a meeting outside the workspace.',
          {
            meetingId: decision.meetingId,
            sourceMeetingId: decision.sourceMeetingId,
          },
        );
      }
    }
  }

  private async syncReviewDecisions(
    workspaceId: string,
    reviewDecisions: TaskReviewDecisionDto[],
  ) {
    for (const decision of reviewDecisions) {
      await this.tasksRepository.createReviewDecision({
        workspaceId,
        meetingId: decision.meetingId,
        sourceMeetingId: decision.sourceMeetingId,
        decidedAt: decision.decidedAt,
      });
    }
  }
}

export function createTasksService(
  tasksRepository: TaskRepositoryPort,
  participantsRepository: ParticipantRepositoryPort,
  meetingsRepository: MeetingRepositoryPort,
  calendarSync?: CalendarTaskSyncPort,
  workspaceMembersRepository?: WorkspaceMembersPort,
) {
  return new TasksService(
    tasksRepository,
    participantsRepository,
    meetingsRepository,
    calendarSync,
    workspaceMembersRepository,
  );
}

export function createDefaultTasksService(
  supabase: SupabaseRepositoryClient,
  calendarSync?: CalendarTaskSyncPort,
) {
  return new TasksService(
    new TasksRepository(supabase),
    new ParticipantsRepository(supabase),
    new MeetingsRepository(supabase),
    calendarSync,
    new WorkspacesRepository(supabase),
  );
}
