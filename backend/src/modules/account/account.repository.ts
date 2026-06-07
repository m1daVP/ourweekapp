import type { PlanType, UserRole } from '../../shared/auth/index.js';
import type { JsonValue, SupabaseRepositoryClient } from '../../shared/repositories/index.js';
import { throwOnSupabaseError } from '../../shared/repositories/index.js';

const USER_COLUMNS = 'id,email,display_name,created_at,updated_at' as const;
const WORKSPACE_COLUMNS = 'id,name,owner_id,created_at,updated_at' as const;
const MEMBER_COLUMNS =
  'workspace_id,user_id,display_name,email,role,status,created_at,updated_at' as const;
const PARTICIPANT_COLUMNS =
  'id,workspace_id,name,initials,avatar_color,type,is_active,server_revision,created_at,updated_at,deleted_at' as const;
const MEETING_COLUMNS =
  'id,workspace_id,template_id,title,status,participant_ids,sections,current_section_index,ai_summary,server_revision,created_at,updated_at,completed_at,deleted_at' as const;
const TASK_COLUMNS =
  'id,workspace_id,title,description,responsibility_type,responsible_participant_ids,due_date,status,source_meeting_id,server_revision,created_at,updated_at,deleted_at' as const;
const AGREEMENT_COLUMNS =
  'id,workspace_id,title,description,participant_ids,related_task_ids,source_meeting_id,server_revision,created_at,updated_at,deleted_at' as const;
const REVIEW_DECISION_COLUMNS = 'workspace_id,meeting_id,source_meeting_id,decided_at' as const;
const SUBSCRIPTION_COLUMNS =
  'id,workspace_id,provider,plan_type,status,expires_at,last_checked_at,created_at,updated_at' as const;
const CALENDAR_CONNECTION_COLUMNS =
  'id,workspace_id,user_id,provider,connected_account_email,token_expires_at,state,created_at,updated_at,disconnected_at' as const;

type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};

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

type ParticipantRow = {
  id: string;
  workspace_id: string;
  name: string;
  initials: string;
  avatar_color: string;
  type: 'adult' | 'child' | 'other';
  is_active: boolean;
  server_revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type MeetingRow = {
  id: string;
  workspace_id: string;
  template_id: string;
  title: string;
  status: 'draft' | 'in_progress' | 'paused' | 'incomplete' | 'completed';
  participant_ids: JsonValue;
  sections: JsonValue;
  current_section_index: number;
  ai_summary: JsonValue | null;
  server_revision: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
};

type TaskRow = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  responsibility_type: 'participant' | 'shared' | 'needsDiscussion';
  responsible_participant_ids: JsonValue;
  due_date: string | null;
  status: 'open' | 'done' | 'skipped';
  source_meeting_id: string | null;
  server_revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type AgreementRow = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  participant_ids: JsonValue;
  related_task_ids: JsonValue | null;
  source_meeting_id: string;
  server_revision: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type TaskReviewDecisionRow = {
  workspace_id: string;
  meeting_id: string;
  source_meeting_id: string;
  decided_at: string;
};

type SubscriptionRow = {
  id: string;
  workspace_id: string;
  provider: 'google_play' | 'app_store' | 'revenuecat';
  plan_type: PlanType;
  status: string;
  expires_at: string | null;
  last_checked_at: string;
  created_at: string;
  updated_at: string;
};

type CalendarConnectionRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  provider: 'google';
  connected_account_email: string | null;
  token_expires_at: string | null;
  state: 'disconnected' | 'connected' | 'setup_required';
  created_at: string;
  updated_at: string;
  disconnected_at: string | null;
};

export type AccountUserRecord = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountWorkspaceRecord = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type AccountWorkspaceMemberRecord = {
  workspaceId: string;
  userId: string;
  displayName: string;
  email: string | null;
  role: UserRole;
  status: WorkspaceMemberRow['status'];
  createdAt: string;
  updatedAt: string;
};

