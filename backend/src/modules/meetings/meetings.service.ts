import { requireMinimumRole, type AuthContext } from '../../shared/auth/index.js';
import { ApiError } from '../../shared/errors/index.js';
import {
  throwOnSupabaseError,
  type JsonValue,
  type SupabaseRepositoryClient,
} from '../../shared/repositories/index.js';
import type { SyncConflictDto } from '../../shared/sync/index.js';
import {
  MeetingsRepository,
  type MeetingDto as MeetingRepositoryDto,
  type UpsertMeetingInput,
} from './meetings.repository.js';
import { hasTrustedPremiumEntitlement } from '../billing/billing.service.js';
import {
  SubscriptionsRepository,
  type SubscriptionDto,
  type SubscriptionRecord,
} from '../billing/subscriptions.repository.js';
import {
  meetingSchema,
  type MeetingDto,
  type MeetingsResponseDto,
  type SyncMeetingsRequestDto,
  type SyncMeetingsResponseDto,
} from './meetings.schema.js';

const FREE_COMPLETED_MEETING_LIMIT = 3;
const ACTIVE_MEETING_STATUSES = ['draft', 'in_progress', 'paused', 'incomplete'] as const;
const FREE_TEMPLATE_IDS = new Set(['default', 'weekly']);
const PREMIUM_TEMPLATE_IDS = new Set([
  ...FREE_TEMPLATE_IDS,
  'planning',
  'repair',
  'monthly_review',
]);

type MeetingStatus = MeetingDto['status'];
type MeetingConflict = SyncConflictDto<MeetingDto> & { resourceType: 'meeting' };

type MeetingRepositoryPort = Pick<
  MeetingsRepository,
  | 'listMeetingsForWorkspace'
  | 'listCompletedMeetingsForFreePlan'
  | 'listMeetingsByStatusesForWorkspace'
  | 'findMeetingByIdForWorkspace'
  | 'insertMeeting'
  | 'updateMeeting'
  | 'updateMeetingSummary'
  | 'softDeleteMeeting'
>;

type ParticipantReferenceDto = {
  id: string;
};

type ParticipantRepositoryPort = {
  listParticipantsForWorkspace(workspaceId: string): Promise<ParticipantReferenceDto[]>;
};

type SubscriptionEntitlementRepositoryPort = Pick<
  SubscriptionsRepository,
  'findCurrentSubscriptionForWorkspace'
>;

class MeetingParticipantsRepository implements ParticipantRepositoryPort {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async listParticipantsForWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('participants')
      .select('id')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .returns<ParticipantReferenceDto[]>();

    throwOnSupabaseError(error, 'participant_list_failed', 'Unable to validate meeting participants.');

    return data ?? [];
  }
}

function toJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

function toJsonArray(value: unknown[]): JsonValue[] {
  return value.map((item) => toJsonValue(item));
}

function sortMeetingsByUpdatedAtDesc(meetings: MeetingDto[]) {
  return [...meetings].sort((left, right) => {
    const byUpdatedAt = right.updatedAt.localeCompare(left.updatedAt);

    return byUpdatedAt === 0 ? left.id.localeCompare(right.id) : byUpdatedAt;
  });
}

function meetingRepositoryDtoToApiDto(row: MeetingRepositoryDto): MeetingDto {
  return meetingSchema.parse({
    id: row.id,
    templateId: row.templateId,
    title: row.title,
    status: row.status,
    participantIds: row.participantIds,
    sections: row.sections,
    currentSectionIndex: row.currentSectionIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.completedAt ? { completedAt: row.completedAt } : {}),
    ...(row.aiSummary ? { aiSummary: row.aiSummary } : {}),
    serverRevision: row.serverRevision,
    ...(row.deletedAt ? { deletedAt: row.deletedAt } : {}),
  });
}

function uniqueById(rows: MeetingRepositoryDto[]) {
  const byId = new Map<string, MeetingRepositoryDto>();

  for (const row of rows) {
    byId.set(row.id, row);
  }

  return [...byId.values()];
}

function latestDraftSavedAt(meetings: MeetingDto[]) {
  const draft = meetings
    .filter((meeting) => meeting.status === 'draft')
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

  return draft?.updatedAt ?? null;
}

function deriveActiveMeetingId(meetings: MeetingDto[], preferredId?: string | null) {
  const activeIds = new Set(
    meetings
      .filter((meeting) => (ACTIVE_MEETING_STATUSES as readonly MeetingStatus[]).includes(meeting.status))
      .map((meeting) => meeting.id),
  );

  if (preferredId && activeIds.has(preferredId)) {
    return preferredId;
  }

  return sortMeetingsByUpdatedAtDesc(
    meetings.filter((meeting) => activeIds.has(meeting.id)),
  )[0]?.id ?? null;
}

