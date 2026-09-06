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

export type AiSummaryProviderFailureClass =
  | 'quota_exhausted'
  | 'authentication_or_configuration'
  | 'rate_limited'
  | 'timeout_or_network'
  | 'provider_unavailable'
  | 'refused'
  | 'incomplete_output'
  | 'invalid_structured_output';

export type AiSummaryProviderFailureMetadata = {
  failureClass: AiSummaryProviderFailureClass;
  status: number | null;
  providerCode: string | null;
  providerRequestId: string | null;
  model: string;
  durationMs: number;
  usage: AiSummaryTokenUsage | null;
};

export class AiSummaryProviderError extends Error {
  constructor(public readonly metadata: AiSummaryProviderFailureMetadata) {
    super('AI summary provider request failed.');
    this.name = 'AiSummaryProviderError';
  }
}

export function isAiSummaryProviderError(error: unknown): error is AiSummaryProviderError {
  return error instanceof AiSummaryProviderError;
}

export type AiSummaryProviderResult = {
  output: unknown;
  usage: AiSummaryTokenUsage | null;
  providerRequestId: string | null;
  providerDurationMs: number;
};

export type AiSummaryProvider = {
  generateMeetingSummary(input: {
    systemPrompt: string;
    userPrompt: string;
    model: string;
    maxOutputTokens: number;
    safetyIdentifier: string;
  }): Promise<AiSummaryProviderResult>;
};

type SafeProviderErrorDetails = {
  status: number | null;
  providerCode: string | null;
  providerRequestId: string | null;
};

function durationMsSince(startedAtMs: number) {
  return Math.max(0, Date.now() - startedAtMs);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function safeStatus(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : null;
}

function safeTokenCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function normalizeUsage(value: unknown): AiSummaryTokenUsage | null {
  if (!isRecord(value)) {
    return null;
  }

  const inputTokens = safeTokenCount(value.input_tokens);
  const outputTokens = safeTokenCount(value.output_tokens);
  const totalTokens = safeTokenCount(value.total_tokens);

  if (inputTokens === null || outputTokens === null || totalTokens === null) {
    return null;
  }

  return { inputTokens, outputTokens, totalTokens };
}

function responseRequestId(response: unknown) {
  return isRecord(response) ? safeString(response._request_id) : null;
}

function responseHasRefusal(output: unknown) {
  return Array.isArray(output) && output.some((item) => (
    isRecord(item)
    && Array.isArray(item.content)
    && item.content.some((content) => isRecord(content) && content.type === 'refusal')
  ));
}

function safeProviderErrorDetails(error: unknown): SafeProviderErrorDetails {
  if (!isRecord(error)) {
    return { status: null, providerCode: null, providerRequestId: null };
  }

  return {
    status: safeStatus(error.status),
    providerCode: safeString(error.code),
    providerRequestId: safeString(error.requestID),
  };
}

function isQuotaCode(providerCode: string | null) {
  return providerCode === 'insufficient_quota'
    || providerCode === 'billing_hard_limit_reached'
    || providerCode === 'credit_balance_exhausted'
    || providerCode === 'quota_exceeded';
}

function isModelConfigurationCode(providerCode: string | null) {
  return providerCode === 'model_not_found'
    || providerCode === 'invalid_model'
    || providerCode === 'unsupported_model'
    || providerCode === 'model_access_denied';
}

function isConnectionOrTimeoutError(error: unknown) {
  const connectionErrorClass = (OpenAI as unknown as {
    APIConnectionError?: new (...arguments_: never[]) => object;
  }).APIConnectionError;

  if (connectionErrorClass && error instanceof connectionErrorClass) {
    return true;
  }

  return error instanceof Error
    && (error.name === 'APIConnectionError' || error.name === 'APIConnectionTimeoutError');
}

function classifyProviderError(
  details: SafeProviderErrorDetails,
  error: unknown,
): AiSummaryProviderFailureClass {
  if (details.status === 429 && isQuotaCode(details.providerCode)) {
    return 'quota_exhausted';
  }

  if (details.status === 429 || details.providerCode === 'rate_limit_exceeded') {
    return 'rate_limited';
  }

  if (
    details.status === 401
    || details.status === 403
    || isModelConfigurationCode(details.providerCode)
  ) {
    return 'authentication_or_configuration';
  }

  if (
    isConnectionOrTimeoutError(error)
    || (details.status === null && details.providerCode === null)
  ) {
    return 'timeout_or_network';
  }

  return 'provider_unavailable';
}

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
    safetyIdentifier: string;
  }) {
    const startedAtMs = Date.now();

    try {
      const response = await this.client.responses.create({
        model: input.model,
        instructions: input.systemPrompt,
        input: input.userPrompt,
        max_output_tokens: input.maxOutputTokens,
        store: false,
        safety_identifier: input.safetyIdentifier,
        text: {
          format: {
            type: 'json_schema',
            name: 'meeting_summary',
            schema: MEETING_SUMMARY_OUTPUT_SCHEMA,
            strict: true,
          },
        },
      });
      const usage = normalizeUsage(response.usage);
      const requestId = responseRequestId(response);
      const responseError = response.error;

      const failResponse = (
        failureClass: AiSummaryProviderFailureClass,
        providerCode: string | null,
      ): never => {
        throw new AiSummaryProviderError({
          failureClass,
          status: null,
          providerCode,
          providerRequestId: requestId,
          model: input.model,
          durationMs: durationMsSince(startedAtMs),
          usage,
        });
      };

      if (responseError) {
        const providerCode = safeString(responseError.code);
        failResponse(
          classifyProviderError(
            { status: null, providerCode, providerRequestId: requestId },
            responseError,
          ),
          providerCode,
        );
      }

      if (response.status === 'incomplete') {
        failResponse('incomplete_output', null);
      }

      if (responseHasRefusal(response.output)) {
        failResponse('refused', null);
      }

      if (!response.output_text) {
        failResponse('invalid_structured_output', null);
      }

      let output: unknown;
      try {
        output = JSON.parse(response.output_text) as unknown;
      } catch {
        failResponse('invalid_structured_output', null);
      }

      return {
        output,
        usage,
        providerRequestId: requestId,
        providerDurationMs: durationMsSince(startedAtMs),
      };
    } catch (error) {
      if (isAiSummaryProviderError(error)) {
        throw error;
      }

      const details = safeProviderErrorDetails(error);
      throw new AiSummaryProviderError({
        failureClass: classifyProviderError(details, error),
        status: details.status,
        providerCode: details.providerCode,
        providerRequestId: details.providerRequestId,
        model: input.model,
        durationMs: durationMsSince(startedAtMs),
        usage: null,
      });
    }
  }
}
