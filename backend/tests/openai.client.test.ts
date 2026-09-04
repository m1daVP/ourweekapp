import { beforeEach, describe, expect, it, vi } from 'vitest';

const responsesCreate = vi.hoisted(() => vi.fn());
const openAiConstructor = vi.hoisted(() => vi.fn());

vi.mock('openai', () => ({
  default: vi.fn(function OpenAI(input: unknown) {
    openAiConstructor(input);

    return {
      responses: {
        create: responsesCreate,
      },
    };
  }),
}));

describe('OpenAiSummaryProvider', () => {
  beforeEach(() => {
    responsesCreate.mockReset();
    openAiConstructor.mockClear();
  });

  it('uses Responses API with strict structured output and privacy-safe request options', async () => {
    const { OpenAiSummaryProvider } = await import('../src/modules/ai/openai.client.js');
    responsesCreate.mockResolvedValueOnce({
      _request_id: 'req_safe_ok',
      status: 'completed',
      error: null,
      incomplete_details: null,
      output: [],
      output_text: JSON.stringify({
        shortSummary: 'Done',
        mainTopics: [],
        keyTensions: [],
        agreements: [],
        tasks: [],
        suggestedNextMeetingFocus: [],
      }),
      usage: {
        input_tokens: 120,
        output_tokens: 45,
        total_tokens: 165,
      },
    });

    const provider = new OpenAiSummaryProvider('test-api-key');
    const result = await provider.generateMeetingSummary({
      systemPrompt: 'system prompt',
      userPrompt: '{"templateId":"weekly-family-check-in"}',
      model: 'gpt-5.4-nano',
      maxOutputTokens: 800,
    });

    expect(openAiConstructor).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      timeout: 15_000,
      maxRetries: 1,
    });
    expect(result.output).toMatchObject({ shortSummary: 'Done' });
    expect(result.usage).toEqual({
      inputTokens: 120,
      outputTokens: 45,
      totalTokens: 165,
    });
    expect(result.providerRequestId).toBe('req_safe_ok');
    expect(result.providerDurationMs).toBeGreaterThanOrEqual(0);
    expect(responsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4-nano',
        instructions: 'system prompt',
        input: '{"templateId":"weekly-family-check-in"}',
        max_output_tokens: 800,
        store: false,
        text: {
          format: expect.objectContaining({
            type: 'json_schema',
            name: 'meeting_summary',
            strict: true,
            schema: expect.objectContaining({
              type: 'object',
              additionalProperties: false,
            }),
          }),
        },
      }),
    );
    expect(responsesCreate.mock.calls[0]?.[0].text.format.schema.properties.tasks.items)
      .toMatchObject({
        additionalProperties: false,
        required: ['title', 'responsibleParticipantIds', 'dueDate'],
      });
  });

  it('returns null usage when the response has no usage field', async () => {
    const { OpenAiSummaryProvider } = await import('../src/modules/ai/openai.client.js');
    responsesCreate.mockResolvedValueOnce({
      status: 'completed',
      error: null,
      incomplete_details: null,
      output: [],
      output_text: JSON.stringify({
        shortSummary: 'Done',
        mainTopics: [],
        keyTensions: [],
        agreements: [],
        tasks: [],
        suggestedNextMeetingFocus: [],
      }),
    });

    const provider = new OpenAiSummaryProvider('test-api-key');
    const result = await provider.generateMeetingSummary({
      systemPrompt: 'system prompt',
      userPrompt: '{"templateId":"weekly-family-check-in"}',
      model: 'gpt-5.4-nano',
      maxOutputTokens: 800,
    });

    expect(result.usage).toBeNull();
    expect(result.providerRequestId).toBeNull();
    expect(result.providerDurationMs).toBeGreaterThanOrEqual(0);
  });

  it.each([
    ['quota exhaustion', { status: 429, code: 'insufficient_quota', requestID: 'req_quota' }, 'quota_exhausted'],
    ['authentication failure', { status: 401, code: 'invalid_api_key', requestID: 'req_auth' }, 'authentication_or_configuration'],
    ['model configuration failure', { status: 400, code: 'model_not_found', requestID: 'req_model' }, 'authentication_or_configuration'],
    ['rate limiting', { status: 429, code: 'rate_limit_exceeded', requestID: 'req_rate' }, 'rate_limited'],
    ['provider outage', { status: 500, code: 'server_error', requestID: 'req_server' }, 'provider_unavailable'],
  ] as const)('classifies %s without preserving raw SDK details', async (_name, details, failureClass) => {
    const { AiSummaryProviderError, OpenAiSummaryProvider } = await import('../src/modules/ai/openai.client.js');
    const rawError = Object.assign(new Error('raw provider error secret'), {
      ...details,
      body: 'raw-provider-body-secret',
      authorization: 'Bearer sk-secret-123',
    });
    responsesCreate.mockRejectedValueOnce(rawError);

    const provider = new OpenAiSummaryProvider('test-api-key');

    await expect(provider.generateMeetingSummary({
      systemPrompt: 'system prompt secret',
      userPrompt: 'prompt-secret-123',
      model: 'gpt-5.4-nano',
      maxOutputTokens: 800,
    })).rejects.toMatchObject({
      name: 'AiSummaryProviderError',
      metadata: {
        failureClass,
        status: details.status,
        providerCode: details.code,
        providerRequestId: details.requestID,
        model: 'gpt-5.4-nano',
      },
    });

    responsesCreate.mockRejectedValueOnce(rawError);
    try {
      await provider.generateMeetingSummary({
        systemPrompt: 'system prompt secret',
        userPrompt: 'prompt-secret-123',
        model: 'gpt-5.4-nano',
        maxOutputTokens: 800,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AiSummaryProviderError);
      expect(JSON.stringify(error)).not.toContain('raw provider error secret');
      expect(JSON.stringify(error)).not.toContain('raw-provider-body-secret');
      expect(JSON.stringify(error)).not.toContain('sk-secret-123');
      expect(JSON.stringify(error)).not.toContain('prompt-secret-123');
    }
  });

  it('classifies connection failures as timeout or network failures', async () => {
    const { AiSummaryProviderError, OpenAiSummaryProvider } = await import('../src/modules/ai/openai.client.js');
    const networkError = Object.assign(new Error('socket failure secret'), {
      name: 'APIConnectionTimeoutError',
    });
    responsesCreate.mockRejectedValueOnce(networkError);

    const provider = new OpenAiSummaryProvider('test-api-key');

    await expect(provider.generateMeetingSummary({
      systemPrompt: 'system prompt',
      userPrompt: 'prompt-secret-123',
      model: 'gpt-5.4-nano',
      maxOutputTokens: 800,
    })).rejects.toMatchObject({
      name: 'AiSummaryProviderError',
      metadata: {
        failureClass: 'timeout_or_network',
        status: null,
        providerCode: null,
        providerRequestId: null,
      },
    });

    expect(AiSummaryProviderError).toBeTypeOf('function');
  });

  it.each([
    ['a failed Responses object', {
      _request_id: 'req_response_error',
      status: 'failed',
      error: { code: 'rate_limit_exceeded', message: 'raw-provider-body-secret' },
      incomplete_details: null,
      output: [],
      output_text: '',
    }, 'rate_limited'],
    ['an unavailable Responses object', {
      _request_id: 'req_response_server_error',
      status: 'failed',
      error: { code: 'server_error', message: 'raw-provider-body-secret' },
      incomplete_details: null,
      output: [],
      output_text: '',
    }, 'provider_unavailable'],
    ['an incomplete Responses object', {
      _request_id: 'req_incomplete',
      status: 'incomplete',
      error: null,
      incomplete_details: { reason: 'max_output_tokens' },
      output: [],
      output_text: '',
    }, 'incomplete_output'],
    ['a refusal output item', {
      _request_id: 'req_refusal',
      status: 'completed',
      error: null,
      incomplete_details: null,
      output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'raw refusal secret' }] }],
      output_text: '',
    }, 'refused'],
    ['missing output text', {
      _request_id: 'req_empty',
      status: 'completed',
      error: null,
      incomplete_details: null,
      output: [],
      output_text: '',
    }, 'invalid_structured_output'],
    ['malformed JSON output', {
      _request_id: 'req_malformed',
      status: 'completed',
      error: null,
      incomplete_details: null,
      output: [],
      output_text: '{not JSON',
    }, 'invalid_structured_output'],
  ] as const)('classifies %s without exposing provider content', async (_name, response, failureClass) => {
    const { AiSummaryProviderError, OpenAiSummaryProvider } = await import('../src/modules/ai/openai.client.js');
    responsesCreate.mockResolvedValueOnce(response);
    const provider = new OpenAiSummaryProvider('test-api-key');

    await expect(provider.generateMeetingSummary({
      systemPrompt: 'system prompt secret',
      userPrompt: 'prompt-secret-123',
      model: 'gpt-5.4-nano',
      maxOutputTokens: 800,
    })).rejects.toMatchObject({
      name: 'AiSummaryProviderError',
      metadata: {
        failureClass,
        providerRequestId: response._request_id,
      },
    });

    responsesCreate.mockResolvedValueOnce(response);
    try {
      await provider.generateMeetingSummary({
        systemPrompt: 'system prompt secret',
        userPrompt: 'prompt-secret-123',
        model: 'gpt-5.4-nano',
        maxOutputTokens: 800,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AiSummaryProviderError);
      expect(JSON.stringify(error)).not.toContain('raw-provider-body-secret');
      expect(JSON.stringify(error)).not.toContain('raw refusal secret');
      expect(JSON.stringify(error)).not.toContain('prompt-secret-123');
    }
  });

  it('classifies missing output text as invalid structured output', async () => {
    const { AiSummaryProviderError, OpenAiSummaryProvider } = await import('../src/modules/ai/openai.client.js');
    responsesCreate.mockResolvedValueOnce({ output_text: '' });

    const provider = new OpenAiSummaryProvider('test-api-key');

    await expect(provider.generateMeetingSummary({
      systemPrompt: 'system prompt',
      userPrompt: '{"templateId":"weekly-family-check-in"}',
      model: 'gpt-5.4-nano',
      maxOutputTokens: 800,
    })).rejects.toBeInstanceOf(AiSummaryProviderError);
  });
});
