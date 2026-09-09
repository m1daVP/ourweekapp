import { afterEach, describe, expect, it } from 'vitest';

import {
  cleanupDatabaseProofFixture,
  createDatabaseProofFixture,
  type DatabaseProofTracker,
} from './helpers/database-proof-fixtures.js';
import {
  createServiceRoleClient,
  databaseEnvironment,
} from './helpers/database-test-environment.js';

const describeConfigured = databaseEnvironment ? describe : describe.skip;

describeConfigured('database proof fixture lifecycle', () => {
  let tracker: DatabaseProofTracker | null = null;

  afterEach(async () => {
    if (tracker) {
      await cleanupDatabaseProofFixture(databaseEnvironment!, tracker);
      tracker = null;
    }
  });

  it('creates isolated workspace graphs and cleans them idempotently', async () => {
    const fixture = await createDatabaseProofFixture(databaseEnvironment!, {
      workspaceAReplacementOwner: true,
      onProgress: (next) => { tracker = next; },
    });
    expect(fixture.workspaceA.id).not.toBe(fixture.workspaceB.id);

    const client = createServiceRoleClient(databaseEnvironment!);
    const workspaces = await client
      .from('workspaces')
      .select('id')
      .in('id', fixture.workspaceIds);
    expect(workspaces.error).toBeNull();
    expect(workspaces.data).toHaveLength(2);

    await cleanupDatabaseProofFixture(databaseEnvironment!, fixture);
    await cleanupDatabaseProofFixture(databaseEnvironment!, fixture);
    tracker = null;

    const [remainingWorkspaces, remainingUsers] = await Promise.all([
      client.from('workspaces').select('id').in('id', fixture.workspaceIds),
      client.from('users').select('id').in('id', fixture.userIds),
    ]);
    expect(remainingWorkspaces.data).toEqual([]);
    expect(remainingUsers.data).toEqual([]);
  });

  it('cleans rows created before a fixture setup failure', async () => {
    await expect(createDatabaseProofFixture(databaseEnvironment!, {
      failAfter: 'workspaceA',
      onProgress: (next) => { tracker = next; },
    })).rejects.toThrow('requested failure');

    expect(tracker?.workspaceIds).toHaveLength(1);
    await cleanupDatabaseProofFixture(databaseEnvironment!, tracker!);
    const client = createServiceRoleClient(databaseEnvironment!);
    const remaining = await client.from('workspaces').select('id').in('id', tracker!.workspaceIds);
    expect(remaining.data).toEqual([]);
    tracker = null;
  });
});
