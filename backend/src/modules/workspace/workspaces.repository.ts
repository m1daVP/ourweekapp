import { ApiError } from '../../shared/errors/index.js';
import type { UserRole } from '../../shared/auth/index.js';
import { formatApiDateTime } from '../../shared/dates.js';
import type { SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { requireRow, throwOnSupabaseError } from '../../shared/repositories/index.js';

const WORKSPACE_COLUMNS = 'id,name,owner_id,created_at,updated_at' as const;
const MEMBER_COLUMNS =
  'workspace_id,user_id,display_name,email,role,status,created_at,updated_at' as const;
const INVITATION_COLUMNS =
  'id,workspace_id,participant_id,email,email_normalized,display_name,role,status,delivery_status,delivery_attempted_at,delivery_sent_at,created_at,expires_at' as const;

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

type WorkspaceInvitationRow = {
  id: string;
  workspace_id: string;
  participant_id: string;
  email: string;
  email_normalized: string;
  display_name: string | null;
  role: UserRole;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  delivery_status: 'pending' | 'sent' | 'failed';
  delivery_attempted_at: string | null;
  delivery_sent_at: string | null;
  created_at: string;
  expires_at: string;
};

type WorkspaceParticipantRow = {
  id: string;
  workspace_id: string;
  name: string;
  type: 'adult' | 'child' | 'other';
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
  status: WorkspaceMemberRow['status'];
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceInvitationDto = {
  id: string;
  workspaceId: string;
  participantId: string;
  email: string;
  emailNormalized: string;
  displayName: string | null;
  role: UserRole;
  status: WorkspaceInvitationRow['status'];
  deliveryStatus: WorkspaceInvitationRow['delivery_status'];
  createdAt: string;
  expiresAt: string;
};

export type WorkspaceInvitationParticipantDto = {
  id: string;
  workspaceId: string;
  name: string;
  type: WorkspaceParticipantRow['type'];
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

export type CreateWorkspaceInvitationInput = {
  workspaceId: string;
  participantId: string;
  email: string;
  emailNormalized: string;
  role: UserRole;
  tokenHash: string;
  expiresAt: string;
};

export type UpdateWorkspaceMembershipInput = {
  role?: UserRole;
  status?: 'removed';
};

export type UpdateInvitationDeliveryInput = {
  deliveryStatus: WorkspaceInvitationRow['delivery_status'];
  attemptedAt: string;
  sentAt?: string | null;
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
    createdAt: formatApiDateTime(row.created_at),
    updatedAt: formatApiDateTime(row.updated_at),
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
    createdAt: formatApiDateTime(row.created_at),
    updatedAt: formatApiDateTime(row.updated_at),
  };
}

export function mapWorkspaceInvitationRowToDto(row: WorkspaceInvitationRow): WorkspaceInvitationDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    participantId: row.participant_id,
    email: row.email,
    emailNormalized: row.email_normalized,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    deliveryStatus: row.delivery_status,
    createdAt: formatApiDateTime(row.created_at),
    expiresAt: formatApiDateTime(row.expires_at),
  };
}

function mapWorkspaceMemberRpcError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return;
  }

  if (error.message === 'workspace_last_owner') {
    throw new ApiError(
      409,
      'workspace_last_owner',
      'The last workspace owner cannot be removed or demoted.',
    );
  }

  if (error.message === 'workspace_member_status_transition_invalid') {
    throw new ApiError(
      422,
      'workspace_member_status_transition_invalid',
      'This workspace member status transition is not supported.',
    );
  }

  if (error.message === 'workspace_member_role_invalid') {
    throw new ApiError(
      422,
      'workspace_member_role_invalid',
      'This workspace member role is not supported.',
    );
  }
}

