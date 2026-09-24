import { describe, expect, it } from 'vitest';
import { validateVideoMetadata } from '../scripts/verify-output.mjs';

describe('output metadata', () => {
  const flagshipRules = {
    width: 1920,
    height: 1080,
    minSeconds: 1,
    maxSeconds: 115,
  };
  const tiktokRules = {
    width: 1080,
    height: 1920,
    minSeconds: 20,
    maxSeconds: 30,
  };
  it('accepts the flagship format', () =>
    expect(
      validateVideoMetadata(
        {
          width: 1920,
          height: 1080,
          fps: 30,
          durationSeconds: 115,
          codec: 'h264',
        },
        flagshipRules
      )
    ).toEqual([]));
  it('rejects videos outside approved duration limits', () => {
    expect(
      validateVideoMetadata(
        {
          width: 1920,
          height: 1080,
          fps: 30,
          durationSeconds: 116,
          codec: 'h264',
        },
        flagshipRules
      )
    ).toContain('duration must be <= 115 seconds');
    expect(
      validateVideoMetadata(
        {
          width: 1080,
          height: 1920,
          fps: 30,
          durationSeconds: 19,
          codec: 'h264',
        },
        tiktokRules
      )
    ).toContain('duration must be >= 20 seconds');
  });
});
