import { randomUUID } from 'node:crypto';

import type { DatabaseTestEnvironment } from './database-test-environment.js';
import {
  createServiceRoleClient,
  databaseFixtureLabel,
  requireDatabaseSuccess,
} from './database-test-environment.js';

export type ProofUser = {
  id: string;
  email: string;
  sessionId: string;
};

export type ProofWorkspace = {
  id: string;
  participantId: string;
  meetingId: string;
  taskId: string;
  agreementId: string;
  invitationId: string;
  calendarConnectionId: string;
};

export type DatabaseProofTracker = {
  runId: string;
  userIds: string[];
  workspaceIds: string[];
  authUserIds: string[];
};

export type DatabaseProofFixture = DatabaseProofTracker & {
  userA: ProofUser;
  userB: ProofUser;
  replacementUser?: ProofUser;
  workspaceA: ProofWorkspace;
  workspaceB: ProofWorkspace;
};

export type DatabaseProofFixtureOptions = {
  workspaceAReplacementOwner?: boolean;
  failAfter?: 'workspaceA';
  onProgress?: (tracker: DatabaseProofTracker) => void;
};

function snapshot(tracker: DatabaseProofTracker): DatabaseProofTracker {
  return {
    runId: tracker.runId,
    userIds: [...tracker.userIds],
    workspaceIds: [...tracker.workspaceIds],
    authUserIds: [...tracker.authUserIds],
  };
}

function notify(
  tracker: DatabaseProofTracker,
  onProgress: DatabaseProofFixtureOptions['onProgress'],
) {
  onProgress?.(snapshot(tracker));
}

async function createApplicationUser(
  environment: DatabaseTestEnvironment,
  tracker: DatabaseProofTracker,
  label: string,
): Promise<ProofUser> {
  const client = createServiceRoleClient(environment);
  const id = randomUUID();
  const sessionId = randomUUID();
  const email = `${databaseFixtureLabel(label, id)}@example.invalid`;
  tracker.userIds.push(id);
  requireDatabaseSuccess((await client.from('users').insert({
    id,
    email,
    email_normalized: email,
    display_name: databaseFixtureLabel(label),
    password_hash: databaseFixtureLabel('password-hash'),
  })).error, `${label} user creation`);
  requireDatabaseSuccess((await client.from('sessions').insert({
    id: sessionId,
    user_id: id,
    refresh_token_hash: databaseFixtureLabel('refresh-hash'),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  })).error, `${label} session creation`);
  return { id, email, sessionId };
}

async function createWorkspaceRows(
  environment: DatabaseTestEnvironment,
  tracker: DatabaseProofTracker,
  owner: ProofUser,
  label: string,
): Promise<ProofWorkspace> {
  const client = createServiceRoleClient(environment);
  const workspaceId = randomUUID();
  const participantId = randomUUID();
  const meetingId = randomUUID();
  const taskId = randomUUID();
  const agreementId = randomUUID();
  const invitationId = randomUUID();
  const calendarConnectionId = randomUUID();
  const invitationEmail = `${databaseFixtureLabel(`${label}-invite`)}@example.invalid`;
  tracker.workspaceIds.push(workspaceId);

  requireDatabaseSuccess((await client.from('workspaces').insert({
    id: workspaceId,
    name: databaseFixtureLabel(`${label}-workspace`),
    owner_id: owner.id,
  })).error, `${label} workspace creation`);
  requireDatabaseSuccess((await client.from('workspace_members').insert({
    workspace_id: workspaceId,
    user_id: owner.id,
    display_name: databaseFixtureLabel(`${label}-owner`),
    email: owner.email,
    role: 'owner',
    status: 'active',
  })).error, `${label} owner membership creation`);
  requireDatabaseSuccess((await client.from('participants').insert({
    id: participantId,
    workspace_id: workspaceId,
    name: databaseFixtureLabel(`${label}-participant`),
    initials: label.toUpperCase().slice(0, 2),
    avatar_color: '#334455',
    avatar_type: 'adult',
    type: 'adult',
    is_active: true,
  })).error, `${label} participant creation`);
  requireDatabaseSuccess((await client.from('meetings').insert({
    id: meetingId,
    workspace_id: workspaceId,
    template_id: 'weekly-family-check-in',
    title: databaseFixtureLabel(`${label}-meeting`),
    status: 'completed',
    participant_ids: [participantId],
    check_in_completed: true,
    sections: [],
    current_section_index: 0,
    completed_at: new Date().toISOString(),
  })).error, `${label} meeting creation`);
  requireDatabaseSuccess((await client.from('tasks').insert({
    id: taskId,
    workspace_id: workspaceId,
    title: databaseFixtureLabel(`${label}-task`),
    description: 'Database proof fixture',
    responsibility_type: 'participant',
    responsible_participant_ids: [participantId],
    responsible_user_ids: [owner.id],
    status: 'open',
    source_meeting_id: meetingId,
  })).error, `${label} task creation`);
  requireDatabaseSuccess((await client.from('agreements').insert({
    id: agreementId,
    workspace_id: workspaceId,
    title: databaseFixtureLabel(`${label}-agreement`),
    description: 'Database proof fixture',
    participant_ids: [participantId],
    related_task_ids: [taskId],
    source_meeting_id: meetingId,
  })).error, `${label} agreement creation`);
  requireDatabaseSuccess((await client.from('workspace_invitations').insert({
    id: invitationId,
    workspace_id: workspaceId,
    participant_id: participantId,
    email: invitationEmail,
    email_normalized: invitationEmail,
    display_name: databaseFixtureLabel(`${label}-invitee`),
    role: 'adult_member',
    token_hash: databaseFixtureLabel('invitation-hash'),
    status: 'pending',
    delivery_status: 'pending',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })).error, `${label} invitation creation`);
  requireDatabaseSuccess((await client.from('calendar_connections').insert({
    id: calendarConnectionId,
    workspace_id: workspaceId,
    user_id: owner.id,
    provider: 'google',
    connected_account_email: owner.email,
    access_token_encrypted: databaseFixtureLabel('access'),
    refresh_token_encrypted: databaseFixtureLabel('refresh'),
    token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    state: 'connected',
  })).error, `${label} calendar connection creation`);

  return {
    id: workspaceId,
    participantId,
    meetingId,
    taskId,
    agreementId,
    invitationId,
    calendarConnectionId,
  };
}