function mapInvitationRpcError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return;
  }

  const mappings: Record<string, { statusCode: number; code: string; message: string }> = {
    participant_not_found: {
      statusCode: 404,
      code: 'participant_not_found',
      message: 'Participant not found.',
    },
    participant_email_already_linked: {
      statusCode: 409,
      code: 'participant_email_already_linked',
      message: 'This email address is already linked to another active participant.',
    },
    workspace_member_already_linked: {
      statusCode: 409,
      code: 'workspace_member_already_linked',
      message: 'This workspace member is already linked to another participant.',
    },
    workspace_member_not_found: {
      statusCode: 404,
      code: 'workspace_member_not_found',
      message: 'No active workspace member exists for this email address.',
    },
    invitation_email_mismatch: {
      statusCode: 403,
      code: 'invitation_email_mismatch',
      message: 'Sign in with the email address that received this invitation.',
    },
    invitation_invalid_or_expired: {
      statusCode: 422,
      code: 'invitation_invalid_or_expired',
      message: 'This invitation is invalid or has expired.',
    },
    workspace_invitation_not_found: {
      statusCode: 404,
      code: 'workspace_invitation_not_found',
      message: 'Pending workspace invitation not found.',
    },
    invitation_not_found: {
      statusCode: 404,
      code: 'workspace_invitation_not_found',
      message: 'Pending workspace invitation not found.',
    },
    participant_email_required: {
      statusCode: 422,
      code: 'participant_email_required',
      message: 'A participant email address is required.',
    },
    participant_role_invalid: {
      statusCode: 422,
      code: 'participant_role_invalid',
      message: 'This participant type cannot receive the requested access role.',
    },
  };
  const mapped = error.message ? mappings[error.message] : undefined;

  if (mapped) {
    throw new ApiError(mapped.statusCode, mapped.code, mapped.message);
  }
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

  async findMembershipForWorkspace(workspaceId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .select(MEMBER_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle<WorkspaceMemberRow>();

    throwOnSupabaseError(error, 'membership_lookup_failed', 'Unable to load workspace membership.');

    return data ? mapWorkspaceMemberRowToDto(data) : null;
  }

  async findActiveMemberByEmailForWorkspace(workspaceId: string, email: string) {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .select(MEMBER_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('email', email)
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

  async listPendingInvitationsForWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('workspace_invitations')
      .select(INVITATION_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .returns<WorkspaceInvitationRow[]>();

    throwOnSupabaseError(
      error,
      'workspace_invitation_list_failed',
      'Unable to list workspace invitations.',
    );

    return (data ?? []).map(mapWorkspaceInvitationRowToDto);
  }

  async findActiveParticipantForWorkspace(workspaceId: string, participantId: string) {
    const { data, error } = await this.supabase
      .from('participants')
      .select('id,workspace_id,name,type')
      .eq('workspace_id', workspaceId)
      .eq('id', participantId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle<WorkspaceParticipantRow>();

    throwOnSupabaseError(error, 'participant_lookup_failed', 'Unable to load the participant.');

    return data
      ? {
        id: data.id,
        workspaceId: data.workspace_id,
        name: data.name,
        type: data.type,
      }
      : null;
  }

  async revokePendingInvitation(workspaceId: string, invitationId: string) {
    const { data, error } = await this.supabase
      .rpc('revoke_participant_invitation', {
        p_workspace_id: workspaceId,
        p_invitation_id: invitationId,
      })
      .returns<WorkspaceInvitationRow[]>();

    mapInvitationRpcError(error);
    throwOnSupabaseError(
      error,
      'workspace_invitation_revoke_failed',
      'Unable to revoke the workspace invitation.',
    );

    const row = (Array.isArray(data) ? data : [])[0];
    if (!row) {
      throw new ApiError(404, 'workspace_invitation_not_found', 'Pending workspace invitation not found.');
    }

    return mapWorkspaceInvitationRowToDto(row);
  }

  async listActiveOwnersForWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .select(MEMBER_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('role', 'owner')
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .returns<WorkspaceMemberRow[]>();

    throwOnSupabaseError(error, 'membership_list_failed', 'Unable to list workspace owners.');

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

  async updateActiveMemberAtomically(
    workspaceId: string,
    userId: string,
    input: UpdateWorkspaceMembershipInput,
  ) {
    const { data, error } = await this.supabase
      .rpc('workspace_update_active_member', {
        p_workspace_id: workspaceId,
        p_user_id: userId,
        p_role: input.role ?? null,
        p_status: input.status ?? null,
      })
      .returns<WorkspaceMemberRow[]>();

    mapWorkspaceMemberRpcError(error);
    throwOnSupabaseError(error, 'membership_update_failed', 'Unable to update workspace membership.');

    const rows = Array.isArray(data) ? data : [];
    const row = rows[0] ?? null;

    if (!row) {
      throw new ApiError(
        404,
        'workspace_member_not_found',
        'Active workspace member not found.',
      );
    }

    return mapWorkspaceMemberRowToDto(row);
  }

  async updateMembership(workspaceId: string, userId: string, input: UpdateWorkspaceMembershipInput) {
    const update: UpdateWorkspaceMembershipInput = {};

    if (input.role !== undefined) {
      update.role = input.role;
    }

    if (input.status !== undefined) {
      update.status = input.status;
    }

    const { data, error } = await this.supabase
      .from('workspace_members')
      .update(update)
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
      .eq('status', 'active')
      .select(MEMBER_COLUMNS)
      .single<WorkspaceMemberRow>();

    return mapWorkspaceMemberRowToDto(
      requireRow(data, error, 'membership_update_failed', 'Unable to update workspace membership.'),
    );
  }

  async createInvitation(input: CreateWorkspaceInvitationInput) {
    const { data, error } = await this.supabase
      .rpc('create_participant_invitation', {
        p_workspace_id: input.workspaceId,
        p_participant_id: input.participantId,
        p_email: input.email,
        p_email_normalized: input.emailNormalized,
        p_role: input.role,
        p_token_hash: input.tokenHash,
        p_expires_at: input.expiresAt,
      })
      .returns<WorkspaceInvitationRow[]>();

    mapInvitationRpcError(error);
    throwOnSupabaseError(
      error,
      'workspace_invitation_create_failed',
      'Unable to create the workspace invitation.',
    );

    const row = Array.isArray(data)
      ? data[0]
      : data as unknown as WorkspaceInvitationRow | null;
    if (!row) {
      throw new ApiError(
        500,
        'workspace_invitation_create_failed',
        'Unable to create the workspace invitation.',
      );
    }

    return mapWorkspaceInvitationRowToDto(row);
  }

  async linkExistingMemberToParticipant(
    workspaceId: string,
    participantId: string,
    email: string,
    emailNormalized: string,
  ) {
    const { data, error } = await this.supabase
      .rpc('link_existing_workspace_member_to_participant', {
        p_workspace_id: workspaceId,
        p_participant_id: participantId,
        p_email: email,
        p_email_normalized: emailNormalized,
      })
      .returns<WorkspaceMemberRow[]>();

    mapInvitationRpcError(error);
    throwOnSupabaseError(
      error,
      'workspace_member_link_failed',
      'Unable to link the workspace member to this participant.',
    );

    const row = (Array.isArray(data) ? data : [])[0];
    if (!row) {
      throw new ApiError(
        404,
        'workspace_member_not_found',
        'No active workspace member exists for this email address.',
      );
    }

    return mapWorkspaceMemberRowToDto(row);
  }

  async findPendingInvitation(workspaceId: string, invitationId: string) {
    const { data, error } = await this.supabase
      .from('workspace_invitations')
      .select(INVITATION_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('id', invitationId)
      .eq('status', 'pending')
      .maybeSingle<WorkspaceInvitationRow>();

    throwOnSupabaseError(
      error,
      'workspace_invitation_lookup_failed',
      'Unable to load the workspace invitation.',
    );

    return data ? mapWorkspaceInvitationRowToDto(data) : null;
  }

  async rotateInvitationToken(
    workspaceId: string,
    invitationId: string,
    tokenHash: string,
    expiresAt: string,
  ) {
    const { data, error } = await this.supabase
      .from('workspace_invitations')
      .update({
        token_hash: tokenHash,
        expires_at: expiresAt,
        delivery_status: 'pending',
        delivery_attempted_at: null,
        delivery_sent_at: null,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', invitationId)
      .eq('status', 'pending')
      .select(INVITATION_COLUMNS)
      .maybeSingle<WorkspaceInvitationRow>();

    throwOnSupabaseError(
      error,
      'workspace_invitation_resend_failed',
      'Unable to resend the workspace invitation.',
    );

    if (!data) {
      throw new ApiError(404, 'workspace_invitation_not_found', 'Pending workspace invitation not found.');
    }

    return mapWorkspaceInvitationRowToDto(data);
  }

  async updateInvitationDelivery(
    workspaceId: string,
    invitationId: string,
    input: UpdateInvitationDeliveryInput,
  ) {
    const { data, error } = await this.supabase
      .from('workspace_invitations')
      .update({
        delivery_status: input.deliveryStatus,
        delivery_attempted_at: input.attemptedAt,
        delivery_sent_at: input.sentAt ?? null,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', invitationId)
      .eq('status', 'pending')
      .select(INVITATION_COLUMNS)
      .maybeSingle<WorkspaceInvitationRow>();

    throwOnSupabaseError(
      error,
      'workspace_invitation_delivery_update_failed',
      'Unable to update invitation delivery status.',
    );

    if (!data) {
      throw new ApiError(404, 'workspace_invitation_not_found', 'Pending workspace invitation not found.');
    }

    return mapWorkspaceInvitationRowToDto(data);
  }
}
