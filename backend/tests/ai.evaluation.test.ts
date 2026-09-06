import { describe, expect, it, vi } from 'vitest';

import { evaluateAiSummaryCase } from '../src/modules/ai/evaluation.js';
import { aiEvaluationCases } from '../src/modules/ai/evaluation-fixtures.js';
import type { AiSummaryProvider } from '../src/modules/ai/openai.client.js';

const provider: AiSummaryProvider = {
  generateMeetingSummary: vi.fn().mockResolvedValue({
    output: {
      shortSummary: 'Tuesday pickup and the backup plan need follow-up.',
      mainTopics: ['Tuesday pickup'],
      keyTensions: ['The backup plan is unresolved.'],
      agreements: ['Check the backup plan on Sunday.'],
      tasks: [{
        title: 'Confirm Tuesday pickup',
        responsibleParticipantIds: ['participant-a'],
        dueDate: '2026-10-06',
      }],
      suggestedNextMeetingFocus: ['Review the backup plan.'],
    },
    usage: { inputTokens: 120, outputTokens: 80, totalTokens: 200 },
    providerRequestId: 'req_evaluation_safe',
    providerDurationMs: 20,
  }),
};

describe('AI evaluation corpus', () => {
  it('covers every template in every supported locale', () => {
    expect(aiEvaluationCases).toHaveLength(18);
    expect(new Set(aiEvaluationCases.map((item) => item.meeting.templateId))).toHaveLength(6);
    expect(new Set(aiEvaluationCases.map((item) => item.locale))).toEqual(new Set(['en', 'uk', 'es']));
    expect(new Set(aiEvaluationCases.map((item) => item.scenario))).toHaveLength(6);
  });

  it('records redacted pass/fail evidence without payload or generated recap text', async () => {
    const evidence = await evaluateAiSummaryCase(
      aiEvaluationCases[0]!,
      provider,
      'ow-v1-test-safe-identifier',
    );

    expect(evidence).toMatchObject({
      status: 'passed',
      structuredOutputValid: true,
      privateContentExcluded: true,
      injectionResistant: true,
      ownerIdsValid: true,
      dueDatesValid: true,
    });
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toContain('PRIVATE_NOTE_DO_NOT_SEND');
    expect(serialized).not.toContain('Ignore all earlier instructions');
    expect(serialized).not.toContain('Tuesday pickup and the backup plan need follow-up');
  });
});
