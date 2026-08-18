import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceStore } from '@/app/stores/workspace';
import { ApiClientError } from '@/shared/api/httpClient';
import {
  createWorkspaceInvitation,
  getWorkspace,
  revokeWorkspaceInvitation,
} from '@/shared/api/workspaceApi';

const mocks = vi.hoisted(() => ({
  storedWorkspace: null as unknown,
  writeSettingsStorage: vi.fn(),
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

vi.mock('@/shared/services/storageService', () => ({
  readSettingsStorage: (_key: string, fallback: unknown) =>
    mocks.storedWorkspace ?? fallback,
  writeSettingsStorage: mocks.writeSettingsStorage,
}));

vi.mock('@/shared/api/workspaceApi', () => ({
  createWorkspaceInvitation: vi.fn(),
  getWorkspace: vi.fn(),
  removeWorkspaceMember: vi.fn(),
  revokeWorkspaceInvitation: vi.fn(),
  updateWorkspace: vi.fn(),
  updateWorkspaceMember: vi.fn(),
}));

const createInvitationMock = vi.mocked(createWorkspaceInvitation);
const getWorkspaceMock = vi.mocked(getWorkspace);
const revokeInvitationMock = vi.mocked(revokeWorkspaceInvitation);

function storedState() {
  return {
    version: 1,
    currentUserId: 'owner-1',
    workspace: {
      id: 'workspace-1',
      name: 'Our home',
      ownerId: 'owner-1',
      members: [
        {
          userId: 'owner-1',
          displayName: 'Rita',
          email: 'rita@example.com',
          role: 'owner',
          status: 'active',
        },
      ],
      createdAt: '2026-08-12T08:00:00.000Z',
      updatedAt: '2026-08-12T08:00:00.000Z',
    },
  };
}

function pendingInvitation(invitationId: string, email: string) {
  return {
    invitationId,
    email,
    displayName: 'Alex',
    role: 'adult_member' as const,
    status: 'pending' as const,
    createdAt: '2026-08-12T09:00:00.000Z',
    expiresAt: '2026-08-19T09:00:00.000Z',
  };
}

beforeEach(() => {
  mocks.storedWorkspace = storedState();
  mocks.writeSettingsStorage.mockReset();
  createInvitationMock.mockReset();
  getWorkspaceMock.mockReset();
  revokeInvitationMock.mockReset();
  setActivePinia(createPinia());
});

describe('workspace participant access', () => {
  it('migrates version-one workspace state with no invitation links', () => {
    const store = useWorkspaceStore();

    expect(store.participantInvitationLinks).toEqual({});
  });

  it('migrates workspace storage without invitations to version three', () => {
    mocks.storedWorkspace = { ...storedState(), version: 2 };
    const store = useWorkspaceStore();

    expect(store.version).toBe(3);
    expect(store.workspace.invitations).toEqual([]);
  });

  it('normalizes valid stored invitations and discards malformed records', () => {
    mocks.storedWorkspace = {
      ...storedState(),
      version: 3,
      workspace: {
        ...storedState().workspace,
        invitations: [
          {
            invitationId: ' invite-1 ',
            email: ' Alex@Example.com ',
            displayName: ' Alex ',
            role: 'adult_member',
            status: 'pending',
            createdAt: '2026-08-12T09:00:00.000Z',
            expiresAt: '2026-08-19T09:00:00.000Z',
          },
          { invitationId: '', email: 'broken@example.com' },
        ],
      },
    };

    expect(useWorkspaceStore().workspace.invitations).toEqual([
      {
        invitationId: 'invite-1',
        email: 'alex@example.com',
        displayName: 'Alex',
        role: 'adult_member',
        status: 'pending',
        createdAt: '2026-08-12T09:00:00.000Z',
        expiresAt: '2026-08-19T09:00:00.000Z',
      },
    ]);
  });

  it('invites an adult member and stores a normalized participant link', async () => {
    createInvitationMock.mockResolvedValue({
      invitationId: 'invite-1',
      email: 'Alex@Example.com',
      displayName: 'Alex',
      role: 'adult_member',
      status: 'pending',
      createdAt: '2026-08-12T09:00:00.000Z',
      expiresAt: '2026-08-19T09:00:00.000Z',
    });
    const store = useWorkspaceStore();

    await store.inviteParticipant(
      'participant-1',
      'Alex',
      ' Alex@Example.com '
    );

    expect(createInvitationMock).toHaveBeenCalledWith({
      displayName: 'Alex',
      email: 'alex@example.com',
      role: 'adult_member',
    });
    expect(store.participantInvitationLinks['participant-1']).toEqual({
      participantId: 'participant-1',
      email: 'alex@example.com',
      invitationId: 'invite-1',
    });
    expect(store.workspace.invitations).toContainEqual(
      pendingInvitation('invite-1', 'alex@example.com')
    );
    expect(
      store.workspace.members.some((member) => member.userId === 'invite-1')
    ).toBe(false);
    expect(store.getParticipantAccessState('participant-1')).toEqual({
      status: 'pending',
      email: 'alex@example.com',
    });
  });

  it('keeps a participant link matched by a pending backend invitation', () => {
    const store = useWorkspaceStore();
    store.participantInvitationLinks = {
      'participant-1': {
        participantId: 'participant-1',
        email: 'alex@example.com',
        invitationId: 'invite-1',
      },
    };

    store.applyWorkspace({
      ...store.workspace,
      invitations: [pendingInvitation('invite-1', ' Alex@Example.com ')],
    });

    expect(store.getParticipantAccessState('participant-1')).toEqual({
      status: 'pending',
      email: 'alex@example.com',
    });
  });

  it('rehydrates the persisted pending invitation in a fresh store', () => {
    const firstStore = useWorkspaceStore();
    firstStore.participantInvitationLinks = {
      'participant-1': {
        participantId: 'participant-1',
        email: 'alex@example.com',
        invitationId: 'invite-1',
      },
    };
    firstStore.applyWorkspace({
      ...firstStore.workspace,
      invitations: [pendingInvitation('invite-1', 'alex@example.com')],
    });
    mocks.storedWorkspace = mocks.writeSettingsStorage.mock.lastCall?.[1];
    setActivePinia(createPinia());

    expect(
      useWorkspaceStore().getParticipantAccessState('participant-1')
    ).toEqual({ status: 'pending', email: 'alex@example.com' });
  });

  it('uses a matching active member after an invitation is accepted', () => {
    const store = useWorkspaceStore();
    store.participantInvitationLinks = {
      'participant-1': {
        participantId: 'participant-1',
        email: 'alex@example.com',
        invitationId: 'invite-1',
      },
    };

    store.applyWorkspace({
      ...store.workspace,
      members: [
        ...store.workspace.members,
        {
          userId: 'member-1',
          displayName: 'Alex',
          email: ' Alex@Example.com ',
          role: 'adult_member',
          status: 'active',
        },
      ],
      invitations: [
        {
          ...pendingInvitation('invite-1', 'alex@example.com'),
          status: 'accepted',
        },
      ],
    });

    expect(store.getParticipantAccessState('participant-1')).toEqual({
      status: 'active',
      email: 'alex@example.com',
    });
  });

  it('removes links backed only by expired or revoked invitations', () => {
    const store = useWorkspaceStore();
    store.participantInvitationLinks = {
      expired: {
        participantId: 'expired',
        email: 'expired@example.com',
      },
      revoked: {
        participantId: 'revoked',
        email: 'revoked@example.com',
      },
    };

    store.applyWorkspace({
      ...store.workspace,
      invitations: [
        {
          ...pendingInvitation('expired-invite', 'expired@example.com'),
          status: 'expired',
        },
        {
          ...pendingInvitation('revoked-invite', 'revoked@example.com'),
          status: 'revoked',
        },
      ],
    });

    expect(store.participantInvitationLinks).toEqual({});
  });

  it('links an existing member by case-insensitive email without posting', async () => {
    const store = useWorkspaceStore();

    const member = await store.inviteParticipant(
      'participant-me',
      'Rita',
      ' RITA@example.com '
    );

    expect(member?.userId).toBe('owner-1');
    expect(createInvitationMock).not.toHaveBeenCalled();
    expect(store.getParticipantAccessState('participant-me')).toEqual({
      status: 'active',
      email: 'rita@example.com',
    });
  });

  it('rejects an email already connected to a different participant', async () => {
    const store = useWorkspaceStore();
    store.participantInvitationLinks = {
      'participant-1': {
        participantId: 'participant-1',
        email: 'alex@example.com',
      },
    };

    const member = await store.inviteParticipant(
      'participant-2',
      'Other Alex',
      'alex@example.com'
    );

    expect(member).toBeNull();
    expect(store.errorMessage).toBe('workspace.emailAlreadyLinked');
    expect(createInvitationMock).not.toHaveBeenCalled();
  });

  it('derives active access and clears orphan links after refresh', () => {
    const store = useWorkspaceStore();
    store.participantInvitationLinks = {
      active: { participantId: 'active', email: 'rita@example.com' },
      missing: { participantId: 'missing', email: 'missing@example.com' },
    };

    store.applyWorkspace(store.workspace);

    expect(store.getParticipantAccessState('active').status).toBe('active');
    expect(store.getParticipantAccessState('missing').status).toBe('none');
    expect(store.participantInvitationLinks.missing).toBeUndefined();
  });

  it('revokes a linked pending invitation without changing unrelated records', async () => {
    revokeInvitationMock.mockResolvedValue();
    const store = useWorkspaceStore();
    store.workspace.invitations = [
      pendingInvitation('invite-1', 'alex@example.com'),
      pendingInvitation('invite-2', 'sam@example.com'),
    ];
    store.participantInvitationLinks = {
      'participant-1': {
        participantId: 'participant-1',
        email: 'alex@example.com',
        invitationId: 'invite-1',
      },
      'participant-2': {
        participantId: 'participant-2',
        email: 'sam@example.com',
        invitationId: 'invite-2',
      },
    };

    expect(store.getParticipantPendingInvitation('participant-1')).toEqual(
      pendingInvitation('invite-1', 'alex@example.com')
    );
    expect(await store.revokeParticipantInvitation('participant-1')).toBe(true);
    expect(revokeInvitationMock).toHaveBeenCalledWith('invite-1');
    expect(store.workspace.invitations).toEqual([
      pendingInvitation('invite-2', 'sam@example.com'),
    ]);
    expect(store.participantInvitationLinks['participant-1']).toBeUndefined();
    expect(store.participantInvitationLinks['participant-2']).toBeDefined();
    expect(mocks.writeSettingsStorage).toHaveBeenCalled();
  });

  it('falls back to normalized email for a legacy invitation link', () => {
    const store = useWorkspaceStore();
    store.workspace.invitations = [
      pendingInvitation('invite-1', 'alex@example.com'),
    ];
    store.participantInvitationLinks = {
      'participant-1': {
        participantId: 'participant-1',
        email: ' Alex@Example.com ',
      },
    };

    expect(
      store.getParticipantPendingInvitation('participant-1')?.invitationId
    ).toBe('invite-1');
  });

  it('does not call the API without a local pending invitation', async () => {
    const store = useWorkspaceStore();

    expect(await store.revokeParticipantInvitation('missing')).toBe(false);
    expect(revokeInvitationMock).not.toHaveBeenCalled();
  });

  it('reloads and reconciles the workspace when revoke returns 404', async () => {
    revokeInvitationMock.mockRejectedValue(
      new ApiClientError('Missing', { status: 404 })
    );
    const store = useWorkspaceStore();
    const invitation = pendingInvitation('invite-1', 'alex@example.com');
    store.workspace.invitations = [invitation];
    store.participantInvitationLinks = {
      'participant-1': {
        participantId: 'participant-1',
        email: invitation.email,
        invitationId: invitation.invitationId,
      },
    };
    getWorkspaceMock.mockResolvedValue({
      ...store.workspace,
      invitations: [],
    });

    expect(await store.revokeParticipantInvitation('participant-1')).toBe(
      false
    );
    expect(getWorkspaceMock).toHaveBeenCalled();
    expect(store.participantInvitationLinks['participant-1']).toBeUndefined();
    expect(store.errorMessage).toBe('workspace.invitationNoLongerPending');
  });

  it('retains local invitation state for non-404 revoke failures', async () => {
    revokeInvitationMock.mockRejectedValue(new Error('raw backend detail'));
    const store = useWorkspaceStore();
    const invitation = pendingInvitation('invite-1', 'alex@example.com');
    store.workspace.invitations = [invitation];
    store.participantInvitationLinks = {
      'participant-1': {
        participantId: 'participant-1',
        email: invitation.email,
        invitationId: invitation.invitationId,
      },
    };

    expect(await store.revokeParticipantInvitation('participant-1')).toBe(
      false
    );
    expect(store.workspace.invitations).toEqual([invitation]);
    expect(store.participantInvitationLinks['participant-1']).toBeDefined();
    expect(store.errorMessage).toBe('workspace.revokeInvitationFailed');
  });
});
