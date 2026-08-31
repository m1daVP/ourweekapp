import { defineStore } from 'pinia';
import { translate } from '@/features/localization/i18n';
import {
  createWorkspaceInvitation,
  getWorkspace,
  linkWorkspaceParticipantToMember,
  removeWorkspaceMember as removeWorkspaceMemberRequest,
  resendWorkspaceInvitation,
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
import { useParticipantsStore } from '@/app/stores/participants';
import { listParticipants } from '@/shared/api/participantsApi';
import { fromParticipantDto } from '@/shared/api/syncDtos';
import { roleCan } from '@/features/workspace/permissions';
import type { UserRole } from '@/features/access/types';
import type {
  ParticipantAccessState,
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
}

function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase();
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

function normalizeInvitationDeliveryStatus(value: unknown) {
  return value === 'pending' || value === 'sent' || value === 'failed'
    ? value
    : 'pending';
}

function normalizeInvitation(
  invitation: Partial<WorkspaceInvitation>
): WorkspaceInvitation | null {
  const invitationId = invitation.invitationId?.trim();
  const participantId = invitation.participantId?.trim();
  const email = invitation.email ? normalizeEmail(invitation.email) : '';
  const createdAt = invitation.createdAt?.trim();
  const expiresAt = invitation.expiresAt?.trim();
  const role = normalizeInvitationRole(invitation.role);
  const status = normalizeInvitationStatus(invitation.status);

  if (
    !invitationId ||
    !participantId ||
    !email ||
    !createdAt ||
    !expiresAt ||
    !role ||
    !status
  ) {
    return null;
  }

  return {
    invitationId,
    participantId,
    email,
    displayName: invitation.displayName?.trim() || undefined,
    role,
    status,
    createdAt,
    expiresAt,
    deliveryStatus: normalizeInvitationDeliveryStatus(
      invitation.deliveryStatus
    ),
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
      });
    },
    applyWorkspace(workspace: Workspace) {
      this.workspace = normalizeWorkspace(workspace);

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
      if (!roleCan(this.currentUserRole, 'manageWorkspace')) {
        return false;
      }

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
      const pendingInvitation =
        this.getParticipantPendingInvitation(participantId);

      if (pendingInvitation) {
        return { status: 'pending', email: pendingInvitation.email };
      }

      // Participant emails are hydrated from the server. Matching them to an
      // active member is deliberately the only active-access signal.
      const participant =
        useParticipantsStore().getParticipantById(participantId);
      const email = participant?.email ? normalizeEmail(participant.email) : '';
      const member = email
        ? this.workspace.members.find(
            (candidate) =>
              candidate.status === 'active' &&
              candidate.email &&
              normalizeEmail(candidate.email) === email
          )
        : undefined;

      return member ? { status: 'active', email } : { status: 'none' };
    },
    getParticipantPendingInvitation(
      participantId: string
    ): WorkspaceInvitation | null {
      return (
        this.workspace.invitations.find(
          (invitation) =>
            invitation.status === 'pending' &&
            invitation.participantId === participantId.trim()
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
      emailValue: string
    ): Promise<WorkspaceInvitation | WorkspaceMember | null> {
      if (!roleCan(this.currentUserRole, 'inviteMembers')) {
        return null;
      }

      const normalizedParticipantId = participantId.trim();
      const email = normalizeEmail(emailValue);

      if (!normalizedParticipantId || !email) {
        return null;
      }

      this.errorMessage = '';

      const existingMember = this.workspace.members.find(
        (member) =>
          member.status === 'active' &&
          member.email &&
          normalizeEmail(member.email) === email
      );

      if (existingMember) {
        this.isSaving = true;

        try {
          await linkWorkspaceParticipantToMember(normalizedParticipantId, {
            email,
          });
          const [workspace, participants] = await Promise.all([
            getWorkspace(),
            listParticipants(),
          ]);
          this.applyWorkspace(workspace);
          useParticipantsStore().applyParticipants(
            participants.participants.map(fromParticipantDto)
          );
          return existingMember;
        } catch (error) {
          this.errorMessage = getErrorMessage(
            error,
            translate('workspace.saveInviteFailed')
          );
          return null;
        } finally {
          this.isSaving = false;
        }
      }

      this.isSaving = true;

      try {
        const invitationResponse = await createWorkspaceInvitation({
          participantId: normalizedParticipantId,
          email,
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
    async resendParticipantInvitation(participantId: string) {
      if (!roleCan(this.currentUserRole, 'inviteMembers')) {
        return false;
      }

      const invitation = this.getParticipantPendingInvitation(participantId);

      if (!invitation) {
        this.errorMessage = translate('workspace.invitationNoLongerPending');
        return false;
      }

      this.isSaving = true;
      this.errorMessage = '';

      try {
        const resentInvitation = normalizeInvitation(
          await resendWorkspaceInvitation(invitation.invitationId)
        );

        if (!resentInvitation) {
          this.errorMessage = translate('workspace.saveInviteFailed');
          return false;
        }

        const invitationIndex = this.workspace.invitations.findIndex(
          (candidate) =>
            candidate.invitationId === resentInvitation.invitationId
        );
        if (invitationIndex >= 0) {
          this.workspace.invitations[invitationIndex] = resentInvitation;
        }
        this.persist();
        return true;
      } catch (error) {
        this.errorMessage = getErrorMessage(
          error,
          translate('workspace.saveInviteFailed')
        );
        return false;
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
