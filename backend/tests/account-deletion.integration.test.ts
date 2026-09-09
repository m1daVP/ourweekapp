import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it } from 'vitest';

import { AccountRepository } from '../src/modules/account/account.repository.js';
import {
  cleanupDatabaseProofFixture,
  type DatabaseProofTracker,
} from './helpers/database-proof-fixtures.js';
import {
  createServiceRoleClient,
  databaseFixtureLabel,
  databaseEnvironment,
  requireDatabaseSuccess,
} from './helpers/database-test-environment.js';

type DeleteMode = 'member' | 'replacement-owner' | 'sole-owner';

type DeleteScenario = {
  tracker: DatabaseProofTracker;
  deletingUserId: string;
  workspaceIds: string[];
  replacementUserId?: string;
  activeSessionId: string;
  oldSessionId: string;
  oldRevokedAt: string;
  calendarConnectionId: string;
  retainedMeetingId: string;
};

async function createScenario(mode: DeleteMode): Promise<DeleteScenario> {
  const client = createServiceRoleClient(databaseEnvironment!);
  const deletingUserId = randomUUID();
  const activeSessionId = randomUUID();
  const oldSessionId = randomUUID();
  const oldRevokedAt = '2026-09-01T10:00:00.000Z';
  const workspaceIds = mode === 'member' ? [randomUUID(), randomUUID()] : [randomUUID()];
  const ownerIds = mode === 'member' ? [randomUUID(), randomUUID()] : [];
  const replacementUserId = mode === 'replacement-owner' ? randomUUID() : undefined;
  const userIds = [
    deletingUserId,
    ...ownerIds,
    ...(replacementUserId ? [replacementUserId] : []),
  ];
  const tracker: DatabaseProofTracker = {
    runId: randomUUID(),
    userIds,
    workspaceIds,
    authUserIds: [],
  };
  const emailFor = (id: string) => `${databaseFixtureLabel('delete-user', id)}@example.invalid`;

  requireDatabaseSuccess((await client.from('users').insert(userIds.map((id) => ({
    id,
    email: emailFor(id),
    email_normalized: emailFor(id),
    display_name: databaseFixtureLabel('delete-user'),
    password_hash: databaseFixtureLabel('password-hash'),
  })))).error, 'account deletion users creation');

  requireDatabaseSuccess((await client.from('workspaces').insert(
    workspaceIds.map((id, index) => ({
      id,
      name: databaseFixtureLabel(`delete-workspace-${index}`),
      owner_id: mode === 'member' ? ownerIds[index] : deletingUserId,
    })),
  )).error, 'account deletion workspaces creation');

  const memberships = workspaceIds.flatMap((workspaceId, index) => {
    const rows = [{
      workspace_id: workspaceId,
      user_id: deletingUserId,
      display_name: databaseFixtureLabel('deleting-member'),
      email: emailFor(deletingUserId),
      role: mode === 'member' ? 'adult_member' : 'owner',
      status: 'active',
      created_at: '2026-09-01T08:00:00.000Z',
    }];
    if (mode === 'member') {
      rows.push({
        workspace_id: workspaceId,
        user_id: ownerIds[index],
        display_name: databaseFixtureLabel('owner'),
        email: emailFor(ownerIds[index]),
        role: 'owner',
        status: 'active',
        created_at: '2026-09-01T07:00:00.000Z',
      });
    }
    if (replacementUserId) {
      rows.push({
        workspace_id: workspaceId,
        user_id: replacementUserId,
        display_name: databaseFixtureLabel('replacement'),
        email: emailFor(replacementUserId),
        role: 'adult_member',
        status: 'active',
        created_at: '2026-09-01T07:00:00.000Z',
      });
    }
    return rows;
  });
  requireDatabaseSuccess((await client.from('workspace_members').insert(memberships)).error,
    'account deletion memberships creation');

  requireDatabaseSuccess((await client.from('sessions').insert([
    {
      id: activeSessionId,
      user_id: deletingUserId,
      refresh_token_hash: databaseFixtureLabel('active-session'),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
    {
      id: oldSessionId,
      user_id: deletingUserId,
      refresh_token_hash: databaseFixtureLabel('old-session'),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      revoked_at: oldRevokedAt,
    },
  ])).error, 'account deletion sessions creation');

  const calendarConnectionId = randomUUID();
  requireDatabaseSuccess((await client.from('calendar_connections').insert({
    id: calendarConnectionId,
    workspace_id: workspaceIds[0],
    user_id: deletingUserId,
    provider: 'google',
    connected_account_email: emailFor(deletingUserId),
    access_token_encrypted: databaseFixtureLabel('access-token'),
    refresh_token_encrypted: databaseFixtureLabel('refresh-token'),
    token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    state: 'connected',
  })).error, 'account deletion calendar creation');

  const retainedMeetingId = randomUUID();
  requireDatabaseSuccess((await client.from('meetings').insert({
    id: retainedMeetingId,
    workspace_id: workspaceIds[0],
    template_id: 'weekly-family-check-in',
    title: databaseFixtureLabel('retained-meeting'),
    status: 'completed',
    participant_ids: [],
    check_in_completed: true,
    sections: [],
    current_section_index: 0,
    completed_at: new Date().toISOString(),
  })).error, 'account deletion retained meeting creation');

  return {
    tracker,
    deletingUserId,
    workspaceIds,
    ...(replacementUserId ? { replacementUserId } : {}),
    activeSessionId,
    oldSessionId,
    oldRevokedAt,
    calendarConnectionId,
    retainedMeetingId,
  };
}

const describeConfigured = databaseEnvironment ? describe : describe.skip;

describeConfigured('account deletion database behavior', () => {
  let tracker: DatabaseProofTracker | null = null;

  afterEach(async () => {
    if (tracker) {
      await cleanupDatabaseProofFixture(databaseEnvironment!, tracker);
      tracker = null;
    }
  });

  async function deleteTwiceAndRead(scenario: DeleteScenario) {
    const client = createServiceRoleClient(databaseEnvironment!);
    const repository = new AccountRepository(client);
    const deletedAt = '2026-09-09T10:00:00.000Z';
    await repository.deleteAccountAtomically(scenario.deletingUserId, deletedAt);
    const first = await Promise.all([
      client.from('users').select('deleted_at').eq('id', scenario.deletingUserId).single(),
      client.from('sessions').select('id,revoked_at').eq('user_id', scenario.deletingUserId),
      client.from('calendar_connections')
        .select('access_token_encrypted,refresh_token_encrypted,token_expires_at,state,disconnected_at')
        .eq('id', scenario.calendarConnectionId)
        .single(),
      client.from('workspaces').select('id,owner_id,deleted_at').in('id', scenario.workspaceIds),
      client.from('workspace_members')
        .select('workspace_id,user_id,role,status')
        .in('workspace_id', scenario.workspaceIds),
    ]);
    await repository.deleteAccountAtomically(
      scenario.deletingUserId,
      '2026-09-09T11:00:00.000Z',
    );
    const second = await Promise.all([
      client.from('users').select('deleted_at').eq('id', scenario.deletingUserId).single(),
      client.from('sessions').select('id,revoked_at').eq('user_id', scenario.deletingUserId),
      client.from('calendar_connections').select('disconnected_at').eq('id', scenario.calendarConnectionId).single(),
      client.from('workspaces').select('id,owner_id,deleted_at').in('id', scenario.workspaceIds),
      client.from('workspace_members')
        .select('workspace_id,user_id,role,status')
        .in('workspace_id', scenario.workspaceIds),
    ]);
    return { deletedAt, first, second };
  }

  it('removes an ordinary member while preserving both workspaces', async () => {
    const scenario = await createScenario('member');
    tracker = scenario.tracker;
    const { deletedAt, first, second } = await deleteTwiceAndRead(scenario);

    expect(Date.parse(first[0].data?.deleted_at ?? '')).toBe(Date.parse(deletedAt));
    expect(Date.parse(
      first[1].data?.find((row) => row.id === scenario.activeSessionId)?.revoked_at ?? '',
    )).toBe(Date.parse(deletedAt));
    expect(Date.parse(first[1].data?.find((row) => row.id === scenario.oldSessionId)?.revoked_at ?? ''))
      .toBe(Date.parse(scenario.oldRevokedAt));
    expect(first[2].data).toMatchObject({
      access_token_encrypted: null,
      refresh_token_encrypted: null,
      token_expires_at: null,
      state: 'disconnected',
    });
    expect(Date.parse(first[2].data?.disconnected_at ?? '')).toBe(Date.parse(deletedAt));
    expect(first[3].data?.every((workspace) => workspace.deleted_at === null)).toBe(true);
    expect(first[4].data?.filter((member) => member.user_id === scenario.deletingUserId)
      .every((member) => member.status === 'removed')).toBe(true);
    expect(second[0].data?.deleted_at).toBe(first[0].data?.deleted_at);
    expect(second[1].data).toEqual(first[1].data);
    expect(second[2].data?.disconnected_at).toBe(first[2].data?.disconnected_at);
    expect(second[3].data).toEqual(first[3].data);
    expect(second[4].data).toEqual(first[4].data);
  });

  it('transfers an owned workspace to the eligible replacement', async () => {
    const scenario = await createScenario('replacement-owner');
    tracker = scenario.tracker;
    const { first, second } = await deleteTwiceAndRead(scenario);

    expect(first[3].data?.[0]).toMatchObject({
      owner_id: scenario.replacementUserId,
      deleted_at: null,
    });
    expect(first[4].data?.find((member) => member.user_id === scenario.replacementUserId))
      .toMatchObject({ role: 'owner', status: 'active' });
    expect(first[4].data?.find((member) => member.user_id === scenario.deletingUserId))
      .toMatchObject({ status: 'removed' });
    expect(second[3].data).toEqual(first[3].data);
    expect(second[4].data).toEqual(first[4].data);
  });

  it('soft-deletes a sole-owner workspace while retaining its child rows', async () => {
    const scenario = await createScenario('sole-owner');
    tracker = scenario.tracker;
    const { deletedAt, first, second } = await deleteTwiceAndRead(scenario);
    const client = createServiceRoleClient(databaseEnvironment!);
    const meeting = await client.from('meetings')
      .select('id,workspace_id')
      .eq('id', scenario.retainedMeetingId)
      .single();

    expect(first[3].data?.[0]?.owner_id).toBe(scenario.deletingUserId);
    expect(Date.parse(first[3].data?.[0]?.deleted_at ?? '')).toBe(Date.parse(deletedAt));
    expect(first[4].data?.find((member) => member.user_id === scenario.deletingUserId))
      .toMatchObject({ status: 'removed' });
    expect(meeting.data).toEqual({
      id: scenario.retainedMeetingId,
      workspace_id: scenario.workspaceIds[0],
    });
    expect(second[3].data).toEqual(first[3].data);
    expect(second[4].data).toEqual(first[4].data);
  });
});
