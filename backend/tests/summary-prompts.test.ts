import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SUMMARY_MODEL,
  buildSummarySystemPrompt,
  resolveSummaryPromptConfiguration,
} from '../src/modules/ai/summary-prompts.js';

describe('summary prompt configuration', () => {
  it.each([
    ['weekly-family-check-in', 'gpt-5.4-nano', 'weekly-family-check-in-v2'],
    ['family-with-kids', 'gpt-5.4-nano', 'family-with-kids-v2'],
    ['money-check-in', 'gpt-5.4-nano', 'money-check-in-v2'],
    ['busy-week-planning', 'gpt-5.4-nano', 'busy-week-planning-v2'],
    ['couple-reset', 'gpt-5-mini', 'couple-reset-v2'],
    ['conflict-cleanup', 'gpt-5-mini', 'conflict-cleanup-v2'],
  ])('uses the configured pair for %s', (templateId, model, promptVersion) => {
    expect(resolveSummaryPromptConfiguration(templateId, 'operator-fallback')).toEqual({
      model,
      promptVersion,
    });
  });

  it('uses AI_MODEL only for unknown templates', () => {
    expect(resolveSummaryPromptConfiguration('custom-template', 'operator-fallback')).toEqual({
      model: 'operator-fallback',
      promptVersion: 'unknown-template-v2',
    });
  });

  it('uses the default only when an unknown template has no fallback', () => {
    expect(resolveSummaryPromptConfiguration('custom-template')).toEqual({
      model: DEFAULT_SUMMARY_MODEL,
      promptVersion: 'unknown-template-v2',
    });
  });

  it.each([
    ['en', 'English'],
    ['uk', 'Ukrainian'],
    ['es', 'Spanish'],
  ] as const)('requires every visible value in %s', (locale, language) => {
    const prompt = buildSummarySystemPrompt('weekly-family-check-in', locale);

    expect(prompt).toContain(`Write every user-visible output value in ${language}.`);
    expect(prompt).toContain(
      'shortSummary, mainTopics, keyTensions, agreements, task titles, and suggestedNextMeetingFocus',
    );
  });
});
