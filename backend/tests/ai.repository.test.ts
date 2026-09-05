import { describe, expect, it, vi } from 'vitest';

import {
  AiRepository,
  mapAiSummaryRequestRowToDto,
} from '../src/modules/ai/ai.repository.js';

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
    effective_model: 'gpt-5.4-nano',
    prompt_version: 'weekly-family-check-in-v1',
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
      effectiveModel: 'gpt-5.4-nano',
      promptVersion: 'weekly-family-check-in-v1',
    })).resolves.toMatchObject({
      status: 'created',
      request: {
        id: '44444444-4444-4444-8444-444444444444',
        inputHash: 'hash_1',
        effectiveModel: 'gpt-5.4-nano',
        promptVersion: 'weekly-family-check-in-v1',
      },
    });

    expect(rpc).toHaveBeenCalledWith('claim_ai_summary_generation_v2', {
      p_workspace_id: workspaceId,
      p_meeting_id: meetingId,
      p_user_id: userId,
      p_provider: 'openai',
      p_input_hash: 'hash_1',
      p_effective_model: 'gpt-5.4-nano',
      p_prompt_version: 'weekly-family-check-in-v1',
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
      effectiveModel: 'gpt-5.4-nano',
      promptVersion: 'weekly-family-check-in-v1',
    })).rejects.toMatchObject({
      statusCode: 500,
      code: 'ai_summary_request_claim_invalid',
    });
  });

  it('keeps internal model audit fields out of public request DTOs', () => {
    expect(mapAiSummaryRequestRowToDto(requestRow() as never)).toEqual({
      id: '44444444-4444-4444-8444-444444444444',
      workspaceId,
      userId,
      meetingId,
      provider: 'openai',
      status: 'pending',
      createdAt: '2026-06-06T10:00:00.000Z',
      completedAt: null,
      errorCode: null,
    });
  });

  it('maps nullable model audit values on a legacy request record', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        ...requestRow({ effective_model: null, prompt_version: null }),
        claim_status: 'created',
      },
      error: null,
    });
    const repository = new AiRepository({ rpc: vi.fn().mockReturnValue({ single }) } as never);

    await expect(repository.claimSummaryGeneration({
      workspaceId,
      meetingId,
      userId,
      provider: 'openai',
      inputHash: 'hash_1',
      effectiveModel: 'gpt-5.4-nano',
      promptVersion: 'weekly-family-check-in-v1',
    })).resolves.toMatchObject({
      request: { effectiveModel: null, promptVersion: null },
    });
  });

  it('finalizes a claimed summary through the workspace-scoped RPC', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        finalization_status: 'applied',
        meeting_id: meetingId,
        source_server_revision: 1,
        server_revision: 2,
        updated_at: '2026-06-06T10:01:00.000Z',
      },
      error: null,
    });
    const rpc = vi.fn().mockReturnValue({ single });
    const repository = new AiRepository({ rpc } as never);

    await expect(repository.finalizeSummaryGeneration({
      workspaceId,
      requestId: '44444444-4444-4444-8444-444444444444',
      meetingId,
      expectedServerRevision: 1,
      generatedSummary: summary,
      completedAt: '2026-06-06T10:01:00.000Z',
      usage: { inputTokens: 320, outputTokens: 90, totalTokens: 410 },
    })).resolves.toEqual({
      status: 'applied',
      meetingId,
      sourceServerRevision: 1,
      serverRevision: 2,
      updatedAt: '2026-06-06T10:01:00.000Z',
    });

    expect(rpc).toHaveBeenCalledWith('finalize_ai_summary_generation', {
      p_workspace_id: workspaceId,
      p_request_id: '44444444-4444-4444-8444-444444444444',
      p_meeting_id: meetingId,
      p_expected_server_revision: 1,
      p_generated_summary: summary,
      p_completed_at: '2026-06-06T10:01:00.000Z',
      p_input_tokens: 320,
      p_output_tokens: 90,
      p_total_tokens: 410,
    });
  });

  it('rejects an unknown finalization state without exposing database details', async () => {
    const repository = new AiRepository({
      rpc: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            finalization_status: 'unexpected',
            meeting_id: meetingId,
            source_server_revision: 1,
            server_revision: 2,
            updated_at: '2026-06-06T10:01:00.000Z',
          },
          error: null,
        }),
      }),
    } as never);

    await expect(repository.finalizeSummaryGeneration({
      workspaceId,
      requestId: '44444444-4444-4444-8444-444444444444',
      meetingId,
      expectedServerRevision: 1,
      generatedSummary: summary,
      completedAt: '2026-06-06T10:01:00.000Z',
      usage: null,
    })).rejects.toMatchObject({
      statusCode: 500,
      code: 'ai_summary_request_finalization_invalid',
    });
  });

});
