import { defineStore } from 'pinia';
import { translate } from '@/features/localization/i18n';
import { appConfig } from '@/shared/config/env';
import {
  createWorkspaceInvitation,
  getWorkspace,
  removeWorkspaceMember as removeWorkspaceMemberRequest,
  updateWorkspace,
  updateWorkspaceMember,
} from '@/shared/api/workspaceApi';
import {
  readSettingsStorage,
  writeSettingsStorage,
} from '@/shared/services/storageService';
import { nowIso } from '@/shared/utils/dates';
import { createPrefixedId } from '@/shared/utils/ids';
import type { UserRole } from '@/features/access/types';
import type {
  Workspace,
  WorkspaceMember,
  WorkspaceMemberStatus,
} from '@/features/workspace/types';

const STORAGE_VERSION = 1;
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
  workspace?: Partial<Workspace> & {
    members?: Partial<WorkspaceMember>[];
  };
}

interface InviteMemberPayload {
  displayName: string;
  email?: string;
  role: Exclude<UserRole, 'owner'>;
}

function isBackendWorkspaceEnabled() {
  return appConfig.isBackendApiEnabled;
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
      if (!isBackendWorkspaceEnabled()) {
        return true;
      }

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

      if (!isBackendWorkspaceEnabled()) {
        return this.updateWorkspaceName(nextName);
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
    async inviteWorkspaceMember(payload: InviteMemberPayload) {
      const displayName = payload.displayName.trim();
      const email = payload.email?.trim();

      if (!displayName || !email) {
        return null;
      }

      if (!isBackendWorkspaceEnabled()) {
        return this.inviteMember(payload);
      }

      this.isSaving = true;
      this.errorMessage = '';

      try {
        const invitation = await createWorkspaceInvitation({
          displayName,
          email,
          role: payload.role,
        });

        const member: WorkspaceMember = {
          userId: invitation.invitationId,
          displayName: invitation.displayName?.trim() || displayName,
          email: invitation.email,
          role: invitation.role,
          status: 'invited',
        };

        this.applyMember(member);
        return member;
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
      if (!isBackendWorkspaceEnabled()) {
        return this.updateMemberRole(userId, role);
      }

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
      if (!isBackendWorkspaceEnabled()) {
        return this.removeMember(userId);
      }

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
    updateWorkspaceName(name: string) {
      const nextName = name.trim();

      if (!nextName) {
        return false;
      }

      this.workspace.name = nextName;
      this.workspace.updatedAt = nowIso();
      this.persist();
      return true;
    },
    inviteMember(payload: InviteMemberPayload) {
      const displayName = payload.displayName.trim();

      if (!displayName) {
        return null;
      }

      const member: WorkspaceMember = {
        userId: createPrefixedId('member'),
        displayName,
        email: payload.email?.trim() || undefined,
        role: payload.role,
        status: 'invited',
      };

      this.workspace.members.push(member);
      this.workspace.updatedAt = nowIso();
      this.persist();
      return member;
    },
    updateMemberRole(userId: string, role: UserRole) {
      const member = this.workspace.members.find(
        (item) => item.userId === userId
      );

      if (!member || member.userId === this.workspace.ownerId) {
        return false;
      }

      member.role = role === 'owner' ? 'adult_member' : role;
      this.workspace.updatedAt = nowIso();
      this.persist();
      return true;
    },
    removeMember(userId: string) {
      const member = this.workspace.members.find(
        (item) => item.userId === userId
      );

      if (!member || member.userId === this.workspace.ownerId) {
        return false;
      }

      member.status = 'removed';
      this.workspace.updatedAt = nowIso();

      if (this.currentUserId === userId) {
        this.currentUserId = this.workspace.ownerId;
      }

      this.persist();
      return true;
    },
    setCurrentUser(userId: string) {
      const member = this.workspace.members.find(
        (item) => item.userId === userId
      );

      if (!member || member.status === 'removed') {
        return false;
      }

      this.currentUserId = userId;
      this.persist();
      return true;
    },
    setCurrentMemberRole(role: UserRole) {
      const member = this.currentMember;

      if (!member) {
        return false;
      }

      if (role === 'owner') {
        this.currentUserId = this.workspace.ownerId;
        this.persist();
        return true;
      }

      if (member.userId === this.workspace.ownerId) {
        const existingMember = this.workspace.members.find(
          (item) => item.role === role && item.status !== 'removed'
        );

        if (existingMember) {
          this.currentUserId = existingMember.userId;
          this.persist();
          return true;
        }

        const createdAt = nowIso();
        this.workspace.members.push({
          userId: createPrefixedId('member'),
          displayName:
            role === 'adult_member'
              ? translate('settings.role.adultMember')
              : translate('settings.role.viewer'),
          role,
          status: 'active',
        });
        this.workspace.updatedAt = createdAt;
        this.currentUserId =
          this.workspace.members[this.workspace.members.length - 1].userId;
        this.persist();
        return true;
      }

      member.role = role;
      member.status = 'active';
      this.workspace.updatedAt = nowIso();
      this.persist();
      return true;
    },
  },
});
