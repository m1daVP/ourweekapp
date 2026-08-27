import { describe, expect, it, vi } from 'vitest';

import type { AuthContext } from '../src/shared/auth/index.js';
import { ApiError } from '../src/shared/errors/index.js';
import {
  requireInviteMembers,
  requireManageWorkspace,
  WorkspaceService,
} from '../src/modules/workspace/workspace.service.js';
import type {
  WorkspaceDto as RepositoryWorkspaceDto,
  WorkspaceInvitationDto as RepositoryWorkspaceInvitationDto,
  WorkspaceMemberDto as RepositoryWorkspaceMemberDto,
  WorkspacesRepository,
} from '../src/modules/workspace/workspaces.repository.js';

const ownerAuth: AuthContext = {
  userId: 'owner-1',
  sessionId: 'session-1',
  workspaceId: 'workspace-1',
  role: 'owner',
  planType: 'free',
};

const adultAuth: AuthContext = {
  ...ownerAuth,
  userId: 'adult-1',
  role: 'adult_member',
};

const viewerAuth: AuthContext = {
  ...ownerAuth,
  userId: 'viewer-1',
  role: 'viewer',
};

function member(
  overrides: Partial<RepositoryWorkspaceMemberDto> = {},
): RepositoryWorkspaceMemberDto {
  return {
    workspaceId: 'workspace-1',
    userId: 'owner-1',
    displayName: 'Rita',
    email: 'rita@example.com',
    role: 'owner',
    status: 'active',
    createdAt: '2026-06-06T10:00:00.000Z',
    updatedAt: '2026-06-06T10:00:00.000Z',
    ...overrides,
  };
}

function workspace(
  overrides: Partial<RepositoryWorkspaceDto> = {},
): RepositoryWorkspaceDto {
  return {
    id: 'workspace-1',
    name: 'Our home',
    ownerId: 'owner-1',
    createdAt: '2026-06-06T10:00:00.000Z',
    updatedAt: '2026-06-06T10:00:00.000Z',
    ...overrides,
  };
}

function invitation(
  overrides: Partial<RepositoryWorkspaceInvitationDto> = {},
): RepositoryWorkspaceInvitationDto {
  return {
    id: 'invitation-1',
    workspaceId: 'workspace-1',
    participantId: 'participant-1',
    email: 'alex@example.com',
    emailNormalized: 'alex@example.com',
    displayName: 'Alex',
    role: 'adult_member',
    status: 'pending',
    deliveryStatus: 'sent',
    createdAt: '2026-06-06T10:00:00.000Z',
    expiresAt: '2026-06-13T10:00:00.000Z',
    ...overrides,
  };
}

function createRepository(input: {
  targetMember?: RepositoryWorkspaceMemberDto | null;
  workspace?: RepositoryWorkspaceDto | null;
  invitations?: RepositoryWorkspaceInvitationDto[];
  participantType?: 'adult' | 'child' | 'other';
  sendInvitationEmail?: (to: string, input: { participantName: string; invitationUrl: string }) => Promise<void>;
} = {}) {
  const targetMember = input.targetMember ?? member();
  const repository = {
    findWorkspaceById: vi.fn(async () => input.workspace ?? workspace()),
    listActiveMembersForWorkspace: vi.fn(async () => [member()]),
    listPendingInvitationsForWorkspace: vi.fn(async () => input.invitations ?? []),
    updateWorkspaceName: vi.fn(async () => workspace()),
    findMembershipForWorkspace: vi.fn(async () => targetMember),
    updateActiveMemberAtomically: vi.fn(async (_workspaceId, _userId, update) => ({
      ...targetMember,
      ...update,
    })),
    revokePendingInvitation: vi.fn(async () => invitation({ status: 'revoked' })),
    findActiveMemberByEmailForWorkspace: vi.fn(async () => null),
    findActiveParticipantForWorkspace: vi.fn(async () => ({
      id: 'participant-1',
      workspaceId: 'workspace-1',
      name: 'Alex',
      type: input.participantType ?? 'adult',
    })),
    createInvitation: vi.fn(async () => ({
      ...invitation(),
    })),
    updateInvitationDelivery: vi.fn(async (_workspaceId, _invitationId, update) => ({
      ...invitation(),
      deliveryStatus: update.deliveryStatus,
    })),
    findPendingInvitation: vi.fn(async () => invitation()),
    rotateInvitationToken: vi.fn(async () => invitation({ deliveryStatus: 'pending' })),
    linkExistingMemberToParticipant: vi.fn(async () => member({
      userId: 'alex-user-1',
      email: 'alex@example.com',
      role: 'adult_member',
    })),
  };

  return {
    repository,
    service: new WorkspaceService(
      repository as unknown as WorkspacesRepository,
      input.sendInvitationEmail ?? vi.fn(async () => undefined),
      (token) => `https://ourweekapp.com/invite?token=${token}`,
    ),
  };
}

