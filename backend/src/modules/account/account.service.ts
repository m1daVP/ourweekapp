import type { AuthContext } from '../../shared/auth/index.js';
import { requireAuthenticatedContext } from '../../shared/auth/index.js';
import { ApiError } from '../../shared/errors/index.js';
import { isPrivateMarkedObject } from '../../shared/privacy/index.js';
import type { JsonValue, SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import type { SubscriptionStatusDto } from '../billing/billing.schema.js';
import {
  enabledFeatureKeys,
  resolveFeatureAccessMap,
} from '../billing/feature-access.js';
import type { CalendarConnectionStatusDto } from '../calendar/calendar.schema.js';
import {
  AccountRepository,
  type AccountAgreementRecord,
  type AccountCalendarConnectionRecord,
  type AccountMeetingRecord,
  type AccountParticipantRecord,
  type AccountSubscriptionRecord,
  type AccountTaskRecord,
  type AccountTaskReviewDecisionRecord,
} from './account.repository.js';
import type { AccountExportResponseDto } from './account.schema.js';

const unsafeExportKeyPatterns = [
  /secret/i,
  /password/i,
  /token/i,
  /hash/i,
  /^privateNotes?$/i,
  /providerCustomerId/i,
  /providerEntitlementId/i,
  /internalLogs?/i,
  /raw/i,
];

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeJsonForExport(value: JsonValue): JsonValue | undefined {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !isPrivateMarkedObject(item))
      .map(sanitizeJsonForExport)
      .filter((item): item is JsonValue => item !== undefined);
  }

  if (isPrivateMarkedObject(value)) {
    return undefined;
  }

  if (!isJsonObject(value)) {
    return value;
  }

  const sanitized: { [key: string]: JsonValue } = {};

  for (const [key, childValue] of Object.entries(value)) {
    if (unsafeExportKeyPatterns.some((pattern) => pattern.test(key))) {
      continue;
    }

    if (key === 'notes' && Array.isArray(childValue)) {
      sanitized[key] = childValue
        .filter((note) => !isPrivateMarkedObject(note))
        .map(sanitizeJsonForExport)
        .filter((note): note is JsonValue => note !== undefined);
      continue;
    }

    const sanitizedChild = sanitizeJsonForExport(childValue);

    if (sanitizedChild !== undefined) {
      sanitized[key] = sanitizedChild;
    }
  }

  return sanitized;
}

function optional<T>(value: T | null) {
  return value === null ? undefined : value;
}

function toExportParticipant(participant: AccountParticipantRecord) {
  return {
    id: participant.id,
    name: participant.name,
    initials: participant.initials,
    avatarColor: participant.avatarColor,
    type: participant.type,
    isActive: participant.isActive,
    createdAt: participant.createdAt,
    updatedAt: participant.updatedAt,
    serverRevision: participant.serverRevision,
    deletedAt: optional(participant.deletedAt),
  };
}

function toExportMeeting(meeting: AccountMeetingRecord) {
  const sanitizedSections = sanitizeJsonForExport(meeting.sections);
  const sanitizedSummary = meeting.aiSummary
    ? sanitizeJsonForExport(meeting.aiSummary)
    : undefined;

  return {
    id: meeting.id,
    templateId: meeting.templateId,
    title: meeting.title,
    status: meeting.status,
    participantIds: meeting.participantIds,
    sections: Array.isArray(sanitizedSections) ? sanitizedSections : [],
    currentSectionIndex: meeting.currentSectionIndex,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
    completedAt: optional(meeting.completedAt),
    aiSummary:
      sanitizedSummary !== undefined && isJsonObject(sanitizedSummary)
        ? sanitizedSummary
        : undefined,
    serverRevision: meeting.serverRevision,
    deletedAt: optional(meeting.deletedAt),
  };
}

function toExportTask(task: AccountTaskRecord) {
  return {
    id: task.id,
    title: task.title,
    description: optional(task.description),
    responsibilityType: task.responsibilityType,
    responsibleParticipantIds: task.responsibleParticipantIds,
    dueDate: optional(task.dueDate),
    status: task.status,
    sourceMeetingId: optional(task.sourceMeetingId),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    serverRevision: task.serverRevision,
    deletedAt: optional(task.deletedAt),
  };
}

