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
    email: 'alex@example.com',
    emailNormalized: 'alex@example.com',
    displayName: 'Alex',
    role: 'adult_member',
    status: 'pending',
    createdAt: '2026-06-06T10:00:00.000Z',
    expiresAt: '2026-06-13T10:00:00.000Z',
    ...overrides,
  };
}

function createRepository(input: {
  targetMember?: RepositoryWorkspaceMemberDto | null;
  workspace?: RepositoryWorkspaceDto | null;
  invitations?: RepositoryWorkspaceInvitationDto[];
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
    findActiveMemberByEmailForWorkspace: vi.fn(async () => null),
    createInvitation: vi.fn(async () => ({
      ...invitation(),
    })),
  };

  return {
    repository,
    service: new WorkspaceService(
      repository as unknown as WorkspacesRepository,
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
        displayName: 'Alex',
        email: 'alex@example.com',
        role: 'adult_member',
        status: 'pending',
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
      email: 'alex@example.com',
      displayName: 'Alex',
      role: 'adult_member',
    });

    expect(repository.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        email: 'alex@example.com',
        emailNormalized: 'alex@example.com',
        displayName: 'Alex',
        role: 'adult_member',
      }),
    );
    expect(result).toEqual({
      invitationId: 'invitation-1',
      displayName: 'Alex',
      email: 'alex@example.com',
      role: 'adult_member',
      status: 'pending',
      createdAt: '2026-06-06T10:00:00.000Z',
      expiresAt: '2026-06-13T10:00:00.000Z',
    });
    expect(result).not.toHaveProperty('userId');
  });
});
