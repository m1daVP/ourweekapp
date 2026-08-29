import { createHash, randomBytes } from 'node:crypto';

import { env } from '../../config/env.js';
import type { AuthContext } from '../../shared/auth/index.js';
import { requireAuthenticatedContext } from '../../shared/auth/index.js';
import { ApiError } from '../../shared/errors/index.js';
import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { sendWorkspaceInvitationEmail } from '../../shared/mailer/mailer.js';
import type {
  CreateWorkspaceInvitationRequestDto,
  CreateWorkspaceInvitationResponseDto,
  LinkParticipantToExistingMemberRequestDto,
  ParticipantAccessAssociationDto,
  UpdateWorkspaceMemberRequestDto,
  UpdateWorkspaceRequestDto,
  WorkspaceDto,
  WorkspaceInvitationDto,
  WorkspaceMemberDto,
} from './workspace.schema.js';
import {
  WorkspacesRepository,
  type WorkspaceInvitationDto as RepositoryWorkspaceInvitationDto,
  type WorkspaceDto as RepositoryWorkspaceDto,
  type WorkspaceMemberDto as RepositoryWorkspaceMemberDto,
} from './workspaces.repository.js';
import { householdMemberLimitForPlan } from '../billing/plan-limits.js';

const invitationTokenByteLength = 32;
const invitationTtlDays = 7;

function toWorkspaceMemberDto(
  member: RepositoryWorkspaceMemberDto,
): WorkspaceMemberDto {
  return {
    userId: member.userId,
    displayName: member.displayName,
    ...(member.email ? { email: member.email } : {}),
    role: member.role,
    status: member.status,
  };
}

function toWorkspaceInvitationDto(
  invitation: RepositoryWorkspaceInvitationDto,
): WorkspaceInvitationDto {
  return {
    invitationId: invitation.id,
    participantId: invitation.participantId,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    deliveryStatus: invitation.deliveryStatus,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
  };
}

function toWorkspaceDto(
  workspace: RepositoryWorkspaceDto,
  members: RepositoryWorkspaceMemberDto[],
  invitations: RepositoryWorkspaceInvitationDto[],
): WorkspaceDto {
  return {
    id: workspace.id,
    name: workspace.name,
    ownerId: workspace.ownerId,
    members: members.map(toWorkspaceMemberDto),
    invitations: invitations.map(toWorkspaceInvitationDto),
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
  };
}

function canViewWorkspaceInvitations(context: AuthContext) {
  return context.role === 'owner' || context.role === 'adult_member';
}

function hashInvitationToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('base64url');
}

function issueInvitationToken() {
  const rawToken = randomBytes(invitationTokenByteLength).toString('base64url');

  return { rawToken, tokenHash: hashInvitationToken(rawToken) };
}

function getInvitationExpiresAt(now = new Date()) {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + invitationTtlDays);

  return expiresAt.toISOString();
}

export function requireManageWorkspace(auth: AuthContext | undefined) {
  const context = requireAuthenticatedContext(auth);

  if (context.role !== 'owner') {
    throw new ApiError(
      403,
      'forbidden',
      'You are not allowed to manage this workspace.',
    );
  }

  return context;
}

export function requireInviteMembers(auth: AuthContext | undefined) {
  const context = requireAuthenticatedContext(auth);

  if (context.role === 'viewer') {
    throw new ApiError(
      403,
      'forbidden',
      'You are not allowed to invite workspace members.',
    );
  }

  return context;
}

function roleForParticipantType(type: 'adult' | 'child' | 'other') {
  return type === 'adult' ? 'adult_member' : 'viewer';
}

