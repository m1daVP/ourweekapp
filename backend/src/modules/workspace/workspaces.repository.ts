import type { UserRole } from '../../shared/auth/index.js';
import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { requireRow, throwOnSupabaseError } from '../../shared/repositories/index.js';

const WORKSPACE_COLUMNS = 'id,name,owner_id,created_at,updated_at' as const;
const MEMBER_COLUMNS =
  'workspace_id,user_id,display_name,email,role,status,created_at,updated_at' as const;

type WorkspaceRow = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

type WorkspaceMemberRow = {
  workspace_id: string;
  user_id: string;
  display_name: string;
  email: string | null;
  role: UserRole;
  status: 'active' | 'invited' | 'removed';
  created_at: string;
  updated_at: string;
};

export type WorkspaceDto = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMemberDto = {
  workspaceId: string;
  userId: string;
  displayName: string;
  email: string | null;
  role: UserRole;
  status: 'active' | 'invited' | 'removed';
  createdAt: string;
  updatedAt: string;
};

export type CreateWorkspaceInput = {
  name: string;
  ownerId: string;
};

export type CreateMembershipInput = {
  workspaceId: string;
  userId: string;
  displayName: string;
  email?: string | null;
  role: UserRole;
  status?: WorkspaceMemberDto['status'];
};

export type CreateWorkspaceWithOwnerInput = {
  workspaceName: string;
  ownerUserId: string;
  ownerDisplayName: string;
  ownerEmail?: string | null;
};

export function mapWorkspaceRowToDto(row: WorkspaceRow): WorkspaceDto {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWorkspaceMemberRowToDto(row: WorkspaceMemberRow): WorkspaceMemberDto {
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class WorkspacesRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async createWorkspace(input: CreateWorkspaceInput) {
    const { data, error } = await this.supabase
      .from('workspaces')
      .insert({ name: input.name, owner_id: input.ownerId })
      .select(WORKSPACE_COLUMNS)
      .single<WorkspaceRow>();

    return mapWorkspaceRowToDto(
      requireRow(data, error, 'workspace_create_failed', 'Unable to create the workspace.'),
    );
  }

  async createMembership(input: CreateMembershipInput) {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .insert({
        workspace_id: input.workspaceId,
        user_id: input.userId,
        display_name: input.displayName,
        email: input.email ?? null,
        role: input.role,
        status: input.status ?? 'active',
      })
      .select(MEMBER_COLUMNS)
      .single<WorkspaceMemberRow>();

    return mapWorkspaceMemberRowToDto(
      requireRow(data, error, 'membership_create_failed', 'Unable to create workspace membership.'),
    );
  }

  async createWorkspaceAndOwnerMembership(input: CreateWorkspaceWithOwnerInput) {
    const workspace = await this.createWorkspace({
      name: input.workspaceName,
      ownerId: input.ownerUserId,
    });
    const membership = await this.createMembership({
      workspaceId: workspace.id,
      userId: input.ownerUserId,
      displayName: input.ownerDisplayName,
      email: input.ownerEmail ?? null,
      role: 'owner',
      status: 'active',
    });

    return { workspace, membership };
  }

  async findWorkspaceById(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('workspaces')
      .select(WORKSPACE_COLUMNS)
      .eq('id', workspaceId)
      .is('deleted_at', null)
      .maybeSingle<WorkspaceRow>();

    throwOnSupabaseError(error, 'workspace_lookup_failed', 'Unable to load the workspace.');

    return data ? mapWorkspaceRowToDto(data) : null;
  }

  async updateWorkspaceName(workspaceId: string, name: string) {
    const { data, error } = await this.supabase
      .from('workspaces')
      .update({ name })
      .eq('id', workspaceId)
      .is('deleted_at', null)
      .select(WORKSPACE_COLUMNS)
      .single<WorkspaceRow>();

    return mapWorkspaceRowToDto(
      requireRow(data, error, 'workspace_update_failed', 'Unable to update the workspace.'),
    );
  }

  async findActiveMembership(workspaceId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .select(MEMBER_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle<WorkspaceMemberRow>();

    throwOnSupabaseError(error, 'membership_lookup_failed', 'Unable to load workspace membership.');

    return data ? mapWorkspaceMemberRowToDto(data) : null;
  }

  async listActiveMembershipsForUser(userId: string) {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .select(MEMBER_COLUMNS)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .returns<WorkspaceMemberRow[]>();

    throwOnSupabaseError(error, 'membership_list_failed', 'Unable to list workspace memberships.');

    return (data ?? []).map(mapWorkspaceMemberRowToDto);
  }

  async listActiveMembersForWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .select(MEMBER_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .returns<WorkspaceMemberRow[]>();

    throwOnSupabaseError(error, 'membership_list_failed', 'Unable to list workspace members.');

    return (data ?? []).map(mapWorkspaceMemberRowToDto);
  }

  async updateMemberRole(workspaceId: string, userId: string, role: UserRole) {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .update({ role })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .select(MEMBER_COLUMNS)
      .single<WorkspaceMemberRow>();

    return mapWorkspaceMemberRowToDto(
      requireRow(data, error, 'membership_update_failed', 'Unable to update workspace membership.'),
    );
  }

  async markMemberRemoved(workspaceId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .update({ status: 'removed' })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .select(MEMBER_COLUMNS)
      .single<WorkspaceMemberRow>();

    return mapWorkspaceMemberRowToDto(
      requireRow(data, error, 'membership_update_failed', 'Unable to update workspace membership.'),
    );
  }
}
