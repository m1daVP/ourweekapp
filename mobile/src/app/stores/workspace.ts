import { defineStore } from 'pinia';
import {
  readSettingsStorage,
  writeSettingsStorage,
} from '@/shared/services/storageService';
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

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
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
    id: createId('workspace'),
    name: 'Our weekly space',
    ownerId: LOCAL_OWNER_ID,
    members: [
      {
        userId: LOCAL_OWNER_ID,
        displayName: 'Me',
        role: 'owner',
        status: 'active',
      },
      {
        userId: 'local-adult-member',
        displayName: 'Partner',
        role: 'adult_member',
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
    userId: member.userId?.trim() || createId('member'),
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
  };
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
        userId: createId('member'),
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
          userId: createId('member'),
          displayName: role === 'adult_member' ? 'Adult member' : 'Viewer',
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
