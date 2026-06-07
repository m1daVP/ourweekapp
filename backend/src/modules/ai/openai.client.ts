import OpenAI from 'openai';

export type AiSummaryProvider = {
  generateMeetingSummary(input: {
    systemPrompt: string;
    userPrompt: string;
    model: string;
  }): Promise<unknown>;
};

export class OpenAiSummaryProvider implements AiSummaryProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateMeetingSummary(input: {
    systemPrompt: string;
    userPrompt: string;
    model: string;
  }) {
    const response = await this.client.chat.completions.create({
      model: input.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: input.systemPrompt },
        { role: 'user', content: input.userPrompt },
      ],
    });
    const content = response.choices[0]?.message.content;

    if (!content) {
      return null;
    }

    return JSON.parse(content) as unknown;
  }
}
