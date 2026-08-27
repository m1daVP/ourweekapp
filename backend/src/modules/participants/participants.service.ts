import { z } from 'zod';

import { ApiError } from '../../shared/errors/index.js';
import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { VALIDATION_LIMITS } from '../../shared/schemas/index.js';
import {
  ParticipantsRepository,
  type CreateParticipantInput,
  type ParticipantDto as RepositoryParticipantDto,
  type UpdateParticipantIfRevisionMatchesInput,
} from './participants.repository.js';
import {
  participantSyncConflictSchema,
  type ListParticipantsResponseDto,
  type ParticipantDto,
  type SyncParticipantsRequestDto,
  type SyncParticipantsResponseDto,
} from './participants.schema.js';

type ParticipantSyncConflictDto = z.infer<typeof participantSyncConflictSchema>;

export type ParticipantSyncRepository = {
  listParticipantsForWorkspace(
    workspaceId: string,
    includeDeleted?: boolean,
  ): Promise<RepositoryParticipantDto[]>;
  findParticipantByIdForWorkspace(
    workspaceId: string,
    participantId: string,
    includeDeleted?: boolean,
  ): Promise<RepositoryParticipantDto | null>;
  createParticipant(input: CreateParticipantInput): Promise<RepositoryParticipantDto>;
  updateParticipantIfRevisionMatches(
    input: UpdateParticipantIfRevisionMatchesInput,
  ): Promise<RepositoryParticipantDto | null>;
  softDeleteParticipantIfRevisionMatches(
    workspaceId: string,
    participantId: string,
    expectedServerRevision: number,
    deletedAt: string,
  ): Promise<RepositoryParticipantDto | null>;
};

type SyncParticipantsInput = {
  workspaceId: string;
  body: SyncParticipantsRequestDto;
};

type ListParticipantsInput = {
  workspaceId: string;
};

function toParticipantDto(participant: RepositoryParticipantDto): ParticipantDto {
  const dto: ParticipantDto = {
    id: participant.id,
    name: participant.name,
    initials: participant.initials,
    avatarColor: participant.avatarColor,
    type: participant.type,
    isActive: participant.isActive,
    createdAt: participant.createdAt,
    updatedAt: participant.updatedAt,
    serverRevision: participant.serverRevision,
  };

  if (participant.deletedAt) {
    dto.deletedAt = participant.deletedAt;
  }

  if (participant.email) {
    dto.email = participant.email;
  }

  return dto;
}

export async function listParticipants(
  repository: Pick<
    ParticipantSyncRepository,
    'listParticipantsForWorkspace'
  >,
  input: ListParticipantsInput,
): Promise<ListParticipantsResponseDto> {
  const participants = await repository.listParticipantsForWorkspace(
    input.workspaceId,
    false,
  );

  return {
    participants: participants.map(toParticipantDto),
  };
}

function hasParticipantContentChanged(
  client: ParticipantDto,
  server: RepositoryParticipantDto,
) {
  return (
    client.name !== server.name ||
    client.initials !== server.initials ||
    client.avatarColor !== server.avatarColor ||
    client.type !== server.type ||
    client.isActive !== server.isActive
  );
}

function isAfter(value: string, base: string) {
  return new Date(value).getTime() > new Date(base).getTime();
}

function createConflict(input: {
  client: ParticipantDto;
  server: RepositoryParticipantDto;
  reason: ParticipantSyncConflictDto['reason'];
  detectedAt: string;
}): ParticipantSyncConflictDto {
  return {
    resourceType: 'participant',
    resourceId: input.client.id,
    reason: input.reason,
    baseServerRevision: input.client.serverRevision,
    serverRevision: input.server.serverRevision,
    detectedAt: input.detectedAt,
    clientVersion: input.client,
    serverVersion: toParticipantDto(input.server),
  };
}

function wasClientChangedAfterLastSync(
  client: ParticipantDto,
  lastSyncedAt: string,
) {
  return isAfter(client.deletedAt ?? client.updatedAt, lastSyncedAt);
}

