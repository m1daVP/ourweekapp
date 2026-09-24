import type { UserRole } from '@/features/access/types';
import type {
  WorkspaceMemberStatus,
  WorkspacePermission,
} from '@/features/workspace/types';

const rolePermissions: Record<UserRole, WorkspacePermission[]> = {
  owner: [
    'manageWorkspace',
    'inviteMembers',
    'removeMembers',
    'manageSubscription',
    'createMeetings',
    'editMeetings',
    'deleteMeetings',
    'createTasks',
    'editTasks',
    'deleteTasks',
    'viewHistory',
    'viewSelectedSummariesAndTasks',
  ],
  adult_member: [
    'createMeetings',
    'editMeetings',
    'createTasks',
    'editTasks',
    'viewHistory',
    'viewSelectedSummariesAndTasks',
  ],
  viewer: ['viewSelectedSummariesAndTasks'],
};

export const workspaceRoleLabels: Record<UserRole, string> = {
  owner: 'Owner',
  adult_member: 'Adult member',
  viewer: 'Viewer',
};

export const workspaceStatusLabels: Record<WorkspaceMemberStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  removed: 'Removed',
};

export function roleCan(
  role: UserRole,
  permission: WorkspacePermission
): boolean {
  return rolePermissions[role].includes(permission);
}

export function getWorkspaceRolePermissions(role: UserRole) {
  return rolePermissions[role];
}
