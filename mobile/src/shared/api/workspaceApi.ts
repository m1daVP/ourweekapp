import type { UserRole } from '@/features/access/types';
import type {
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
} from '@/features/workspace/types';
import { apiRequest } from './httpClient';

export type WorkspaceDto = Workspace;
export type WorkspaceMemberDto = WorkspaceMember;

export interface UpdateWorkspaceRequestDto {
  name: string;
}

export interface CreateWorkspaceInvitationRequestDto {
  email: string;
  displayName?: string;
  role: Exclude<UserRole, 'owner'>;
}

export type WorkspaceInvitationDto = WorkspaceInvitation;

export interface UpdateWorkspaceMemberRequestDto {
  role?: Exclude<UserRole, 'owner'>;
  status?: 'removed';
}

export async function getWorkspace(): Promise<WorkspaceDto> {
  return apiRequest<WorkspaceDto>('/workspace', {
    requiresAuth: true,
  });
}

export async function updateWorkspace(
  payload: UpdateWorkspaceRequestDto
): Promise<WorkspaceDto> {
  return apiRequest<WorkspaceDto>('/workspace', {
    method: 'PUT',
    body: payload,
    requiresAuth: true,
  });
}

export async function createWorkspaceInvitation(
  payload: CreateWorkspaceInvitationRequestDto
): Promise<WorkspaceInvitationDto> {
  return apiRequest<WorkspaceInvitationDto>('/workspace/invitations', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
  });
}

export async function updateWorkspaceMember(
  userId: string,
  payload: UpdateWorkspaceMemberRequestDto
): Promise<WorkspaceMemberDto> {
  return apiRequest<WorkspaceMemberDto>(`/workspace/members/${userId}`, {
    method: 'PUT',
    body: payload,
    requiresAuth: true,
  });
}

export async function removeWorkspaceMember(userId: string): Promise<void> {
  await apiRequest<void>(`/workspace/members/${userId}`, {
    method: 'DELETE',
    requiresAuth: true,
  });
}

export async function revokeWorkspaceInvitation(
  invitationId: string
): Promise<void> {
  await apiRequest<void>(
    `/workspace/invitations/${encodeURIComponent(invitationId)}`,
    {
      method: 'DELETE',
      requiresAuth: true,
    }
  );
}
