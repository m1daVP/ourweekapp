import { describe, expect, it, vi } from 'vitest';

import { AiRepository } from '../src/modules/ai/ai.repository.js';

const workspaceId = '22222222-2222-4222-8222-222222222222';
const meetingId = '11111111-1111-4111-8111-111111111111';
const userId = '33333333-3333-4333-8333-333333333333';

const summary = {
  id: '55555555-5555-4555-8555-555555555555',
  meetingId,
  shortSummary: 'A persisted request summary.',
  mainTopics: ['Planning'],
  keyTensions: [],
  agreements: [],
  tasks: [],
  suggestedNextMeetingFocus: [],
  createdAt: '2026-06-06T10:00:00.000Z',
};

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    workspace_id: workspaceId,
    user_id: userId,
    meeting_id: meetingId,
    provider: 'openai',
    status: 'pending',
    input_hash: 'hash_1',
    created_at: '2026-06-06T10:00:00.000Z',
    completed_at: null,
    error_code: null,
    generated_summary: null,
    ...overrides,
  };
}

describe('AiRepository', () => {
  it('claims generation through the workspace-scoped RPC', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { ...requestRow(), claim_status: 'created' },
      error: null,
    });
    const rpc = vi.fn().mockReturnValue({ single });
    const repository = new AiRepository({ rpc } as never);

    await expect(repository.claimSummaryGeneration({
      workspaceId,
      meetingId,
      userId,
      provider: 'openai',
      inputHash: 'hash_1',
    })).resolves.toMatchObject({
      status: 'created',
      request: { id: '44444444-4444-4444-8444-444444444444', inputHash: 'hash_1' },
    });

    expect(rpc).toHaveBeenCalledWith('claim_ai_summary_generation', {
      p_workspace_id: workspaceId,
      p_meeting_id: meetingId,
      p_user_id: userId,
      p_provider: 'openai',
      p_input_hash: 'hash_1',
    });
  });

  it('rejects an unknown claim state without exposing database details', async () => {
    const repository = new AiRepository({
      rpc: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { ...requestRow(), claim_status: 'unexpected' },
          error: null,
        }),
      }),
    } as never);

    await expect(repository.claimSummaryGeneration({
      workspaceId,
      meetingId,
      userId,
      provider: 'openai',
      inputHash: 'hash_1',
    })).rejects.toMatchObject({
      statusCode: 500,
      code: 'ai_summary_request_claim_invalid',
    });
  });

  it('writes a request-bound summary snapshot on completion', async () => {
    const single = vi.fn().mockResolvedValue({ data: requestRow(), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const secondEq = vi.fn().mockReturnValue({ select });
    const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
    const update = vi.fn().mockReturnValue({ eq: firstEq });
    const from = vi.fn().mockReturnValue({ update });
    const repository = new AiRepository({ from } as never);

    await repository.markSummaryRequestCompleted(
      workspaceId,
      '44444444-4444-4444-8444-444444444444',
      '2026-06-06T10:01:00.000Z',
      null,
      summary,
    );

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      generated_summary: summary,
    }));
  });
});
