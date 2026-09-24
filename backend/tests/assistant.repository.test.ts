import { describe, expect, it, vi } from 'vitest';

import { AssistantRepository } from '../src/modules/assistant/assistant.repository.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';

describe('AssistantRepository', () => {
  it('reconciles stale recap work through the workspace-scoped RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const repository = new AssistantRepository({ rpc } as never);

    await expect(repository.reconcileAbandonedRecaps(workspaceId)).resolves.toBeUndefined();

    expect(rpc).toHaveBeenCalledWith('reconcile_abandoned_assistant_recap_requests', {
      p_workspace_id: workspaceId,
    });
  });

  it('maps reconciliation database failures without exposing database details', async () => {
    const repository = new AssistantRepository({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'internal SQL detail' },
      }),
    } as never);

    await expect(repository.reconcileAbandonedRecaps(workspaceId)).rejects.toMatchObject({
      code: 'assistant_recap_recovery_failed',
    });
  });
});
