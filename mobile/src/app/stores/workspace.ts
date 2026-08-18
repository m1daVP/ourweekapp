import { defineStore } from 'pinia';
import { translate } from '@/features/localization/i18n';
import {
  createWorkspaceInvitation,
  getWorkspace,
  removeWorkspaceMember as removeWorkspaceMemberRequest,
  revokeWorkspaceInvitation,
  updateWorkspace,
  updateWorkspaceMember,
} from '@/shared/api/workspaceApi';
import {
  readSettingsStorage,
  writeSettingsStorage,
} from '@/shared/services/storageService';
import { ApiClientError } from '@/shared/api/httpClient';
import { nowIso } from '@/shared/utils/dates';
import { createPrefixedId } from '@/shared/utils/ids';
import type { UserRole } from '@/features/access/types';
import type {
  ParticipantAccessState,
  ParticipantInvitationLink,
  Workspace,
  WorkspaceInvitation,
  WorkspaceInvitationStatus,
  WorkspaceMember,
  WorkspaceMemberStatus,
} from '@/features/workspace/types';

const STORAGE_VERSION = 3;
const LOCAL_OWNER_ID = 'local-owner';

interface WorkspaceState {
  version: number;
  currentUserId: string;
  workspace: Workspace;
  participantInvitationLinks: Record<string, ParticipantInvitationLink>;
  isLoading: boolean;
  isSaving: boolean;
  errorMessage: string;
  lastSyncedAt: string | null;
}

interface StoredWorkspaceState {
  version: number;
  currentUserId?: string;
  workspace?: Omit<Partial<Workspace>, 'members' | 'invitations'> & {
    members?: Partial<WorkspaceMember>[];
    invitations?: Partial<WorkspaceInvitation>[];
  };
  participantInvitationLinks?: unknown;
}

function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase();
}

function normalizeParticipantInvitationLinks(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, ParticipantInvitationLink>;
  }

  return Object.values(value as Record<string, unknown>).reduce<
    Record<string, ParticipantInvitationLink>
  >((links, candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return links;
    }

    const link = candidate as Partial<ParticipantInvitationLink>;
    const participantId = link.participantId?.trim();
    const email = link.email ? normalizeEmail(link.email) : '';

    if (participantId && email) {
      links[participantId] = {
        participantId,
        email,
        invitationId: link.invitationId?.trim() || undefined,
      };
    }

    return links;
  }, {});
}

function normalizeRole(role: unknown): UserRole {
  if (role === 'owner' || role === 'adult_member' || role === 'viewer') {
    return role;
  }

  if (role === 'partner') {
    return 'adult_member';
  }

  return 'viewer';
}

function normalizeStatus(status: unknown): WorkspaceMemberStatus {
  if (status === 'active' || status === 'invited' || status === 'removed') {
    return status;
  }

  return 'active';
}

function normalizeInvitationRole(
  role: unknown
): Exclude<UserRole, 'owner'> | null {
  if (role === 'adult_member' || role === 'viewer') {
    return role;
  }

  if (role === 'partner') {
    return 'adult_member';
  }

  return null;
}

function normalizeInvitationStatus(
  status: unknown
): WorkspaceInvitationStatus | null {
  if (
    status === 'pending' ||
    status === 'accepted' ||
    status === 'revoked' ||
    status === 'expired'
  ) {
    return status;
  }

  return null;
}

function normalizeInvitation(
  invitation: Partial<WorkspaceInvitation>
): WorkspaceInvitation | null {
  const invitationId = invitation.invitationId?.trim();
  const email = invitation.email ? normalizeEmail(invitation.email) : '';
  const createdAt = invitation.createdAt?.trim();
  const expiresAt = invitation.expiresAt?.trim();
  const role = normalizeInvitationRole(invitation.role);
  const status = normalizeInvitationStatus(invitation.status);

  if (!invitationId || !email || !createdAt || !expiresAt || !role || !status) {
    return null;
  }

  return {
    invitationId,
    email,
    displayName: invitation.displayName?.trim() || undefined,
    role,
    status,
    createdAt,
    expiresAt,
  };
}

