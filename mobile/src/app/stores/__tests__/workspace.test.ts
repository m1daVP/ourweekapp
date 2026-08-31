import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useParticipantsStore } from '@/app/stores/participants';
import { useWorkspaceStore } from '@/app/stores/workspace';
import {
  createWorkspaceInvitation,
  getWorkspace,
  linkWorkspaceParticipantToMember,
  resendWorkspaceInvitation,
  updateWorkspace,
} from '@/shared/api/workspaceApi';
import { listParticipants } from '@/shared/api/participantsApi';

const mocks = vi.hoisted(() => ({
  storedWorkspace: null as unknown,
  writeSettingsStorage: vi.fn(),
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));
vi.mock('@/shared/services/storageService', () => ({
  readStorageSlice: (_key: string, fallback: unknown) => fallback,
  writeStorageSlice: vi.fn(),
  readSettingsStorage: (_key: string, fallback: unknown) =>
    mocks.storedWorkspace ?? fallback,
  writeSettingsStorage: mocks.writeSettingsStorage,
}));
vi.mock('@/shared/api/workspaceApi', () => ({
  createWorkspaceInvitation: vi.fn(),
  getWorkspace: vi.fn(),
  linkWorkspaceParticipantToMember: vi.fn(),
  removeWorkspaceMember: vi.fn(),
  resendWorkspaceInvitation: vi.fn(),
  revokeWorkspaceInvitation: vi.fn(),
  updateWorkspace: vi.fn(),
  updateWorkspaceMember: vi.fn(),
}));
vi.mock('@/shared/api/participantsApi', () => ({
  listParticipants: vi.fn(),
}));

const createInvitationMock = vi.mocked(createWorkspaceInvitation);
const linkParticipantMock = vi.mocked(linkWorkspaceParticipantToMember);
const getWorkspaceMock = vi.mocked(getWorkspace);
const listParticipantsMock = vi.mocked(listParticipants);
const resendInvitationMock = vi.mocked(resendWorkspaceInvitation);
const updateWorkspaceMock = vi.mocked(updateWorkspace);

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    invitationId: 'invite-1',
    participantId: 'participant-1',
    email: 'alex@example.com',
    displayName: 'Alex',
    role: 'adult_member' as const,
    status: 'pending' as const,
    deliveryStatus: 'sent' as const,
    createdAt: '2026-08-12T09:00:00.000Z',
    expiresAt: '2026-08-19T09:00:00.000Z',
    ...overrides,
  };
}

function useAdultMember(store: ReturnType<typeof useWorkspaceStore>) {
  store.currentUserId = 'adult-1';
  store.applyWorkspace({
    ...store.workspace,
    members: [
      ...store.workspace.members,
      {
        userId: 'adult-1',
        displayName: 'Alex',
        email: 'alex@example.com',
        role: 'adult_member',
        status: 'active',
      },
    ],
    invitations: [invitation()],
  });
}

beforeEach(() => {
  mocks.storedWorkspace = {
    version: 3,
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
      invitations: [],
      createdAt: '2026-08-12T08:00:00.000Z',
      updatedAt: '2026-08-12T08:00:00.000Z',
    },
  };
  mocks.writeSettingsStorage.mockReset();
  createInvitationMock.mockReset();
  linkParticipantMock.mockReset();
  getWorkspaceMock.mockReset();
  listParticipantsMock.mockReset();
  resendInvitationMock.mockReset();
  updateWorkspaceMock.mockReset();
  setActivePinia(createPinia());
});

describe('workspace participant access', () => {
  it('derives pending state from the server invitation participant ID', () => {
    const store = useWorkspaceStore();
    store.applyWorkspace({ ...store.workspace, invitations: [invitation()] });

    expect(store.getParticipantAccessState('participant-1')).toEqual({
      status: 'pending',
      email: 'alex@example.com',
    });
  });

  it('derives active state from a server participant email and active member', () => {
    useParticipantsStore().applyParticipants([
      {
        id: 'participant-1',
        name: 'Alex',
        initials: 'A',
        avatarColor: '#496a8f',
        type: 'adult',
        email: 'Alex@Example.com',
        isActive: true,
        createdAt: '2026-08-12T08:00:00.000Z',
        updatedAt: '2026-08-12T08:00:00.000Z',
      },
    ]);
    const store = useWorkspaceStore();
    store.applyWorkspace({
      ...store.workspace,
      members: [
        ...store.workspace.members,
        {
          userId: 'member-1',
          displayName: 'Alex',
          email: 'alex@example.com',
          role: 'adult_member',
          status: 'active',
        },
      ],
    });

    expect(store.getParticipantAccessState('participant-1')).toEqual({
      status: 'active',
      email: 'alex@example.com',
    });
  });

  it('posts only the participant ID and normalized email when inviting', async () => {
    createInvitationMock.mockResolvedValue(invitation());
    const store = useWorkspaceStore();
    store.applyWorkspace(store.workspace);

    await store.inviteParticipant(' participant-1 ', ' Alex@Example.com ');

    expect(createInvitationMock).toHaveBeenCalledWith({
      participantId: 'participant-1',
      email: 'alex@example.com',
    });
    expect(store.getParticipantAccessState('participant-1')).toEqual({
      status: 'pending',
      email: 'alex@example.com',
    });
  });

  it('uses the dedicated server link operation for an active workspace member', async () => {
    const store = useWorkspaceStore();
    store.applyWorkspace(store.workspace);
    linkParticipantMock.mockResolvedValue();
    getWorkspaceMock.mockResolvedValue(store.workspace);
    listParticipantsMock.mockResolvedValue({ participants: [] });

    const linkedMember = await store.inviteParticipant(
      'participant-1',
      ' RITA@example.com '
    );

    expect(linkParticipantMock).toHaveBeenCalledWith('participant-1', {
      email: 'rita@example.com',
    });
    expect(createInvitationMock).not.toHaveBeenCalled();
    expect(linkedMember?.status).toBe('active');
  });

  it('keeps delivery failures visible and can resend that invitation', async () => {
    const store = useWorkspaceStore();
    store.applyWorkspace({
      ...store.workspace,
      invitations: [invitation({ deliveryStatus: 'failed' })],
    });
    resendInvitationMock.mockResolvedValue(
      invitation({ deliveryStatus: 'sent' })
    );

    expect(await store.resendParticipantInvitation('participant-1')).toBe(true);
    expect(resendInvitationMock).toHaveBeenCalledWith('invite-1');
    expect(store.workspace.invitations[0]?.deliveryStatus).toBe('sent');
  });

  it('does not let an adult member create, link, or resend invitations', async () => {
    const store = useWorkspaceStore();
    useAdultMember(store);

    await expect(
      store.inviteParticipant('participant-1', 'new@example.com')
    ).resolves.toBeNull();
    await expect(
      store.inviteParticipant('participant-1', 'rita@example.com')
    ).resolves.toBeNull();
    await expect(
      store.resendParticipantInvitation('participant-1')
    ).resolves.toBe(false);

    expect(createInvitationMock).not.toHaveBeenCalled();
    expect(linkParticipantMock).not.toHaveBeenCalled();
    expect(resendInvitationMock).not.toHaveBeenCalled();
  });

  it('does not let an adult member rename the household', async () => {
    const store = useWorkspaceStore();
    useAdultMember(store);

    await expect(store.saveWorkspaceName('Renamed home')).resolves.toBe(false);

    expect(updateWorkspaceMock).not.toHaveBeenCalled();
  });
});
