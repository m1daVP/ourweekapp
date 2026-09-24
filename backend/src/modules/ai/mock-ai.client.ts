import type { AiSummaryProvider } from './openai.client.js';

export class MockAiSummaryProvider implements AiSummaryProvider {
  async generateMeetingSummary() {
    return {
      output: {
        observations: [],
        shortSummary:
          'Mock summary: this meeting was summarized with the local mock AI provider.',
        mainTopics: ['Mock main topic'],
        keyTensions: [],
        agreements: ['Mock agreement'],
        tasks: [],
        suggestedNextMeetingFocus: [
          'Review this mock summary before using real AI output',
        ],
      },
      usage: null,
      providerRequestId: null,
      providerDurationMs: 0,
    };
  }
}