export type AccountParticipantRecord = {
  id: string;
  workspaceId: string;
  name: string;
  initials: string;
  avatarColor: string;
  type: ParticipantRow['type'];
  isActive: boolean;
  serverRevision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AccountMeetingRecord = {
  id: string;
  workspaceId: string;
  templateId: string;
  title: string;
  status: MeetingRow['status'];
  participantIds: string[];
  sections: JsonValue[];
  currentSectionIndex: number;
  aiSummary: JsonValue | null;
  serverRevision: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
};

export type AccountTaskRecord = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  responsibilityType: TaskRow['responsibility_type'];
  responsibleParticipantIds: string[];
  dueDate: string | null;
  status: TaskRow['status'];
  sourceMeetingId: string | null;
  serverRevision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AccountAgreementRecord = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  participantIds: string[];
  relatedTaskIds: string[];
  sourceMeetingId: string;
  serverRevision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AccountTaskReviewDecisionRecord = {
  workspaceId: string;
  meetingId: string;
  sourceMeetingId: string;
  decidedAt: string;
};

export type AccountSubscriptionRecord = {
  id: string;
  workspaceId: string;
  provider: SubscriptionRow['provider'];
  planType: PlanType;
  status: string;
  expiresAt: string | null;
  lastCheckedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AccountCalendarConnectionRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  provider: 'google';
  connectedAccountEmail: string | null;
  tokenExpiresAt: string | null;
  state: CalendarConnectionRow['state'];
  createdAt: string;
  updatedAt: string;
  disconnectedAt: string | null;
};

function stringArrayFromJson(value: JsonValue | null): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function jsonArrayFromJson(value: JsonValue): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function mapUser(row: UserRow): AccountUserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWorkspace(row: WorkspaceRow): AccountWorkspaceRecord {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMember(row: WorkspaceMemberRow): AccountWorkspaceMemberRecord {
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

function mapParticipant(row: ParticipantRow): AccountParticipantRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    initials: row.initials,
    avatarColor: row.avatar_color,
    type: row.type,
    isActive: row.is_active,
    serverRevision: row.server_revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapMeeting(row: MeetingRow): AccountMeetingRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    templateId: row.template_id,
    title: row.title,
    status: row.status,
    participantIds: stringArrayFromJson(row.participant_ids),
    sections: jsonArrayFromJson(row.sections),
    currentSectionIndex: row.current_section_index,
    aiSummary: row.ai_summary,
    serverRevision: row.server_revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    deletedAt: row.deleted_at,
  };
}

function mapTask(row: TaskRow): AccountTaskRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    responsibilityType: row.responsibility_type,
    responsibleParticipantIds: stringArrayFromJson(row.responsible_participant_ids),
    dueDate: row.due_date,
    status: row.status,
    sourceMeetingId: row.source_meeting_id,
    serverRevision: row.server_revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapAgreement(row: AgreementRow): AccountAgreementRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    participantIds: stringArrayFromJson(row.participant_ids),
    relatedTaskIds: stringArrayFromJson(row.related_task_ids),
    sourceMeetingId: row.source_meeting_id,
    serverRevision: row.server_revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapReviewDecision(row: TaskReviewDecisionRow): AccountTaskReviewDecisionRecord {
  return {
    workspaceId: row.workspace_id,
    meetingId: row.meeting_id,
    sourceMeetingId: row.source_meeting_id,
    decidedAt: row.decided_at,
  };
}

function mapSubscription(row: SubscriptionRow): AccountSubscriptionRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    provider: row.provider,
    planType: row.plan_type,
    status: row.status,
    expiresAt: row.expires_at,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCalendarConnection(row: CalendarConnectionRow): AccountCalendarConnectionRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    provider: row.provider,
    connectedAccountEmail: row.connected_account_email,
    tokenExpiresAt: row.token_expires_at,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    disconnectedAt: row.disconnected_at,
  };
}

