import type { UserRole } from '@/features/access/types';

export type WorkspaceMemberStatus = 'active' | 'invited' | 'removed';

export type WorkspacePermission =
  | 'manageWorkspace'
  | 'inviteMembers'
  | 'removeMembers'
  | 'manageSubscription'
  | 'createMeetings'
  | 'editMeetings'
  | 'deleteMeetings'
  | 'createTasks'
  | 'editTasks'
  | 'deleteTasks'
  | 'viewHistory'
  | 'viewSelectedSummariesAndTasks';

export interface WorkspaceMember {
  userId: string;
  displayName: string;
  email?: string;
  role: UserRole;
  status: WorkspaceMemberStatus;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members: WorkspaceMember[];
  createdAt: string;
  updatedAt: string;
}