function invitationUrl(token: string) {
  if (!env.INVITATION_HANDOFF_CONFIGURED) {
    throw new ApiError(
      503,
      'invitation_delivery_failed',
      'Invitation email delivery is not configured.',
    );
  }

  const url = new URL(env.INVITATION_HANDOFF_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

type SendInvitationEmail = typeof sendWorkspaceInvitationEmail;
type BuildInvitationUrl = (token: string) => string;

export class WorkspaceService {
  constructor(
    private readonly repository: WorkspacesRepository,
    private readonly sendInvitationEmail: SendInvitationEmail = sendWorkspaceInvitationEmail,
    private readonly buildInvitationUrl: BuildInvitationUrl = invitationUrl,
  ) {}

  static fromSupabase(supabase: SupabaseRepositoryClient) {
    return new WorkspaceService(new WorkspacesRepository(supabase));
  }

  async getWorkspace(auth: AuthContext | undefined) {
    const context = requireAuthenticatedContext(auth);

    return this.loadWorkspace(context);
  }

  async updateWorkspace(
    auth: AuthContext | undefined,
    input: UpdateWorkspaceRequestDto,
  ) {
    const context = requireManageWorkspace(auth);

    await this.repository.updateWorkspaceName(context.workspaceId, input.name);

    return this.loadWorkspace(context);
  }

  async createInvitation(
    auth: AuthContext | undefined,
    input: CreateWorkspaceInvitationRequestDto,
    now = new Date(),
  ): Promise<CreateWorkspaceInvitationResponseDto> {
    const context = requireInviteMembers(auth);
    const activeMembers = await this.repository.listActiveMembersForWorkspace(context.workspaceId);
    const memberLimit = householdMemberLimitForPlan(context.planType);
    if (activeMembers.length >= memberLimit) {
      throw new ApiError(409, 'household_member_limit_reached', 'This household has reached its member limit.', {
        limit: memberLimit, currentCount: activeMembers.length,
      });
    }
    const participant = await this.repository.findActiveParticipantForWorkspace(
      context.workspaceId,
      input.participantId,
    );

    if (!participant) {
      throw new ApiError(404, 'participant_not_found', 'Participant not found.');
    }

    const token = issueInvitationToken();

    const invitation = await this.repository.createInvitation({
      workspaceId: context.workspaceId,
      participantId: participant.id,
      email: input.email,
      emailNormalized: input.email,
      role: roleForParticipantType(participant.type),
      tokenHash: token.tokenHash,
      expiresAt: getInvitationExpiresAt(now),
    });

    const delivered = await this.deliverInvitation(
      context.workspaceId,
      invitation,
      participant.name,
      token.rawToken,
      now,
    );

    return toWorkspaceInvitationDto(delivered);
  }

  async resendInvitation(
    auth: AuthContext | undefined,
    invitationId: string,
    now = new Date(),
  ): Promise<CreateWorkspaceInvitationResponseDto> {
    const context = requireInviteMembers(auth);
    const invitation = await this.repository.findPendingInvitation(
      context.workspaceId,
      invitationId,
    );

    if (!invitation) {
      throw new ApiError(404, 'workspace_invitation_not_found', 'Pending workspace invitation not found.');
    }

    const participant = await this.repository.findActiveParticipantForWorkspace(
      context.workspaceId,
      invitation.participantId,
    );

    if (!participant) {
      throw new ApiError(404, 'participant_not_found', 'Participant not found.');
    }

    const token = issueInvitationToken();
    const rotated = await this.repository.rotateInvitationToken(
      context.workspaceId,
      invitation.id,
      token.tokenHash,
      getInvitationExpiresAt(now),
    );
    const delivered = await this.deliverInvitation(
      context.workspaceId,
      rotated,
      participant.name,
      token.rawToken,
      now,
    );

    return toWorkspaceInvitationDto(delivered);
  }

  async linkParticipantToExistingMember(
    auth: AuthContext | undefined,
    participantId: string,
    input: LinkParticipantToExistingMemberRequestDto,
  ): Promise<ParticipantAccessAssociationDto> {
    const context = requireInviteMembers(auth);
    const member = await this.repository.linkExistingMemberToParticipant(
      context.workspaceId,
      participantId,
      input.email,
      input.email,
    );

    return {
      participantId,
      email: member.email ?? input.email,
      accessStatus: 'active',
    };
  }

  async updateMember(
    auth: AuthContext | undefined,
    userId: string,
    input: UpdateWorkspaceMemberRequestDto,
  ) {
    const context = requireManageWorkspace(auth);
    await this.requireActiveMember(context.workspaceId, userId);

    const updatedMember = await this.repository.updateActiveMemberAtomically(
      context.workspaceId,
      userId,
      input,
    );

    return toWorkspaceMemberDto(updatedMember);
  }

  async removeMember(auth: AuthContext | undefined, userId: string) {
    const context = requireManageWorkspace(auth);
    await this.requireActiveMember(context.workspaceId, userId);
    await this.repository.updateActiveMemberAtomically(context.workspaceId, userId, {
      status: 'removed',
    });
  }

  async revokeInvitation(auth: AuthContext | undefined, invitationId: string) {
    const context = requireManageWorkspace(auth);

    await this.repository.revokePendingInvitation(
      context.workspaceId,
      invitationId,
    );
  }

  private async deliverInvitation(
    workspaceId: string,
    invitation: RepositoryWorkspaceInvitationDto,
    participantName: string,
    rawToken: string,
    now: Date,
  ) {
    const attemptedAt = now.toISOString();

    try {
      await this.sendInvitationEmail(invitation.email, {
        participantName,
        invitationUrl: this.buildInvitationUrl(rawToken),
      });

      return await this.repository.updateInvitationDelivery(
        workspaceId,
        invitation.id,
        {
          deliveryStatus: 'sent',
          attemptedAt,
          sentAt: attemptedAt,
        },
      );
    } catch (error) {
      try {
        await this.repository.updateInvitationDelivery(
          workspaceId,
          invitation.id,
          { deliveryStatus: 'failed', attemptedAt },
        );
      } catch (deliveryUpdateError) {
        throw deliveryUpdateError;
      }

      throw new ApiError(
        503,
        'invitation_delivery_failed',
        'The invitation was saved, but the email could not be delivered. Please try again.',
      );
    }
  }

  private async loadWorkspace(context: AuthContext) {
    const { workspaceId } = context;
    const workspace = await this.repository.findWorkspaceById(workspaceId);

    if (!workspace) {
      throw new ApiError(404, 'workspace_not_found', 'Workspace not found.');
    }

    const [members, invitations] = await Promise.all([
      this.repository.listActiveMembersForWorkspace(workspaceId),
      canViewWorkspaceInvitations(context)
        ? this.repository.listPendingInvitationsForWorkspace(workspaceId)
        : Promise.resolve([]),
    ]);

    return toWorkspaceDto(workspace, members, invitations);
  }

  private async requireActiveMember(workspaceId: string, userId: string) {
    const member = await this.repository.findMembershipForWorkspace(
      workspaceId,
      userId,
    );

    if (!member || member.status !== 'active') {
      throw new ApiError(
        404,
        'workspace_member_not_found',
        'Active workspace member not found.',
      );
    }

    return member;
  }
}