function buildMeetingsResponse(
  meetings: MeetingDto[],
  syncedAt: string,
  preferredActiveMeetingId?: string | null,
  preferredDraftSavedAt?: string | null,
): MeetingsResponseDto {
  const visibleMeetings = sortMeetingsByUpdatedAtDesc(meetings);

  return {
    meetings: visibleMeetings,
    activeMeetingId: deriveActiveMeetingId(visibleMeetings, preferredActiveMeetingId),
    draftSavedAt: preferredDraftSavedAt ?? latestDraftSavedAt(visibleMeetings),
    syncedAt,
  };
}

function supportedTemplateIdsForPlan(planType: AuthContext['planType']) {
  return planType === 'premium' ? PREMIUM_TEMPLATE_IDS : FREE_TEMPLATE_IDS;
}

function validateTemplateId(meeting: MeetingDto, auth: AuthContext) {
  return supportedTemplateIdsForPlan(auth.planType).has(meeting.templateId);
}

function collectParticipantIds(meeting: MeetingDto) {
  const ids = new Set(meeting.participantIds);

  for (const section of meeting.sections) {
    for (const note of section.notes) {
      if (note.participantId) {
        ids.add(note.participantId);
      }
    }

    for (const task of section.tasks) {
      for (const participantId of task.responsibleParticipantIds ?? []) {
        ids.add(participantId);
      }
    }

    for (const agreement of section.agreements) {
      for (const participantId of agreement.participantIds ?? []) {
        ids.add(participantId);
      }
    }
  }

  return ids;
}

function collectSummaryParticipantIds(summary: MeetingDto['aiSummary']) {
  const ids = new Set<string>();

  for (const task of summary?.tasks ?? []) {
    for (const participantId of task.responsibleParticipantIds ?? []) {
      ids.add(participantId);
    }
  }

  return ids;
}

function findMissingParticipantIds(
  participantIds: Set<string>,
  validParticipantIds: Set<string>,
) {
  return [...participantIds]
    .filter((participantId) => !validParticipantIds.has(participantId))
    .sort();
}

function hasInvalidSectionIndex(meeting: MeetingDto) {
  if (meeting.sections.length === 0) {
    return meeting.currentSectionIndex !== 0;
  }

  return meeting.currentSectionIndex >= meeting.sections.length;
}

function meetingToUpsertInput(
  meeting: MeetingDto,
  workspaceId: string,
  serverMeeting?: MeetingRepositoryDto | null,
): UpsertMeetingInput {
  return {
    id: meeting.id,
    workspaceId,
    templateId: meeting.templateId,
    title: meeting.title,
    status: meeting.status,
    participantIds: [...meeting.participantIds],
    sections: toJsonArray(meeting.sections),
    currentSectionIndex: meeting.currentSectionIndex,
    aiSummary: serverMeeting?.aiSummary ?? null,
    serverRevision: serverMeeting ? serverMeeting.serverRevision + 1 : 1,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
    completedAt: meeting.completedAt ?? null,
  };
}

function persistedMeetingSnapshot(input: UpsertMeetingInput) {
  return {
    templateId: input.templateId,
    title: input.title,
    status: input.status,
    participantIds: input.participantIds,
    sections: input.sections,
    currentSectionIndex: input.currentSectionIndex,
    aiSummary: input.aiSummary ?? null,
    completedAt: input.completedAt ?? null,
  };
}

function serverMeetingSnapshot(row: MeetingRepositoryDto) {
  return {
    templateId: row.templateId,
    title: row.title,
    status: row.status,
    participantIds: row.participantIds,
    sections: row.sections,
    currentSectionIndex: row.currentSectionIndex,
    aiSummary: row.aiSummary ?? null,
    completedAt: row.completedAt ?? null,
  };
}

function isSamePersistedMeeting(
  input: UpsertMeetingInput,
  serverMeeting: MeetingRepositoryDto,
) {
  return JSON.stringify(persistedMeetingSnapshot(input)) ===
    JSON.stringify(serverMeetingSnapshot(serverMeeting));
}

function hasServerConflict(
  clientMeeting: MeetingDto,
  serverMeeting: MeetingRepositoryDto,
  lastSyncedAt?: string,
) {
  if (clientMeeting.serverRevision !== undefined) {
    return clientMeeting.serverRevision !== serverMeeting.serverRevision;
  }

  if (!lastSyncedAt) {
    return true;
  }

  return serverMeeting.updatedAt > lastSyncedAt;
}