function toExportAgreement(agreement: AccountAgreementRecord) {
  return {
    id: agreement.id,
    title: agreement.title,
    description: optional(agreement.description),
    participantIds: agreement.participantIds,
    relatedTaskIds: agreement.relatedTaskIds,
    sourceMeetingId: agreement.sourceMeetingId,
    createdAt: agreement.createdAt,
    updatedAt: agreement.updatedAt,
    serverRevision: agreement.serverRevision,
    deletedAt: optional(agreement.deletedAt),
  };
}

function toExportReviewDecision(decision: AccountTaskReviewDecisionRecord) {
  return {
    meetingId: decision.meetingId,
    sourceMeetingId: decision.sourceMeetingId,
    decidedAt: decision.decidedAt,
  };
}

function toSubscriptionStatus(
  subscription: AccountSubscriptionRecord | null,
  role: AuthContext['role'],
  checkedAt: string,
): SubscriptionStatusDto | null {
  if (!subscription) {
    return null;
  }

  const features = resolveFeatureAccessMap({
    planType: subscription.planType,
    role,
  });

  return {
    planType: subscription.planType,
    provider: subscription.provider,
    enabledFeatures: enabledFeatureKeys(features),
    features,
    expiresAt: subscription.expiresAt,
    checkedAt: subscription.lastCheckedAt || checkedAt,
  };
}

function toCalendarStatus(
  connection: AccountCalendarConnectionRecord,
  checkedAt: string,
): CalendarConnectionStatusDto {
  return {
    provider: 'google',
    state: connection.state,
    connected: connection.state === 'connected',
    connectedAccountEmail: connection.connectedAccountEmail,
    lastCheckedAt: checkedAt,
    message:
      connection.state === 'connected'
        ? 'Google Calendar is connected.'
        : 'Google Calendar is not connected.',
  };
}

export class AccountService {
  constructor(private readonly repository: AccountRepository) {}

  static fromSupabase(supabase: SupabaseRepositoryClient) {
    return new AccountService(new AccountRepository(supabase));
  }

  async exportAccount(auth: AuthContext | undefined, now = new Date()): Promise<AccountExportResponseDto> {
    const context = requireAuthenticatedContext(auth);
    const exportedAt = now.toISOString();
    const user = await this.repository.findActiveUser(context.userId);

    if (!user) {
      throw new ApiError(404, 'account_not_found', 'Account not found.');
    }

    const memberships = await this.repository.listActiveMembershipsForUser(context.userId);
    const workspaces = [];

    for (const membership of memberships) {
      const workspace = await this.repository.findWorkspace(membership.workspaceId);

      if (!workspace) {
        continue;
      }

      const [
        members,
        participants,
        meetings,
        tasks,
        agreements,
        reviewDecisions,
        subscription,
        calendarConnections,
      ] = await Promise.all([
        this.repository.listMembersForWorkspace(workspace.id),
        this.repository.listParticipantsForWorkspace(workspace.id),
        this.repository.listMeetingsForWorkspace(workspace.id),
        this.repository.listTasksForWorkspace(workspace.id),
        this.repository.listAgreementsForWorkspace(workspace.id),
        this.repository.listReviewDecisionsForWorkspace(workspace.id),
        this.repository.findLatestSubscriptionForWorkspace(workspace.id),
        this.repository.listCalendarConnectionsForWorkspaceUser(workspace.id, context.userId),
      ]);

      workspaces.push({
        id: workspace.id,
        name: workspace.name,
        ownerId: workspace.ownerId,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
        members: members.map((member) => ({
          userId: member.userId,
          displayName: member.displayName,
          email: member.email,
          role: member.role,
          status: member.status,
          createdAt: member.createdAt,
          updatedAt: member.updatedAt,
        })),
        participants: participants.map(toExportParticipant),
        meetings: meetings.map(toExportMeeting),
        tasks: tasks.map(toExportTask),
        agreements: agreements.map(toExportAgreement),
        reviewDecisions: reviewDecisions.map(toExportReviewDecision),
        subscription: toSubscriptionStatus(subscription, membership.role, exportedAt),
        calendarConnections: calendarConnections.map((connection) =>
          toCalendarStatus(connection, exportedAt),
        ),
      });
    }

    return {
      exportedAt,
      user,
      workspaces,
    };
  }

  async deleteAccount(auth: AuthContext | undefined, now = new Date()) {
    const context = requireAuthenticatedContext(auth);
    const deletedAt = now.toISOString();

    await this.repository.deleteAccountAtomically(context.userId, deletedAt);
  }
}

export { sanitizeJsonForExport };
