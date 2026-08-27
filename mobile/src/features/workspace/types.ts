import type { UserRole } from '@/features/access/types';

export type WorkspaceMemberStatus = 'active' | 'invited' | 'removed';

export type WorkspaceInvitationStatus =
  'pending' | 'accepted' | 'revoked' | 'expired';

export type WorkspaceInvitationDeliveryStatus = 'pending' | 'sent' | 'failed';

export type ParticipantAccessStatus = 'none' | 'pending' | 'active';

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

export interface WorkspaceInvitation {
  invitationId: string;
  participantId: string;
  email: string;
  displayName?: string;
  role: Exclude<UserRole, 'owner'>;
  status: WorkspaceInvitationStatus;
  createdAt: string;
  expiresAt: string;
  deliveryStatus: WorkspaceInvitationDeliveryStatus;
}

export interface ParticipantAccessState {
  status: ParticipantAccessStatus;
  email?: string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
  createdAt: string;
  updatedAt: string;
}