export class AccountRepository {
  constructor(private readonly supabase: SupabaseRepositoryClient) {}

  async findActiveUser(userId: string) {
    const { data, error } = await this.supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle<UserRow>();

    throwOnSupabaseError(error, 'account_user_lookup_failed', 'Unable to load account user.');

    return data ? mapUser(data) : null;
  }

  async listActiveMembershipsForUser(userId: string) {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .select(MEMBER_COLUMNS)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .returns<WorkspaceMemberRow[]>();

    throwOnSupabaseError(error, 'account_membership_list_failed', 'Unable to list account memberships.');

    return (data ?? []).map(mapMember);
  }

  async findWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('workspaces')
      .select(WORKSPACE_COLUMNS)
      .eq('id', workspaceId)
      .is('deleted_at', null)
      .maybeSingle<WorkspaceRow>();

    throwOnSupabaseError(error, 'account_workspace_lookup_failed', 'Unable to load account workspace.');

    return data ? mapWorkspace(data) : null;
  }

  async listMembersForWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('workspace_members')
      .select(MEMBER_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .returns<WorkspaceMemberRow[]>();

    throwOnSupabaseError(error, 'account_member_list_failed', 'Unable to list account workspace members.');

    return (data ?? []).map(mapMember);
  }

  async listParticipantsForWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('participants')
      .select(PARTICIPANT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .returns<ParticipantRow[]>();

    throwOnSupabaseError(error, 'account_participant_list_failed', 'Unable to list account participants.');

    return (data ?? []).map(mapParticipant);
  }

  async listMeetingsForWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('meetings')
      .select(MEETING_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .returns<MeetingRow[]>();

    throwOnSupabaseError(error, 'account_meeting_list_failed', 'Unable to list account meetings.');

    return (data ?? []).map(mapMeeting);
  }

  async listTasksForWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('tasks')
      .select(TASK_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .returns<TaskRow[]>();

    throwOnSupabaseError(error, 'account_task_list_failed', 'Unable to list account tasks.');

    return (data ?? []).map(mapTask);
  }

  async listAgreementsForWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('agreements')
      .select(AGREEMENT_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .returns<AgreementRow[]>();

    throwOnSupabaseError(error, 'account_agreement_list_failed', 'Unable to list account agreements.');

    return (data ?? []).map(mapAgreement);
  }

  async listReviewDecisionsForWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('task_review_decisions')
      .select(REVIEW_DECISION_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('decided_at', { ascending: false })
      .returns<TaskReviewDecisionRow[]>();

    throwOnSupabaseError(error, 'account_review_decision_list_failed', 'Unable to list account review decisions.');

    return (data ?? []).map(mapReviewDecision);
  }

  async findLatestSubscriptionForWorkspace(workspaceId: string) {
    const { data, error } = await this.supabase
      .from('subscriptions')
      .select(SUBSCRIPTION_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('last_checked_at', { ascending: false })
      .limit(1)
      .maybeSingle<SubscriptionRow>();

    throwOnSupabaseError(error, 'account_subscription_lookup_failed', 'Unable to load account subscription.');

    return data ? mapSubscription(data) : null;
  }

  async listCalendarConnectionsForWorkspaceUser(workspaceId: string, userId: string) {
    const { data, error } = await this.supabase
      .from('calendar_connections')
      .select(CALENDAR_CONNECTION_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .returns<CalendarConnectionRow[]>();

    throwOnSupabaseError(error, 'account_calendar_connection_list_failed', 'Unable to list account calendar connections.');

    return (data ?? []).map(mapCalendarConnection);
  }

  async deleteAccountAtomically(userId: string, deletedAt: string) {
    const { error } = await this.supabase.rpc('account_delete', {
      p_user_id: userId,
      p_deleted_at: deletedAt,
    });

    throwOnSupabaseError(error, 'account_delete_failed', 'Unable to delete account.');
  }
}
