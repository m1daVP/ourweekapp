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
    });
  });
});