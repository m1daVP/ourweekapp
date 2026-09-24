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
  participant_id: 'participant-1',
  email: 'alex@example.com',
  email_normalized: 'alex@example.com',
  display_name: 'Alex',
  role: 'adult_member',
  status: 'pending',
  delivery_status: 'sent',
  delivery_attempted_at: '2026-06-06T10:00:00.000Z',
  delivery_sent_at: '2026-06-06T10:00:00.000Z',
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
    private readonly calls: Array<Record<string, unknown>>,
  ) {}

  select() {
    return this;
  }

  update(value: Record<string, unknown>) {
    this.calls.push({ update: value });
    return this;
  }

  eq(column: string, value: unknown) {
    this.calls.push({ eq: [column, value] });
    return this;
  }

  order() {
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
  const calls: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      calls.push({ table });
      return new FakeFromQuery(result, calls);
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

  it('maps a single-object participant invitation RPC response', async () => {
    const { calls, client } = createRpcClient({ data: invitationRow, error: null });
    const repository = new WorkspacesRepository(client);

    const result = await repository.createInvitation({
      workspaceId: 'workspace-1',
      participantId: 'participant-1',
      email: 'alex@example.com',
      emailNormalized: 'alex@example.com',
      role: 'adult_member',
      tokenHash: 'token-hash',
      expiresAt: '2026-06-13T10:00:00.000Z',
    });

    expect(calls).toEqual([
      {
        name: 'create_participant_invitation',
        args: {
          p_workspace_id: 'workspace-1',
          p_participant_id: 'participant-1',
          p_email: 'alex@example.com',
          p_email_normalized: 'alex@example.com',
          p_role: 'adult_member',
          p_token_hash: 'token-hash',
          p_expires_at: '2026-06-13T10:00:00.000Z',
        },
      },
    ]);
    expect(result).toMatchObject({
      id: 'invitation-1',
      participantId: 'participant-1',
      email: 'alex@example.com',
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

    expect(calls).toEqual([
      { table: 'workspace_invitations' },
      { eq: ['workspace_id', 'workspace-1'] },
      { eq: ['status', 'pending'] },
    ]);
    expect(result).toEqual([
      {
        id: 'invitation-1',
        workspaceId: 'workspace-1',
        participantId: 'participant-1',
        email: 'alex@example.com',
        emailNormalized: 'alex@example.com',
        displayName: 'Alex',
        role: 'adult_member',
        status: 'pending',
        deliveryStatus: 'sent',
        createdAt: '2026-06-06T10:00:00.000Z',
        expiresAt: '2026-06-13T10:00:00.000Z',
      },
    ]);
    expect(result[0]).not.toHaveProperty('tokenHash');
  });

  it('revokes a pending invitation within its workspace', async () => {
    const { calls, client } = createRpcClient({
      data: [{ ...invitationRow, status: 'revoked' }],
      error: null,
    });
    const repository = new WorkspacesRepository(client);

    const result = await repository.revokePendingInvitation(
      'workspace-1',
      'invitation-1',
    );

    expect(calls).toEqual([
      {
        name: 'revoke_participant_invitation',
        args: {
          p_workspace_id: 'workspace-1',
          p_invitation_id: 'invitation-1',
        },
      },
    ]);
    expect(result).toMatchObject({
      id: 'invitation-1',
      workspaceId: 'workspace-1',
      status: 'revoked',
    });
  });

  it('returns a safe not-found error when no pending invitation matches', async () => {
    const { client } = createRpcClient({ data: [], error: null });
    const repository = new WorkspacesRepository(client);

    await expect(
      repository.revokePendingInvitation('workspace-1', 'invitation-1'),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'workspace_invitation_not_found',
      details: {},
    });
  });

  it('links an active workspace member to the selected participant atomically', async () => {
    const { calls, client } = createRpcClient({
      data: [memberRow],
      error: null,
    });
    const repository = new WorkspacesRepository(client);

    const result = await repository.linkExistingMemberToParticipant(
      'workspace-1',
      'participant-1',
      'rita@example.com',
      'rita@example.com',
    );

    expect(calls).toEqual([
      {
        name: 'link_existing_workspace_member_to_participant',
        args: {
          p_workspace_id: 'workspace-1',
          p_participant_id: 'participant-1',
          p_email: 'rita@example.com',
          p_email_normalized: 'rita@example.com',
        },
      },
    ]);
    expect(result).toMatchObject({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      email: 'rita@example.com',
    });
  });
});
