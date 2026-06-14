import { createHash, randomBytes } from 'node:crypto';

import type { AuthContext } from '../../shared/auth/index.js';
import { requireAuthenticatedContext } from '../../shared/auth/index.js';
import { ApiError } from '../../shared/errors/index.js';
import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import type {
  CreateWorkspaceInvitationRequestDto,
  CreateWorkspaceInvitationResponseDto,
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
    email: invitation.email,
    displayName: invitation.displayName ?? undefined,
    role: invitation.role,
    status: invitation.status,
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
  const digest = createHash('sha256').update(token, 'utf8').digest('base64url');

  return `sha256:${digest}`;
}

function issueInvitationTokenHash() {
  return hashInvitationToken(
    randomBytes(invitationTokenByteLength).toString('base64url'),
  );
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

export class WorkspaceService {
  constructor(private readonly repository: WorkspacesRepository) {}

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

    if (input.role === 'owner') {
      throw new ApiError(
        422,
        'workspace_invitation_role_invalid',
        'Workspace invitations cannot grant owner access.',
      );
    }

    const existingMember = await this.repository.findActiveMemberByEmailForWorkspace(
      context.workspaceId,
      input.email,
    );

    if (existingMember) {
      throw new ApiError(
        409,
        'workspace_member_exists',
        'This email address already belongs to an active workspace member.',
      );
    }

    const invitation = await this.repository.createInvitation({
      workspaceId: context.workspaceId,
      email: input.email,
      emailNormalized: input.email,
      displayName: input.displayName ?? null,
      role: input.role,
      tokenHash: issueInvitationTokenHash(),
      expiresAt: getInvitationExpiresAt(now),
    });

    return {
      invitationId: invitation.id,
      email: invitation.email,
      displayName: invitation.displayName ?? undefined,
      role: invitation.role,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
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