function createConflict(
  resourceId: string,
  reason: MeetingConflict['reason'],
  detectedAt: string,
  clientVersion?: MeetingDto,
  serverVersion?: MeetingDto,
): MeetingConflict {
  return {
    resourceType: 'meeting',
    resourceId,
    reason,
    ...(clientVersion?.serverRevision
      ? { baseServerRevision: clientVersion.serverRevision }
      : {}),
    ...(serverVersion?.serverRevision
      ? { serverRevision: serverVersion.serverRevision }
      : {}),
    detectedAt,
    ...(clientVersion ? { clientVersion } : {}),
    ...(serverVersion ? { serverVersion } : {}),
  };
}

function invalidMeetingReferenceConflict(meeting: MeetingDto, detectedAt: string) {
  return createConflict(
    meeting.id,
    'invalid_reference',
    detectedAt,
    meeting,
  );
}

function isDeletedMeeting(meeting: MeetingDto) {
  return Boolean(meeting.deletedAt);
}

export class MeetingsService {
  constructor(
    private readonly meetingsRepository: MeetingRepositoryPort,
    private readonly participantsRepository: ParticipantRepositoryPort,
    private readonly subscriptionsRepository: SubscriptionEntitlementRepositoryPort,
  ) {}

  async listMeetings(auth: AuthContext, now = new Date()) {
    const meetings = await this.listVisibleMeetingRows(auth, now);

    return buildMeetingsResponse(
      meetings.map(meetingRepositoryDtoToApiDto),
      now.toISOString(),
    );
  }

  async syncMeetings(
    auth: AuthContext,
    request: SyncMeetingsRequestDto,
    now = new Date(),
  ): Promise<SyncMeetingsResponseDto> {
    requireMinimumRole(auth, 'adult_member');

    const syncedAt = now.toISOString();
    const participants = await this.participantsRepository.listParticipantsForWorkspace(
      auth.workspaceId,
    );
    const validParticipantIds = new Set(participants.map((participant) => participant.id));
    const conflicts: MeetingConflict[] = [];

    for (const meeting of request.meetings) {
      if (!validateTemplateId(meeting, auth) || hasInvalidSectionIndex(meeting)) {
        conflicts.push(invalidMeetingReferenceConflict(meeting, syncedAt));
        continue;
      }

      const missingParticipantIds = findMissingParticipantIds(
        collectParticipantIds(meeting),
        validParticipantIds,
      );

      if (missingParticipantIds.length > 0) {
        conflicts.push(invalidMeetingReferenceConflict(meeting, syncedAt));
        continue;
      }

      await this.applyMeetingSync(auth, meeting, request.lastSyncedAt, syncedAt, conflicts);
    }

    const response = await this.listMeetings(auth, now);

    return {
      ...buildMeetingsResponse(
        response.meetings,
        syncedAt,
        request.activeMeetingId,
        request.draftSavedAt,
      ),
      conflicts,
    };
  }

  async saveMeetingSummary(
    auth: AuthContext,
    meetingId: string,
    summary: NonNullable<MeetingDto['aiSummary']>,
    now = new Date(),
  ) {
    requireMinimumRole(auth, 'adult_member');
    await this.requirePremiumWorkspaceEntitlement(auth, now);

    if (summary.meetingId !== meetingId) {
      throw new ApiError(422, 'meeting_summary_mismatch', 'Summary does not match meeting.');
    }

    const existing = await this.meetingsRepository.findMeetingByIdForWorkspace(
      auth.workspaceId,
      meetingId,
    );

    if (!existing) {
      throw new ApiError(404, 'meeting_not_found', 'Meeting not found.');
    }

    const validParticipantIds = new Set(existing.participantIds);
    const missingParticipantIds = findMissingParticipantIds(
      collectSummaryParticipantIds(summary),
      validParticipantIds,
    );

    if (missingParticipantIds.length > 0) {
      throw new ApiError(422, 'meeting_invalid_reference', 'Summary references participants outside the meeting.', {
        participantIds: missingParticipantIds,
      });
    }

    const updated = await this.meetingsRepository.updateMeetingSummary(
      auth.workspaceId,
      meetingId,
      toJsonValue(summary),
    );

    if (!updated) {
      throw new ApiError(409, 'meeting_update_conflict', 'Meeting changed while saving summary.');
    }

    return meetingRepositoryDtoToApiDto(updated);
  }

