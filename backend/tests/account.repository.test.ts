import { describe, expect, it } from 'vitest';

import { AccountRepository } from '../src/modules/account/account.repository.js';
import type { SupabaseRepositoryClient } from '../src/shared/repositories/index.js';

class FakeQuery {
  public readonly calls: Array<{ method: string; args: unknown[] }> = [];

  constructor(private readonly result: { data: unknown; error: unknown }) {}

  eq(...args: unknown[]) {
    this.calls.push({ method: 'eq', args });
    return this;
  }

  is(...args: unknown[]) {
    this.calls.push({ method: 'is', args });
    return this;
  }

  neq(...args: unknown[]) {
    this.calls.push({ method: 'neq', args });
    return this;
  }

  order(...args: unknown[]) {
    this.calls.push({ method: 'order', args });
    return this;
  }

  limit(...args: unknown[]) {
    this.calls.push({ method: 'limit', args });
    return this;
  }

  maybeSingle<T>() {
    return Promise.resolve({
      data: this.result.data as T,
      error: this.result.error,
    });
  }

  returns<T>() {
    return Promise.resolve({
      data: this.result.data as T,
      error: this.result.error,
    });
  }

  single<T>() {
    return Promise.resolve({
      data: this.result.data as T,
      error: this.result.error,
    });
  }
}

function createClient(result: { data: unknown; error: unknown }) {
  const selects: Array<{ table: string; columns: string }> = [];
  const updates: Array<{ table: string; value: unknown }> = [];
  const rpcs: Array<{ name: string; args: Record<string, unknown> }> = [];
  const queries: FakeQuery[] = [];

  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      rpcs.push({ name, args });

      return Promise.resolve({ data: null, error: result.error });
    },
    from(table: string) {
      const query = new FakeQuery(result);
      queries.push(query);

      return {
        select(columns: string) {
          selects.push({ table, columns });
          return query;
        },
        update(value: unknown) {
          updates.push({ table, value });
          return query;
        },
      };
    },
  } as unknown as SupabaseRepositoryClient;

  return { client, queries, rpcs, selects, updates };
}

describe('AccountRepository export queries', () => {
  it('selects only safe user columns for account export', async () => {
    const { client, selects } = createClient({
      data: {
        id: 'user-1',
        email: 'rita@example.com',
        display_name: 'Rita',
        created_at: '2026-06-07T12:00:00.000Z',
        updated_at: '2026-06-07T12:00:00.000Z',
      },
      error: null,
    });
    const repository = new AccountRepository(client);

    await repository.findActiveUser('user-1');

    expect(selects).toEqual([
      {
        table: 'users',
        columns: 'id,email,display_name,created_at,updated_at',
      },
    ]);
    expect(selects[0]?.columns).not.toContain('password_hash');
  });

  it('does not select encrypted calendar provider tokens for export', async () => {
    const { client, selects } = createClient({
      data: [],
      error: null,
    });
    const repository = new AccountRepository(client);

    await repository.listCalendarConnectionsForWorkspaceUser('workspace-1', 'user-1');

    expect(selects[0]).toEqual({
      table: 'calendar_connections',
      columns:
        'id,workspace_id,user_id,provider,connected_account_email,token_expires_at,state,created_at,updated_at,disconnected_at',
    });
    expect(selects[0]?.columns).not.toContain('access_token_encrypted');
    expect(selects[0]?.columns).not.toContain('refresh_token_encrypted');
  });
});

describe('AccountRepository deletion queries', () => {
  it('delegates deletion to the transactional account_delete RPC', async () => {
    const { client, rpcs } = createClient({ data: null, error: null });
    const repository = new AccountRepository(client);
    const deletedAt = '2026-06-07T12:00:00.000Z';

    await repository.deleteAccountAtomically('user-1', deletedAt);

    expect(rpcs).toEqual([
      {
        name: 'account_delete',
        args: {
          p_user_id: 'user-1',
          p_deleted_at: deletedAt,
        },
      },
    ]);
  });
});
