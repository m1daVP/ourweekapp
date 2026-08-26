import { describe, expect, it } from 'vitest';

import {
  listParticipants,
  syncParticipants,
  type ParticipantSyncRepository,
} from '../src/modules/participants/participants.service.js';
import type {
  CreateParticipantInput,
  ParticipantDto as RepositoryParticipantDto,
  UpdateParticipantIfRevisionMatchesInput,
} from '../src/modules/participants/participants.repository.js';
import type {
  ParticipantDto,
  SyncParticipantsRequestDto,
} from '../src/modules/participants/participants.schema.js';
import { VALIDATION_LIMITS } from '../src/shared/schemas/index.js';

const now = '2026-06-06T10:00:00.000Z';
const later = '2026-06-06T10:05:00.000Z';
const participantOneId = '11111111-1111-4111-8111-111111111111';
const participantTwoId = '22222222-2222-4222-8222-222222222222';
const participantThreeId = '33333333-3333-4333-8333-333333333333';

function participantId(index: number) {
  return `${index.toString(16).padStart(8, '0')}-0000-4000-8000-${index
    .toString(16)
    .padStart(12, '0')}`;
}

function repositoryParticipant(
  overrides: Partial<RepositoryParticipantDto> = {},
): RepositoryParticipantDto {
  return {
    id: participantOneId,
    workspaceId: 'workspace-1',
    name: 'Rita',
    initials: 'R',
    avatarColor: '#7A8C6B',
    type: 'adult',
    isActive: true,
    serverRevision: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function clientParticipant(
  overrides: Partial<ParticipantDto> = {},
): ParticipantDto {
  return {
    id: participantOneId,
    name: 'Rita',
    initials: 'R',
    avatarColor: '#7A8C6B',
    type: 'adult',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    serverRevision: 1,
    ...overrides,
  };
}

function syncRequest(
  participants: ParticipantDto[],
  overrides: Partial<SyncParticipantsRequestDto> = {},
): SyncParticipantsRequestDto {
  return {
    participants,
    clientUpdatedAt: later,
    ...overrides,
  };
}

class FakeParticipantRepository implements ParticipantSyncRepository {
  public readonly listCalls: Array<{
    workspaceId: string;
    includeDeleted: boolean;
  }> = [];
  public readonly creates: CreateParticipantInput[] = [];
  public readonly updates: UpdateParticipantIfRevisionMatchesInput[] = [];
  public readonly deletes: Array<{
    workspaceId: string;
    participantId: string;
    expectedServerRevision: number;
    deletedAt: string;
  }> = [];
  public failNextUpdate = false;
  public failNextDelete = false;
  public latestOnFind: RepositoryParticipantDto | null = null;

  constructor(private readonly participants: RepositoryParticipantDto[]) {}

  async listParticipantsForWorkspace(
    workspaceId: string,
    includeDeleted = false,
  ) {
    this.listCalls.push({ workspaceId, includeDeleted });
    return includeDeleted
      ? this.participants
      : this.participants.filter((participant) => !participant.deletedAt);
  }

  async findParticipantByIdForWorkspace(
    _workspaceId: string,
    participantId: string,
    _includeDeleted = false,
  ) {
    return (
      this.latestOnFind ??
      this.participants.find((participant) => participant.id === participantId) ??
      null
    );
  }

  async createParticipant(input: CreateParticipantInput) {
    this.creates.push(input);

    const participant = repositoryParticipant({
      id: input.id,
      workspaceId: input.workspaceId,
      name: input.name,
      initials: input.initials,
      avatarColor: input.avatarColor,
      type: input.type,
      isActive: input.isActive,
      serverRevision: 1,
      createdAt: now,
      updatedAt: later,
      deletedAt: null,
    });

    this.participants.push(participant);

    return participant;
  }

  async updateParticipantIfRevisionMatches(
    input: UpdateParticipantIfRevisionMatchesInput,
  ) {
    this.updates.push(input);

    if (this.failNextUpdate) {
      this.failNextUpdate = false;
      return null;
    }

    const existingIndex = this.participants.findIndex(
      (participant) =>
        participant.workspaceId === input.workspaceId &&
        participant.id === input.id &&
        participant.serverRevision === input.expectedServerRevision &&
        participant.deletedAt === null,
    );

    if (existingIndex < 0) {
      return null;
    }

    const existing = this.participants[existingIndex];
    const participant = repositoryParticipant({
      id: input.id,
      workspaceId: input.workspaceId,
      name: input.name,
      initials: input.initials,
      avatarColor: input.avatarColor,
      type: input.type,
      isActive: input.isActive,
      serverRevision: input.expectedServerRevision + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: later,
      deletedAt: null,
    });

    this.participants[existingIndex] = participant;

    return participant;
  }

  async softDeleteParticipantIfRevisionMatches(
    workspaceId: string,
    participantIdValue: string,
    expectedServerRevision: number,
    deletedAt: string,
  ) {
    this.deletes.push({
      workspaceId,
      participantId: participantIdValue,
      expectedServerRevision,
      deletedAt,
    });

    if (this.failNextDelete) {
      this.failNextDelete = false;
      return null;
    }

    const existingIndex = this.participants.findIndex(
      (participant) =>
        participant.workspaceId === workspaceId &&
        participant.id === participantIdValue &&
        participant.serverRevision === expectedServerRevision &&
        participant.deletedAt === null,
    );

    if (existingIndex < 0) {
      return null;
    }

    const existing = this.participants[existingIndex];
    const participant = repositoryParticipant({
      ...existing,
      isActive: false,
      serverRevision: expectedServerRevision + 1,
      updatedAt: later,
      deletedAt,
    });

    this.participants[existingIndex] = participant;

    return participant;
  }
}

describe('participant sync service', () => {
  it('lists active participants for the requested workspace as public DTOs', async () => {
    const repository = new FakeParticipantRepository([
      repositoryParticipant({ id: participantOneId, name: 'Rita' }),
      repositoryParticipant({
        id: participantTwoId,
        name: 'Deleted',
        deletedAt: later,
      }),
    ]);

    const response = await listParticipants(repository, {
      workspaceId: 'workspace-1',
    });

    expect(repository.listCalls).toEqual([
      { workspaceId: 'workspace-1', includeDeleted: false },
    ]);
    expect(response.participants).toEqual([
      expect.objectContaining({ id: participantOneId, name: 'Rita' }),
    ]);
    expect(response.participants[0]).not.toHaveProperty('workspaceId');
  });

  it('keeps server participants when the client sends an empty list', async () => {
    const repository = new FakeParticipantRepository([
      repositoryParticipant({ id: participantOneId }),
    ]);

    const response = await syncParticipants(repository, {
      workspaceId: 'workspace-1',
      body: syncRequest([]),
    });

    expect(response.participants).toHaveLength(1);
    expect(response.participants[0]?.id).toBe(participantOneId);
    expect(response.conflicts).toEqual([]);
    expect(repository.creates).toEqual([]);
    expect(repository.updates).toEqual([]);
    expect(repository.deletes).toEqual([]);
  });

  it('returns a structured conflict for stale participant revisions', async () => {
    const repository = new FakeParticipantRepository([
      repositoryParticipant({
        name: 'Server Rita',
        serverRevision: 2,
        updatedAt: later,
      }),
    ]);

    const response = await syncParticipants(repository, {
      workspaceId: 'workspace-1',
      body: syncRequest([
        clientParticipant({
          name: 'Client Rita',
          serverRevision: 1,
          updatedAt: later,
        }),
      ]),
    });

    expect(response.conflicts).toEqual([
      expect.objectContaining({
        resourceType: 'participant',
        resourceId: participantOneId,
        reason: 'updated_on_client_and_server',
        baseServerRevision: 1,
        serverRevision: 2,
      }),
    ]);
    expect(response.conflicts[0]?.clientVersion?.name).toBe('Client Rita');
    expect(response.conflicts[0]?.serverVersion?.name).toBe('Server Rita');
    expect(repository.updates).toEqual([]);
  });

  it('updates matching revisions in the active workspace and increments revision', async () => {
    const repository = new FakeParticipantRepository([
      repositoryParticipant({ serverRevision: 2 }),
    ]);

    const response = await syncParticipants(repository, {
      workspaceId: 'workspace-1',
      body: syncRequest([
        clientParticipant({
          name: 'Rita Updated',
          serverRevision: 2,
          updatedAt: later,
        }),
      ]),
    });

    expect(repository.updates).toEqual([
      expect.objectContaining({
        id: participantOneId,
        workspaceId: 'workspace-1',
        name: 'Rita Updated',
        expectedServerRevision: 2,
      }),
    ]);
    expect(response.participants[0]?.name).toBe('Rita Updated');
    expect(response.participants[0]?.serverRevision).toBe(3);
  });

  it('returns a conflict when the guarded update no longer matches', async () => {
    const repository = new FakeParticipantRepository([
      repositoryParticipant({ serverRevision: 2 }),
    ]);
    repository.failNextUpdate = true;
    repository.latestOnFind = repositoryParticipant({
      name: 'Raced Server Rita',
      serverRevision: 3,
      updatedAt: later,
    });

    const response = await syncParticipants(repository, {
      workspaceId: 'workspace-1',
      body: syncRequest([
        clientParticipant({
          name: 'Rita Updated',
          serverRevision: 2,
          updatedAt: later,
        }),
      ]),
    });

    expect(repository.updates).toHaveLength(1);
    expect(response.conflicts).toEqual([
      expect.objectContaining({
        resourceId: participantOneId,
        reason: 'updated_on_client_and_server',
        baseServerRevision: 2,
        serverRevision: 3,
      }),
    ]);
    expect(response.conflicts[0]?.serverVersion?.name).toBe('Raced Server Rita');
  });

  it('soft-deletes an existing participant from a matching client tombstone', async () => {
    const repository = new FakeParticipantRepository([
      repositoryParticipant({ serverRevision: 2 }),
    ]);

    const response = await syncParticipants(repository, {
      workspaceId: 'workspace-1',
      body: syncRequest([
        clientParticipant({
          serverRevision: 2,
          deletedAt: later,
        }),
      ]),
    });

    expect(repository.deletes).toEqual([
      {
        workspaceId: 'workspace-1',
        participantId: participantOneId,
        expectedServerRevision: 2,
        deletedAt: later,
      },
    ]);
    expect(response.participants).toEqual([]);
    expect(response.conflicts).toEqual([]);
  });

  it('does not create participants from unknown client tombstones', async () => {
    const repository = new FakeParticipantRepository([]);

    const response = await syncParticipants(repository, {
      workspaceId: 'workspace-1',
      body: syncRequest([
        clientParticipant({
          id: participantTwoId,
          deletedAt: later,
        }),
      ]),
    });

    expect(response.participants).toEqual([]);
    expect(response.conflicts).toEqual([]);
    expect(repository.creates).toEqual([]);
    expect(repository.deletes).toEqual([]);
  });

  it('returns a structured conflict for stale client tombstone deletes', async () => {
    const repository = new FakeParticipantRepository([
      repositoryParticipant({
        name: 'Server Rita',
        serverRevision: 2,
        updatedAt: later,
      }),
    ]);

    const response = await syncParticipants(repository, {
      workspaceId: 'workspace-1',
      body: syncRequest([
        clientParticipant({
          serverRevision: 1,
          deletedAt: later,
        }),
      ]),
    });

    expect(repository.deletes).toEqual([]);
    expect(response.conflicts).toEqual([
      expect.objectContaining({
        resourceType: 'participant',
        resourceId: participantOneId,
        reason: 'updated_on_client_and_server',
        baseServerRevision: 1,
        serverRevision: 2,
      }),
    ]);
  });

  it('creates new active participants with explicit create behavior', async () => {
    const repository = new FakeParticipantRepository([]);

    const response = await syncParticipants(repository, {
      workspaceId: 'workspace-1',
      body: syncRequest([
        clientParticipant({ id: participantThreeId, name: 'New Participant' }),
      ]),
    });

    expect(repository.creates).toEqual([
      expect.objectContaining({
        id: participantThreeId,
        workspaceId: 'workspace-1',
        name: 'New Participant',
      }),
    ]);
    expect(response.participants[0]?.id).toBe(participantThreeId);
    expect(response.participants[0]?.serverRevision).toBe(1);
  });

  it('rejects syncs that would exceed the workspace participant limit', async () => {
    const existingParticipants = Array.from(
      { length: VALIDATION_LIMITS.participantsPerWorkspaceMax },
      (_, index) =>
        repositoryParticipant({
          id: participantId(index + 1),
          name: `Participant ${index}`,
        }),
    );
    const repository = new FakeParticipantRepository(existingParticipants);

    await expect(
      syncParticipants(repository, {
        workspaceId: 'workspace-1',
        body: syncRequest([
          clientParticipant({
            id: participantThreeId,
            name: 'New Participant',
          }),
        ]),
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'participant_limit_exceeded',
    });
    expect(repository.creates).toEqual([]);
  });
});