  private async listVisibleMeetingRows(auth: AuthContext, now: Date) {
    if (await this.hasPremiumWorkspaceEntitlement(auth, now)) {
      return this.meetingsRepository.listMeetingsForWorkspace(auth.workspaceId, 1000);
    }

    const [activeMeetings, completedMeetings] = await Promise.all([
      this.meetingsRepository.listMeetingsByStatusesForWorkspace(
        auth.workspaceId,
        [...ACTIVE_MEETING_STATUSES],
      ),
      this.meetingsRepository.listCompletedMeetingsForFreePlan(
        auth.workspaceId,
        FREE_COMPLETED_MEETING_LIMIT,
      ),
    ]);

    return uniqueById([...activeMeetings, ...completedMeetings]);
  }

  private async hasPremiumWorkspaceEntitlement(auth: AuthContext, now: Date) {
    const subscription =
      (await this.subscriptionsRepository.findCurrentSubscriptionForWorkspace(
        auth.workspaceId,
      )) as SubscriptionDto | SubscriptionRecord | null;

    return hasTrustedPremiumEntitlement(subscription, now);
  }

  private async requirePremiumWorkspaceEntitlement(auth: AuthContext, now: Date) {
    if (!(await this.hasPremiumWorkspaceEntitlement(auth, now))) {
      throw new ApiError(
        403,
        'premium_required',
        'Premium is required for this feature.',
      );
    }
  }

  private async applyMeetingSync(
    auth: AuthContext,
    meeting: MeetingDto,
    lastSyncedAt: string | undefined,
    detectedAt: string,
    conflicts: MeetingConflict[],
  ) {
    const serverMeeting = await this.meetingsRepository.findMeetingByIdForWorkspace(
      auth.workspaceId,
      meeting.id,
      true,
    );

    if (!serverMeeting) {
      if (!isDeletedMeeting(meeting)) {
        await this.meetingsRepository.insertMeeting(
          meetingToUpsertInput(meeting, auth.workspaceId),
        );
      }

      return;
    }

    const serverVersion = meetingRepositoryDtoToApiDto(serverMeeting);

    if (serverMeeting.deletedAt && !isDeletedMeeting(meeting)) {
      conflicts.push(createConflict(
        meeting.id,
        'deleted_on_server_updated_on_client',
        detectedAt,
        meeting,
        serverVersion,
      ));
      return;
    }

    const hasConflict = hasServerConflict(meeting, serverMeeting, lastSyncedAt);

    if (isDeletedMeeting(meeting)) {
      if (serverMeeting.deletedAt) {
        return;
      }

      if (hasConflict) {
        conflicts.push(createConflict(
          meeting.id,
          'deleted_on_client_updated_on_server',
          detectedAt,
          meeting,
          serverVersion,
        ));
        return;
      }

      const deleted = await this.meetingsRepository.softDeleteMeeting(
        auth.workspaceId,
        meeting.id,
        meeting.deletedAt ?? detectedAt,
        serverMeeting.serverRevision,
      );

      if (!deleted) {
        const latest = await this.meetingsRepository.findMeetingByIdForWorkspace(
          auth.workspaceId,
          meeting.id,
          true,
        );
        conflicts.push(createConflict(
          meeting.id,
          'deleted_on_client_updated_on_server',
          detectedAt,
          meeting,
          latest ? meetingRepositoryDtoToApiDto(latest) : serverVersion,
        ));
      }

      return;
    }

    if (hasConflict) {
      conflicts.push(createConflict(
        meeting.id,
        'updated_on_client_and_server',
        detectedAt,
        meeting,
        serverVersion,
      ));
      return;
    }

    const input = meetingToUpsertInput(meeting, auth.workspaceId, serverMeeting);

    if (isSamePersistedMeeting(input, serverMeeting)) {
      return;
    }

    const updated = await this.meetingsRepository.updateMeeting(
      auth.workspaceId,
      meeting.id,
      serverMeeting.serverRevision,
      input,
    );

    if (!updated) {
      const latest = await this.meetingsRepository.findMeetingByIdForWorkspace(
        auth.workspaceId,
        meeting.id,
        true,
      );
      conflicts.push(createConflict(
        meeting.id,
        'updated_on_client_and_server',
        detectedAt,
        meeting,
        latest ? meetingRepositoryDtoToApiDto(latest) : serverVersion,
      ));
    }
  }
}

export function createMeetingsService(
  meetingsRepository: MeetingRepositoryPort,
  participantsRepository: ParticipantRepositoryPort,
  subscriptionsRepository: SubscriptionEntitlementRepositoryPort,
) {
  return new MeetingsService(
    meetingsRepository,
    participantsRepository,
    subscriptionsRepository,
  );
}

export function createDefaultMeetingsService(supabase: ConstructorParameters<typeof MeetingsRepository>[0]) {
  return new MeetingsService(
    new MeetingsRepository(supabase),
    new MeetingParticipantsRepository(supabase),
    new SubscriptionsRepository(supabase),
  );
}






