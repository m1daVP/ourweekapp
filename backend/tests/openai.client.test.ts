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
  });

  it('returns a null output when the response has no output text', async () => {
    const { OpenAiSummaryProvider } = await import('../src/modules/ai/openai.client.js');
    responsesCreate.mockResolvedValueOnce({ output_text: '' });

    const provider = new OpenAiSummaryProvider('test-api-key');
    const result = await provider.generateMeetingSummary({
      systemPrompt: 'system prompt',
      userPrompt: '{"templateId":"weekly-family-check-in"}',
      model: 'gpt-5.4-nano',
      maxOutputTokens: 800,
    });

    expect(result.output).toBeNull();
    expect(result.usage).toBeNull();
  });
});