describe('workspace permissions', () => {
  it('allows only owners to manage the workspace', () => {
    expect(requireManageWorkspace(ownerAuth)).toEqual(ownerAuth);
    expect(() => requireManageWorkspace(adultAuth)).toThrow(ApiError);
  });

  it('allows owners and adult members to invite members', () => {
    expect(requireInviteMembers(ownerAuth)).toEqual(ownerAuth);
    expect(requireInviteMembers(adultAuth)).toEqual(adultAuth);
    expect(() => requireInviteMembers(viewerAuth)).toThrow(ApiError);
  });
});

describe('WorkspaceService member management', () => {
  it('returns pending invitations to workspace owners', async () => {
    const { repository, service } = createRepository({
      invitations: [invitation()],
    });

    const result = await service.getWorkspace(ownerAuth);

    expect(repository.listPendingInvitationsForWorkspace).toHaveBeenCalledWith(
      'workspace-1',
    );
    expect(result.invitations).toEqual([
      {
        invitationId: 'invitation-1',
        participantId: 'participant-1',
        email: 'alex@example.com',
        role: 'adult_member',
        status: 'pending',
        deliveryStatus: 'sent',
        createdAt: '2026-06-06T10:00:00.000Z',
        expiresAt: '2026-06-13T10:00:00.000Z',
      },
    ]);
  });

  it('returns pending invitations to adult members', async () => {
    const { repository, service } = createRepository({
      invitations: [invitation()],
    });

    const result = await service.getWorkspace(adultAuth);

    expect(repository.listPendingInvitationsForWorkspace).toHaveBeenCalledWith(
      'workspace-1',
    );
    expect(result.invitations).toHaveLength(1);
  });

  it('hides pending invitations from viewers', async () => {
    const { repository, service } = createRepository({
      invitations: [invitation()],
    });

    const result = await service.getWorkspace(viewerAuth);

    expect(repository.listPendingInvitationsForWorkspace).not.toHaveBeenCalled();
    expect(result.invitations).toEqual([]);
  });

  it('delegates owner-sensitive member updates to the atomic repository path', async () => {
    const { repository, service } = createRepository();

    const result = await service.updateMember(ownerAuth, 'owner-1', {
      role: 'adult_member',
    });

    expect(repository.updateActiveMemberAtomically).toHaveBeenCalledWith(
      'workspace-1',
      'owner-1',
      { role: 'adult_member' },
    );
    expect(result).toMatchObject({
      userId: 'owner-1',
      role: 'adult_member',
      status: 'active',
    });
  });

  it('soft-removes active members through the atomic repository path', async () => {
    const { repository, service } = createRepository();

    await service.removeMember(ownerAuth, 'owner-1');

    expect(repository.updateActiveMemberAtomically).toHaveBeenCalledWith(
      'workspace-1',
      'owner-1',
      { status: 'removed' },
    );
  });

  it('revokes a pending invitation through the workspace-scoped repository path', async () => {
    const { repository, service } = createRepository();

    await service.revokeInvitation(ownerAuth, 'invitation-1');

    expect(repository.revokePendingInvitation).toHaveBeenCalledWith(
      'workspace-1',
      'invitation-1',
    );
  });

  it('allows only owners to revoke pending invitations', async () => {
    const { repository, service } = createRepository();

    await expect(
      service.revokeInvitation(adultAuth, 'invitation-1'),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'forbidden',
    });
    expect(repository.revokePendingInvitation).not.toHaveBeenCalled();
  });

  it('does not update removed members', async () => {
    const { repository, service } = createRepository({
      targetMember: member({ status: 'removed' }),
    });

    await expect(
      service.updateMember(ownerAuth, 'owner-1', { role: 'viewer' }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'workspace_member_not_found',
    });
    expect(repository.updateActiveMemberAtomically).not.toHaveBeenCalled();
  });

  it('returns a safe pending invitation DTO', async () => {
    const { repository, service } = createRepository();

    const result = await service.createInvitation(adultAuth, {
      participantId: 'participant-1',
      email: 'alex@example.com',
    });

    expect(repository.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        participantId: 'participant-1',
        email: 'alex@example.com',
        emailNormalized: 'alex@example.com',
        role: 'adult_member',
      }),
    );
    expect(result).toEqual({
      invitationId: 'invitation-1',
      participantId: 'participant-1',
      email: 'alex@example.com',
      role: 'adult_member',
      status: 'pending',
      deliveryStatus: 'sent',
      createdAt: '2026-06-06T10:00:00.000Z',
      expiresAt: '2026-06-13T10:00:00.000Z',
    });
    expect(result).not.toHaveProperty('userId');
  });

  it.each([
    ['adult', 'adult_member'],
    ['child', 'viewer'],
    ['other', 'viewer'],
  ] as const)('derives %s participant invitation access as %s', async (type, role) => {
    const { repository, service } = createRepository({ participantType: type });

    await service.createInvitation(ownerAuth, {
      participantId: 'participant-1',
      email: 'alex@example.com',
    });

    expect(repository.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ role }),
    );
  });

  it('marks a saved invitation as failed when email delivery fails', async () => {
    const sendInvitationEmail = vi.fn(async () => {
      throw new Error('SMTP unavailable');
    });
    const { repository, service } = createRepository({ sendInvitationEmail });

    await expect(service.createInvitation(ownerAuth, {
      participantId: 'participant-1',
      email: 'alex@example.com',
    })).rejects.toMatchObject({
      statusCode: 503,
      code: 'invitation_delivery_failed',
    });
    expect(repository.updateInvitationDelivery).toHaveBeenCalledWith(
      'workspace-1',
      'invitation-1',
      expect.objectContaining({ deliveryStatus: 'failed' }),
    );
  });

  it('rotates the pending invitation token before resending email', async () => {
    const sendInvitationEmail = vi.fn(async () => undefined);
    const { repository, service } = createRepository({ sendInvitationEmail });

    const result = await service.resendInvitation(ownerAuth, 'invitation-1');

    expect(repository.rotateInvitationToken).toHaveBeenCalledWith(
      'workspace-1',
      'invitation-1',
      expect.any(String),
      expect.any(String),
    );
    expect(sendInvitationEmail).toHaveBeenCalledWith('alex@example.com', {
      participantName: 'Alex',
      invitationUrl: expect.stringContaining('https://ourweekapp.com/invite?token='),
    });
    expect(result.deliveryStatus).toBe('sent');
  });

  it('links an already active member to the requested participant without sending email', async () => {
    const { repository, service } = createRepository();

    const result = await service.linkParticipantToExistingMember(ownerAuth, 'participant-1', {
      email: 'alex@example.com',
    });

    expect(repository.linkExistingMemberToParticipant).toHaveBeenCalledWith(
      'workspace-1',
      'participant-1',
      'alex@example.com',
      'alex@example.com',
    );
    expect(result).toEqual({
      participantId: 'participant-1',
      email: 'alex@example.com',
      accessStatus: 'active',
    });
  });
});