function createDefaultWorkspace(): Workspace {
  const createdAt = nowIso();

  return {
    id: createPrefixedId('workspace'),
    name: translate('settings.defaultWorkspace'),
    ownerId: LOCAL_OWNER_ID,
    members: [
      {
        userId: LOCAL_OWNER_ID,
        displayName: translate('settings.defaultParticipant.me'),
        role: 'owner',
        status: 'active',
      },
      {
        userId: 'local-adult-member',
        displayName: translate('settings.defaultParticipant.partner'),
        role: 'adult_member',
        status: 'active',
      },
    ],
    invitations: [],
    createdAt,
    updatedAt: createdAt,
  };
}

function createAuthenticatedPlaceholderWorkspace(userId: string): Workspace {
  const createdAt = nowIso();

  return {
    id: createPrefixedId('workspace'),
    name: translate('settings.defaultWorkspace'),
    ownerId: userId,
    members: [
      {
        userId,
        displayName: translate('common.weeklyUsUser'),
        role: 'owner',
        status: 'active',
      },
    ],
    invitations: [],
    createdAt,
    updatedAt: createdAt,
  };
}

function normalizeMember(member: Partial<WorkspaceMember>) {
  const displayName = member.displayName?.trim();

  if (!displayName) {
    return null;
  }

  return {
    userId: member.userId?.trim() || createPrefixedId('member'),
    displayName,
    email: member.email?.trim() || undefined,
    role: normalizeRole(member.role),
    status: normalizeStatus(member.status),
  } satisfies WorkspaceMember;
}

function normalizeWorkspace(
  workspace: StoredWorkspaceState['workspace']
): Workspace {
  const fallback = createDefaultWorkspace();
  const members =
    workspace?.members
      ?.map(normalizeMember)
      .filter((member): member is WorkspaceMember => Boolean(member)) ?? [];
  const invitations =
    workspace?.invitations
      ?.map(normalizeInvitation)
      .filter((invitation): invitation is WorkspaceInvitation =>
        Boolean(invitation)
      ) ?? [];
  const ownerId =
    workspace?.ownerId &&
    members.some((member) => member.userId === workspace.ownerId)
      ? workspace.ownerId
      : fallback.ownerId;

  if (!members.some((member) => member.userId === ownerId)) {
    members.unshift(fallback.members[0]);
  }

  for (const member of members) {
    if (member.userId === ownerId) {
      member.role = 'owner';
      member.status = 'active';
    } else if (member.role === 'owner') {
      member.role = 'adult_member';
    }
  }

  return {
    id: workspace?.id?.trim() || fallback.id,
    name: workspace?.name?.trim() || fallback.name,
    ownerId,
    members,
    invitations,
    createdAt: workspace?.createdAt ?? fallback.createdAt,
    updatedAt: workspace?.updatedAt ?? fallback.updatedAt,
  };
}