function hasServerChangedSinceClientBase(
  client: ParticipantDto,
  server: RepositoryParticipantDto,
  lastSyncedAt: string | undefined,
) {
  if (client.serverRevision !== undefined) {
    return client.serverRevision < server.serverRevision;
  }

  return (
    lastSyncedAt !== undefined &&
    wasClientChangedAfterLastSync(client, lastSyncedAt) &&
    isAfter(server.updatedAt, lastSyncedAt)
  );
}

function shouldCreateConcurrentUpdateConflict(
  client: ParticipantDto,
  server: RepositoryParticipantDto,
  lastSyncedAt: string | undefined,
) {
  return (
    hasParticipantContentChanged(client, server) &&
    hasServerChangedSinceClientBase(client, server, lastSyncedAt)
  );
}

function countParticipantsAfterSync(
  serverParticipants: RepositoryParticipantDto[],
  clientParticipants: ParticipantDto[],
) {
  const nonDeletedIds = new Set(
    serverParticipants
      .filter((participant) => participant.deletedAt === null)
      .map((participant) => participant.id),
  );

  for (const participant of clientParticipants) {
    if (!participant.deletedAt) {
      nonDeletedIds.add(participant.id);
    }
  }

  return nonDeletedIds.size;
}

function assertUniqueParticipantIds(participants: ParticipantDto[]) {
  const seenIds = new Set<string>();

  for (const participant of participants) {
    if (seenIds.has(participant.id)) {
      throw new ApiError(
        422,
        'duplicate_participant_id',
        'Participant IDs must be unique.',
        { participantId: participant.id },
      );
    }

    seenIds.add(participant.id);
  }
}

async function addWriteGuardConflict(input: {
  repository: ParticipantSyncRepository;
  workspaceId: string;
  client: ParticipantDto;
  fallbackServer: RepositoryParticipantDto;
  conflicts: ParticipantSyncConflictDto[];
  detectedAt: string;
}) {
  const latestServer =
    (await input.repository.findParticipantByIdForWorkspace(
      input.workspaceId,
      input.client.id,
      true,
    )) ?? input.fallbackServer;

  input.conflicts.push(
    createConflict({
      client: input.client,
      server: latestServer,
      reason: latestServer.deletedAt
        ? 'deleted_on_server_updated_on_client'
        : 'updated_on_client_and_server',
      detectedAt: input.detectedAt,
    }),
  );
}

async function syncClientDelete(input: {
  repository: ParticipantSyncRepository;
  workspaceId: string;
  client: ParticipantDto;
  server: RepositoryParticipantDto | undefined;
  lastSyncedAt: string | undefined;
  conflicts: ParticipantSyncConflictDto[];
  serverById: Map<string, RepositoryParticipantDto>;
  detectedAt: string;
}) {
  const deletedAt = input.client.deletedAt;

  if (!deletedAt || !input.server) {
    return;
  }

  if (input.server.deletedAt) {
    return;
  }

  if (
    hasServerChangedSinceClientBase(
      input.client,
      input.server,
      input.lastSyncedAt,
    )
  ) {
    input.conflicts.push(
      createConflict({
        client: input.client,
        server: input.server,
        reason: 'updated_on_client_and_server',
        detectedAt: input.detectedAt,
      }),
    );
    return;
  }

  const expectedServerRevision = input.server.serverRevision;
  const deleted = await input.repository.softDeleteParticipantIfRevisionMatches(
    input.workspaceId,
    input.client.id,
    expectedServerRevision,
    deletedAt,
  );

  if (!deleted) {
    await addWriteGuardConflict({
      repository: input.repository,
      workspaceId: input.workspaceId,
      client: input.client,
      fallbackServer: input.server,
      conflicts: input.conflicts,
      detectedAt: input.detectedAt,
    });
    return;
  }

  input.serverById.set(deleted.id, deleted);
}

