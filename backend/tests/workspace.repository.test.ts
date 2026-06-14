import { describe, expect, it } from 'vitest';

import { WorkspacesRepository } from '../src/modules/workspace/workspaces.repository.js';
import type { SupabaseRepositoryClient } from '../src/shared/repositories/index.js';

type RpcCall = {
  name: string;
  args: Record<string, unknown>;
};

const memberRow = {
  workspace_id: 'workspace-1',
  user_id: 'user-1',
  display_name: 'Rita',
  email: 'rita@example.com',
  role: 'adult_member',
  status: 'active',
  created_at: '2026-06-06T10:00:00.000Z',
  updated_at: '2026-06-06T10:00:00.000Z',
};

const invitationRow = {
  id: 'invitation-1',
  workspace_id: 'workspace-1',
  email: 'alex@example.com',
  email_normalized: 'alex@example.com',
  display_name: 'Alex',
  role: 'adult_member',
  status: 'pending',
  created_at: '2026-06-06T10:00:00.000Z',
  expires_at: '2026-06-13T10:00:00.000Z',
};

class FakeRpcQuery {
  constructor(
    private readonly result: { data: unknown; error: unknown },
  ) {}

  returns<T>() {
    return Promise.resolve({
      data: this.result.data as T,
      error: this.result.error,
    });
  }
}

class FakeFromQuery {
  constructor(
    private readonly result: { data: unknown; error: unknown },
  ) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  order() {
    return this;
  }

  returns<T>() {
    return Promise.resolve({
      data: this.result.data as T,
      error: this.result.error,
    });
  }
}

function createRpcClient(result: { data: unknown; error: unknown }) {
  const calls: RpcCall[] = [];
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return new FakeRpcQuery(result);
    },
  } as unknown as SupabaseRepositoryClient;

  return { calls, client };
}

function createFromClient(result: { data: unknown; error: unknown }) {
  const calls: Array<{ table: string }> = [];
  const client = {
    from(table: string) {
      calls.push({ table });
      return new FakeFromQuery(result);
    },
  } as unknown as SupabaseRepositoryClient;

  return { calls, client };
}

describe('WorkspacesRepository', () => {
  it('updates active members through the atomic workspace RPC', async () => {
    const { calls, client } = createRpcClient({ data: [memberRow], error: null });
    const repository = new WorkspacesRepository(client);

    const result = await repository.updateActiveMemberAtomically(
      'workspace-1',
      'user-1',
      { role: 'adult_member' },
    );

    expect(calls).toEqual([
      {
        name: 'workspace_update_active_member',
        args: {
          p_workspace_id: 'workspace-1',
          p_user_id: 'user-1',
          p_role: 'adult_member',
          p_status: null,
        },
      },
    ]);
    expect(result).toMatchObject({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'adult_member',
      status: 'active',
    });
  });

  it('maps last-owner RPC failures to a safe conflict error', async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: 'P0001',
        message: 'workspace_last_owner',
        details: null,
        hint: null,
      },
    });
    const repository = new WorkspacesRepository(client);

    await expect(
      repository.updateActiveMemberAtomically('workspace-1', 'user-1', {
        status: 'removed',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'workspace_last_owner',
      details: {},
    });
  });

  it('maps invalid RPC status failures to a safe validation error', async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: '22023',
        message: 'workspace_member_status_transition_invalid',
        details: null,
        hint: null,
      },
    });
    const repository = new WorkspacesRepository(client);

    await expect(
      repository.updateActiveMemberAtomically('workspace-1', 'user-1', {
        status: 'removed',
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'workspace_member_status_transition_invalid',
      details: {},
    });
  });

  it('maps invalid RPC role failures to a safe validation error', async () => {
    const { client } = createRpcClient({
      data: null,
      error: {
        code: '22023',
        message: 'workspace_member_role_invalid',
        details: null,
        hint: null,
      },
    });
    const repository = new WorkspacesRepository(client);

    await expect(
      repository.updateActiveMemberAtomically('workspace-1', 'user-1', {
        role: 'adult_member',
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'workspace_member_role_invalid',
      details: {},
    });
  });

  it('lists pending invitations with safe public fields', async () => {
    const { calls, client } = createFromClient({
      data: [
        {
          ...invitationRow,
          token_hash: 'sha256:secret',
        },
      ],
      error: null,
    });
    const repository = new WorkspacesRepository(client);

    const result = await repository.listPendingInvitationsForWorkspace('workspace-1');

    expect(calls).toEqual([{ table: 'workspace_invitations' }]);
    expect(result).toEqual([
      {
        id: 'invitation-1',
        workspaceId: 'workspace-1',
        email: 'alex@example.com',
        emailNormalized: 'alex@example.com',
        displayName: 'Alex',
        role: 'adult_member',
        status: 'pending',
        createdAt: '2026-06-06T10:00:00.000Z',
        expiresAt: '2026-06-13T10:00:00.000Z',
      },
    ]);
    expect(result[0]).not.toHaveProperty('tokenHash');
  });
});