function getStoredState(): WorkspaceState {
  const fallbackWorkspace = createDefaultWorkspace();
  const storedState = readSettingsStorage<StoredWorkspaceState | null>(
    'workspace',
    null
  );

  if (!storedState) {
    return {
      version: STORAGE_VERSION,
      currentUserId: LOCAL_OWNER_ID,
      workspace: fallbackWorkspace,
      participantInvitationLinks: {},
      isLoading: false,
      isSaving: false,
      errorMessage: '',
      lastSyncedAt: null,
    };
  }

  const workspace = normalizeWorkspace(storedState.workspace);
  const currentUserId =
    storedState.currentUserId &&
    workspace.members.some(
      (member) => member.userId === storedState.currentUserId
    )
      ? storedState.currentUserId
      : workspace.ownerId;

  return {
    version: STORAGE_VERSION,
    currentUserId,
    workspace,
    participantInvitationLinks: normalizeParticipantInvitationLinks(
      storedState.participantInvitationLinks
    ),
    isLoading: false,
    isSaving: false,
    errorMessage: '',
    lastSyncedAt: null,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const useWorkspaceStore = defineStore('workspace', {
  state: (): WorkspaceState => getStoredState(),
  getters: {
    activeMembers: (state) =>
      state.workspace.members.filter((member) => member.status === 'active'),
    visibleMembers: (state) =>
      state.workspace.members.filter((member) => member.status !== 'removed'),
    currentMember: (state) =>
      state.workspace.members.find(
        (member) => member.userId === state.currentUserId
      ) ?? null,
    currentUserRole(): UserRole {
      if (this.currentUserId !== LOCAL_OWNER_ID && !this.lastSyncedAt) {
        return 'viewer';
      }

      return this.currentMember?.role ?? 'viewer';
    },
  },
  actions: {
    persist() {
      writeSettingsStorage('workspace', {
        version: STORAGE_VERSION,
        currentUserId: this.currentUserId,
        workspace: this.workspace,
        participantInvitationLinks: this.participantInvitationLinks,
      });
    },
    applyWorkspace(workspace: Workspace) {
      this.workspace = normalizeWorkspace(workspace);

      const accessibleEmails = new Set([
        ...this.workspace.members
          .filter(
            (member) => member.status !== 'removed' && Boolean(member.email)
          )
          .map((member) => normalizeEmail(member.email ?? '')),
        ...this.workspace.invitations
          .filter((invitation) => invitation.status === 'pending')
          .map((invitation) => invitation.email),
      ]);

      this.participantInvitationLinks = Object.fromEntries(
        Object.entries(this.participantInvitationLinks).filter(([, link]) =>
          accessibleEmails.has(link.email)
        )
      );

      if (
        !this.workspace.members.some(
          (member) => member.userId === this.currentUserId
        )
      ) {
        this.currentUserId = this.workspace.ownerId;
      }

      this.lastSyncedAt = nowIso();
      this.persist();
    },
    resetForAuthenticatedUser(userId: string) {
      this.workspace = createAuthenticatedPlaceholderWorkspace(userId);
      this.currentUserId = userId;
      this.participantInvitationLinks = {};
      this.isLoading = false;
      this.isSaving = false;
      this.errorMessage = '';
      this.lastSyncedAt = null;
      this.persist();
    },
    applyMember(nextMember: WorkspaceMember) {
      const normalizedMember = normalizeMember(nextMember);

      if (!normalizedMember) {
        return;
      }

      const memberIndex = this.workspace.members.findIndex(
        (member) => member.userId === normalizedMember.userId
      );

      if (memberIndex >= 0) {
        this.workspace.members[memberIndex] = normalizedMember;
      } else {
        this.workspace.members.push(normalizedMember);
      }

      this.workspace.updatedAt = nowIso();
      this.lastSyncedAt = nowIso();
      this.persist();
    },
    async loadWorkspace() {
      this.isLoading = true;
      this.errorMessage = '';

      try {
        const workspace = await getWorkspace();
        this.applyWorkspace(workspace);
        return true;
      } catch (error) {
        this.errorMessage = getErrorMessage(
          error,
          translate('workspace.loadFailed')
        );
        return false;
      } finally {
        this.isLoading = false;
      }
    },
    async saveWorkspaceName(name: string) {
      const nextName = name.trim();

      if (!nextName) {
        return false;
      }

      this.isSaving = true;
      this.errorMessage = '';

      try {
        const workspace = await updateWorkspace({ name: nextName });
        this.applyWorkspace(workspace);
        return true;
      } catch (error) {
        this.errorMessage = getErrorMessage(
          error,
          translate('workspace.saveWorkspaceFailed')
        );
        return false;
      } finally {
        this.isSaving = false;
      }
    },
    getParticipantAccessState(participantId: string): ParticipantAccessState {
      const link = this.participantInvitationLinks[participantId];

      if (!link) {
        return { status: 'none' };
      }

      const member = this.workspace.members.find(
        (candidate) =>
          candidate.status !== 'removed' &&
          candidate.email &&
          normalizeEmail(candidate.email) === link.email
      );

      if (!member) {
        const invitation = this.workspace.invitations.find(
          (candidate) =>
            candidate.status === 'pending' && candidate.email === link.email
        );

        return invitation
          ? { status: 'pending', email: link.email }
          : { status: 'none' };
      }

      return {
        status: member.status === 'active' ? 'active' : 'pending',
        email: link.email,
      };
    },
    getParticipantPendingInvitation(
      participantId: string
    ): WorkspaceInvitation | null {
      const link = this.participantInvitationLinks[participantId.trim()];

      if (!link) {
        return null;
      }

      const invitationById = link.invitationId
        ? this.workspace.invitations.find(
            (invitation) =>
              invitation.status === 'pending' &&
              invitation.invitationId === link.invitationId
          )
        : undefined;

      if (invitationById) {
        return invitationById;
      }

      const email = normalizeEmail(link.email);
      return (
        this.workspace.invitations.find(
          (invitation) =>
            invitation.status === 'pending' && invitation.email === email
        ) ?? null
      );
    },
    async revokeParticipantInvitation(participantId: string) {
      const normalizedParticipantId = participantId.trim();
      const invitation = this.getParticipantPendingInvitation(
        normalizedParticipantId
      );

      if (!invitation) {
        this.errorMessage = translate('workspace.invitationNoLongerPending');
        return false;
      }

      this.isSaving = true;
      this.errorMessage = '';

      try {
        await revokeWorkspaceInvitation(invitation.invitationId);
        this.workspace.invitations = this.workspace.invitations.filter(
          (candidate) => candidate.invitationId !== invitation.invitationId
        );
        delete this.participantInvitationLinks[normalizedParticipantId];
        this.workspace.updatedAt = nowIso();
        this.lastSyncedAt = nowIso();
        this.persist();
        return true;
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) {
          const didLoadWorkspace = await this.loadWorkspace();

          if (didLoadWorkspace) {
            this.errorMessage = translate(
              'workspace.invitationNoLongerPending'
            );
          }

          return false;
        }

        this.errorMessage = translate('workspace.revokeInvitationFailed');
        return false;
      } finally {
        this.isSaving = false;
      }
    },
    async inviteParticipant(
      participantId: string,
      displayName: string,
      emailValue: string
    ): Promise<WorkspaceMember | WorkspaceInvitation | null> {
      const normalizedParticipantId = participantId.trim();
      const normalizedDisplayName = displayName.trim();
      const email = normalizeEmail(emailValue);

      if (!normalizedParticipantId || !normalizedDisplayName || !email) {
        return null;
      }

      this.errorMessage = '';

      const conflictingLink = Object.values(
        this.participantInvitationLinks
      ).find(
        (link) =>
          link.participantId !== normalizedParticipantId && link.email === email
      );

      if (conflictingLink) {
        this.errorMessage = translate('workspace.emailAlreadyLinked');
        return null;
      }

      const existingMember = this.workspace.members.find(
        (member) =>
          member.status !== 'removed' &&
          member.email &&
          normalizeEmail(member.email) === email
      );

      if (existingMember) {
        this.participantInvitationLinks[normalizedParticipantId] = {
          participantId: normalizedParticipantId,
          email,
        };
        this.persist();
        return existingMember;
      }

      this.isSaving = true;

      try {
        const invitationResponse = await createWorkspaceInvitation({
          displayName: normalizedDisplayName,
          email,
          role: 'adult_member',
        });
        const invitation = normalizeInvitation(invitationResponse);

        if (!invitation) {
          this.errorMessage = translate('workspace.saveInviteFailed');
          return null;
        }

        const invitationIndex = this.workspace.invitations.findIndex(
          (candidate) => candidate.invitationId === invitation.invitationId
        );

        if (invitationIndex >= 0) {
          this.workspace.invitations[invitationIndex] = invitation;
        } else {
          this.workspace.invitations.push(invitation);
        }

        this.workspace.updatedAt = nowIso();
        this.lastSyncedAt = nowIso();
        this.participantInvitationLinks[normalizedParticipantId] = {
          participantId: normalizedParticipantId,
          email: invitation.email,
          invitationId: invitation.invitationId,
        };
        this.persist();
        return invitation;
      } catch (error) {
        this.errorMessage = getErrorMessage(
          error,
          translate('workspace.saveInviteFailed')
        );
        return null;
      } finally {
        this.isSaving = false;
      }
    },
    async saveMemberRole(userId: string, role: Exclude<UserRole, 'owner'>) {
      this.isSaving = true;
      this.errorMessage = '';

      try {
        const member = await updateWorkspaceMember(userId, { role });
        this.applyMember(member);
        return true;
      } catch (error) {
        this.errorMessage = getErrorMessage(
          error,
          translate('workspace.saveMemberFailed')
        );
        return false;
      } finally {
        this.isSaving = false;
      }
    },
    async removeWorkspaceMember(userId: string) {
      this.isSaving = true;
      this.errorMessage = '';

      try {
        await removeWorkspaceMemberRequest(userId);

        const member = this.workspace.members.find(
          (item) => item.userId === userId
        );

        if (member) {
          member.status = 'removed';
          this.workspace.updatedAt = nowIso();
        }

        if (this.currentUserId === userId) {
          this.currentUserId = this.workspace.ownerId;
        }

        this.lastSyncedAt = nowIso();
        this.persist();
        return true;
      } catch (error) {
        this.errorMessage = getErrorMessage(
          error,
          translate('workspace.removeMemberFailed')
        );
        return false;
      } finally {
        this.isSaving = false;
      }
    },
  },
});
