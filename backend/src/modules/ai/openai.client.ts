import OpenAI from 'openai';

const MEETING_SUMMARY_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    shortSummary: { type: 'string' },
    mainTopics: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string' },
    },
    keyTensions: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string' },
    },
    agreements: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string' },
    },
    tasks: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          responsibleParticipantIds: {
            type: ['array', 'null'],
            items: { type: 'string' },
          },
          dueDate: { type: ['string', 'null'] },
        },
        required: ['title', 'responsibleParticipantIds', 'dueDate'],
      },
    },
    suggestedNextMeetingFocus: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string' },
    },
  },
  required: [
    'shortSummary',
    'mainTopics',
    'keyTensions',
    'agreements',
    'tasks',
    'suggestedNextMeetingFocus',
  ],
} as const;

export type AiSummaryTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type AiSummaryProviderResult = {
  output: unknown;
  usage: AiSummaryTokenUsage | null;
};

export type AiSummaryProvider = {
  generateMeetingSummary(input: {
    systemPrompt: string;
    userPrompt: string;
    model: string;
    maxOutputTokens: number;
  }): Promise<AiSummaryProviderResult>;
};

export class OpenAiSummaryProvider implements AiSummaryProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    // Worst case with retries (~2 x timeout + backoff, ~30-32s) must stay
    // under the frontend's abort window (aiSummaryService.ts, currently 45s)
    // so the backend always gives up before the client does.
    this.client = new OpenAI({ apiKey, timeout: 15_000, maxRetries: 1 });
  }

  async generateMeetingSummary(input: {
    systemPrompt: string;
    userPrompt: string;
    model: string;
    maxOutputTokens: number;
  }) {
    const response = await this.client.responses.create({
      model: input.model,
      instructions: input.systemPrompt,
      input: input.userPrompt,
      max_output_tokens: input.maxOutputTokens,
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'meeting_summary',
          schema: MEETING_SUMMARY_OUTPUT_SCHEMA,
          strict: true,
        },
      },
    });
    const content = response.output_text;
    const usage = response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : null;

    return {
      output: content ? (JSON.parse(content) as unknown) : null,
      usage,
    };
  }
}
