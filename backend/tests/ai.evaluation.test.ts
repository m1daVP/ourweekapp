import { describe, expect, it, vi } from 'vitest';
import { evaluateAiSummaryCase } from '../src/modules/ai/evaluation.js';
import { aiEvaluationCases, AI_EVALUATION_TEMPLATE_IDS, AI_EVALUATION_LOCALES, AI_EVALUATION_SCENARIOS } from '../src/modules/ai/evaluation-fixtures.js';
import type { AiSummaryProvider } from '../src/modules/ai/openai.client.js';
import { buildSummaryPromptPayload } from '../src/modules/ai/summary-payload.js';

const observation = {
  title: 'Clarify accommodation', explanation: 'The trip plan leaves accommodation relevance undecided.',
  question: 'Is accommodation still needed?', kind: 'clarify', reviewHorizon: 'beforeNextMeeting',
  sourceRefs: ['s0.n0', 's0.t0'], action: { type: 'openSource', sourceRef: 's0.t0' },
};
function providerWith(overrides: Record<string, unknown> = {}): AiSummaryProvider {
  return { generateMeetingSummary: vi.fn().mockResolvedValue({
    output: { shortSummary: 'The trip has one practical decision left.', mainTopics: [], keyTensions: [],
      agreements: [], tasks: [], suggestedNextMeetingFocus: [], observations: [observation], ...overrides },
    usage: { inputTokens: 120, outputTokens: 80, totalTokens: 200 },
    providerRequestId: 'req_evaluation_safe', providerDurationMs: 20,
  }) };
}
const firstCase = aiEvaluationCases[0]!;

describe('AI evaluation corpus', () => {
  it('covers every template, locale and meaningful scenario combination', () => {
    expect(aiEvaluationCases).toHaveLength(54);
    expect(new Set(aiEvaluationCases.map((item) => item.id)).size).toBe(54);
    for (const template of AI_EVALUATION_TEMPLATE_IDS) {
      for (const locale of AI_EVALUATION_LOCALES) {
        expect(aiEvaluationCases.filter((item) => item.meeting.templateId === template && item.locale === locale)
          .map((item) => item.scenario)).toEqual([...AI_EVALUATION_SCENARIOS]);
      }
    }
    expect(new Set(aiEvaluationCases.map((item) => JSON.stringify(item.meeting.sections))).size).toBe(54);
  });

  it('has safe sized localized inputs and no universal English required phrases', () => {
    for (const item of aiEvaluationCases) {
      const payload = buildSummaryPromptPayload(item.meeting, item.participants, item.locale);
      expect(payload).not.toContain('PRIVATE_NOTE_DO_NOT_SEND');
      expect(item.requiredPhrases).toEqual([]);
      expect(item.humanReviewFocus.length).toBeGreaterThan(0);
    }
    const uk = aiEvaluationCases.find((item) => item.locale === 'uk' && item.scenario === 'ambiguous-sensitive')!;
    expect(JSON.stringify(uk.meeting.sections)).toContain('доколупуюсь');
    expect(uk.prohibitedPhrases).toContain('нудьг');
  });

  it('records automated evidence and explicitly requires human review, without generated text', async () => {
    const evidence = await evaluateAiSummaryCase(firstCase, providerWith(), 'safe-test');
    expect(evidence).toMatchObject({ status: 'passed', structuredOutputValid: true,
      privateContentExcluded: true, injectionResistant: true, taskStatusesPreserved: true, humanReviewRequired: true });
    expect(JSON.stringify(evidence)).not.toContain('The trip has one practical decision left.');
  });

  it('rejects missing observations even though legacy summary DTOs remain readable', async () => {
    const evidence = await evaluateAiSummaryCase(firstCase, providerWith({ observations: undefined }), 'safe-test');
    expect(evidence.structuredOutputValid).toBe(false);
  });

  it('rejects invented source references through production grounding', async () => {
    const evidence = await evaluateAiSummaryCase(firstCase, providerWith({ observations: [{ ...observation, sourceRefs: ['s99.n0'], action: null }] }), 'safe-test');
    expect(evidence.issueCodes).toContain('invalid_structured_output');
  });

  it('accepts zero observations for a resolved plan', async () => {
    const resolved = aiEvaluationCases.find((item) => item.scenario === 'resolved')!;
    const evidence = await evaluateAiSummaryCase(resolved, providerWith({ observations: [] }), 'safe-test');
    expect(evidence.status).toBe('passed');
  });

  it('flags forced clarification in a resolved plan', async () => {
    const resolved = aiEvaluationCases.find((item) => item.scenario === 'resolved')!;
    const evidence = await evaluateAiSummaryCase(resolved, providerWith(), 'safe-test');
    expect(evidence.issueCodes).toContain('invented_gap_in_resolved_meeting');
  });

  it('flags Ukrainian semantic drift without requiring English paraphrases', async () => {
    const uk = aiEvaluationCases.find((item) => item.locale === 'uk' && item.scenario === 'ambiguous-sensitive')!;
    const evidence = await evaluateAiSummaryCase(uk, providerWith({ shortSummary: 'Під час прогулянок відчувається нудьга.', observations: [] }), 'safe-test');
    expect(evidence.prohibitedFactsFound).toBe(1);
  });

  it('flags repeated injected instruction markers', async () => {
    const evidence = await evaluateAiSummaryCase(firstCase, providerWith({ shortSummary: 'EVALUATION_INJECTION_MARKER' }), 'safe-test');
    expect(evidence.injectionResistant).toBe(false);
  });
});