export async function createDatabaseProofFixture(
  environment: DatabaseTestEnvironment,
  options: DatabaseProofFixtureOptions = {},
): Promise<DatabaseProofFixture> {
  const tracker: DatabaseProofTracker = {
    runId: randomUUID(),
    userIds: [],
    workspaceIds: [],
    authUserIds: [],
  };
  notify(tracker, options.onProgress);

  const userA = await createApplicationUser(environment, tracker, 'user-a');
  notify(tracker, options.onProgress);
  const userB = await createApplicationUser(environment, tracker, 'user-b');
  notify(tracker, options.onProgress);
  const workspaceA = await createWorkspaceRows(environment, tracker, userA, 'a');
  notify(tracker, options.onProgress);

  if (options.failAfter === 'workspaceA') {
    throw new Error('Database proof fixture requested failure after workspace A.');
  }

  const workspaceB = await createWorkspaceRows(environment, tracker, userB, 'b');
  notify(tracker, options.onProgress);

  let replacementUser: ProofUser | undefined;
  if (options.workspaceAReplacementOwner) {
    replacementUser = await createApplicationUser(environment, tracker, 'replacement');
    requireDatabaseSuccess((await createServiceRoleClient(environment)
      .from('workspace_members')
      .insert({
        workspace_id: workspaceA.id,
        user_id: replacementUser.id,
        display_name: databaseFixtureLabel('replacement-member'),
        email: replacementUser.email,
        role: 'adult_member',
        status: 'active',
      })).error, 'replacement membership creation');
    notify(tracker, options.onProgress);
  }

  return {
    ...tracker,
    userA,
    userB,
    ...(replacementUser ? { replacementUser } : {}),
    workspaceA,
    workspaceB,
  };
}

export async function cleanupDatabaseProofFixture(
  environment: DatabaseTestEnvironment,
  fixture: DatabaseProofTracker,
): Promise<void> {
  const client = createServiceRoleClient(environment);
  const failures: string[] = [];
  const remove = async (
    table: string,
    column: string,
    values: string[],
  ) => {
    if (values.length === 0) return;
    const { error } = await client.from(table).delete().in(column, values);
    if (error) failures.push(`${table} cleanup`);
  };

  await remove('task_review_decisions', 'workspace_id', fixture.workspaceIds);
  await remove('agreements', 'workspace_id', fixture.workspaceIds);
  await remove('tasks', 'workspace_id', fixture.workspaceIds);
  await remove('assistant_follow_ups', 'workspace_id', fixture.workspaceIds);
  await remove('assistant_recap_credit_reservations', 'workspace_id', fixture.workspaceIds);
  await remove('assistant_settings', 'workspace_id', fixture.workspaceIds);
  await remove('calendar_preferences', 'workspace_id', fixture.workspaceIds);
  await remove('calendar_events', 'workspace_id', fixture.workspaceIds);
  await remove('calendar_connections', 'workspace_id', fixture.workspaceIds);
  await remove('ai_summary_requests', 'workspace_id', fixture.workspaceIds);
  await remove('workspace_invitations', 'workspace_id', fixture.workspaceIds);
  await remove('meetings', 'workspace_id', fixture.workspaceIds);
  await remove('participants', 'workspace_id', fixture.workspaceIds);
  await remove('subscriptions', 'workspace_id', fixture.workspaceIds);
  await remove('workspace_members', 'workspace_id', fixture.workspaceIds);
  await remove('workspaces', 'id', fixture.workspaceIds);
  await remove('auth_identities', 'user_id', fixture.userIds);
  await remove('password_reset_tokens', 'user_id', fixture.userIds);
  await remove('sessions', 'user_id', fixture.userIds);
  await remove('users', 'id', fixture.userIds);

  for (const authUserId of fixture.authUserIds) {
    const result = await client.auth.admin.deleteUser(authUserId);
    if (result.error && !result.error.message.toLowerCase().includes('not found')) {
      failures.push('temporary Auth user cleanup');
    }
  }

  if (failures.length > 0) {
    throw new Error(`Database proof cleanup failed: ${failures.join(', ')}.`);
  }
}