export async function syncParticipants(
  repository: ParticipantSyncRepository,
  input: SyncParticipantsInput,
): Promise<SyncParticipantsResponseDto> {
  assertUniqueParticipantIds(input.body.participants);

  const syncedAt = new Date().toISOString();
  const serverParticipants = await repository.listParticipantsForWorkspace(
    input.workspaceId,
    true,
  );
  const serverById = new Map(
    serverParticipants.map((participant) => [participant.id, participant]),
  );

  const participantsAfterSync = countParticipantsAfterSync(
    serverParticipants,
    input.body.participants,
  );

  if (participantsAfterSync > VALIDATION_LIMITS.participantsPerWorkspaceMax) {
    throw new ApiError(
      422,
      'participant_limit_exceeded',
      'The workspace has reached the participant limit.',
      {
        limit: VALIDATION_LIMITS.participantsPerWorkspaceMax,
      },
    );
  }

  const conflicts: ParticipantSyncConflictDto[] = [];

  for (const clientParticipant of input.body.participants) {
    const serverParticipant = serverById.get(clientParticipant.id);

    if (clientParticipant.deletedAt) {
      await syncClientDelete({
        repository,
        workspaceId: input.workspaceId,
        client: clientParticipant,
        server: serverParticipant,
        lastSyncedAt: input.body.lastSyncedAt,
        conflicts,
        serverById,
        detectedAt: syncedAt,
      });
      continue;
    }

    if (!serverParticipant) {
      const created = await repository.createParticipant({
        id: clientParticipant.id,
        workspaceId: input.workspaceId,
        name: clientParticipant.name,
        initials: clientParticipant.initials,
        avatarColor: clientParticipant.avatarColor,
        type: clientParticipant.type,
        isActive: clientParticipant.isActive,
      });

      serverById.set(created.id, created);
      continue;
    }

    if (serverParticipant.deletedAt) {
      conflicts.push(
        createConflict({
          client: clientParticipant,
          server: serverParticipant,
          reason: 'deleted_on_server_updated_on_client',
          detectedAt: syncedAt,
        }),
      );
      continue;
    }

    if (
      shouldCreateConcurrentUpdateConflict(
        clientParticipant,
        serverParticipant,
        input.body.lastSyncedAt,
      )
    ) {
      conflicts.push(
        createConflict({
          client: clientParticipant,
          server: serverParticipant,
          reason: 'updated_on_client_and_server',
          detectedAt: syncedAt,
        }),
      );
      continue;
    }

    if (!hasParticipantContentChanged(clientParticipant, serverParticipant)) {
      continue;
    }

    const updated = await repository.updateParticipantIfRevisionMatches({
      id: clientParticipant.id,
      workspaceId: input.workspaceId,
      name: clientParticipant.name,
      initials: clientParticipant.initials,
      avatarColor: clientParticipant.avatarColor,
      type: clientParticipant.type,
      isActive: clientParticipant.isActive,
      expectedServerRevision: serverParticipant.serverRevision,
    });

    if (!updated) {
      await addWriteGuardConflict({
        repository,
        workspaceId: input.workspaceId,
        client: clientParticipant,
        fallbackServer: serverParticipant,
        conflicts,
        detectedAt: syncedAt,
      });
      continue;
    }

    serverById.set(updated.id, updated);
  }

  const participants = [...serverById.values()]
    .filter((participant) => participant.deletedAt === null)
    .sort((first, second) => first.createdAt.localeCompare(second.createdAt))
    .map(toParticipantDto);

  return {
    participants,
    conflicts,
    syncedAt,
  };
}

export function syncParticipantsWithSupabase(
  supabase: SupabaseRepositoryClient,
  input: SyncParticipantsInput,
) {
  return syncParticipants(new ParticipantsRepository(supabase), input);
}

export function listParticipantsWithSupabase(
  supabase: SupabaseRepositoryClient,
  input: ListParticipantsInput,
) {
  return listParticipants(new ParticipantsRepository(supabase), input);
}

