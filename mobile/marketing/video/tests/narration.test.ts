import { describe, expect, it } from 'vitest';
import { shipatonBrief } from '../src/content/shipaton.js';
import { buildNarrationRequest } from '../scripts/generate-narration.mjs';

describe('narration generation', () => {
  it('uses the approved speech settings', () => {
    expect(buildNarrationRequest('Hello')).toMatchObject({
      model: 'gpt-4o-mini-tts',
      voice: 'marin',
      response_format: 'wav',
    });
    expect(buildNarrationRequest('Hello').instructions).toContain(
      'Warm, calm, grounded'
    );
  });
  it('keeps the flagship request below the speech endpoint limit', () =>
    expect(
      shipatonBrief.clips.map((clip) => clip.narration).join(' ').length
    ).toBeLessThan(4096));
});
