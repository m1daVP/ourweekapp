import { describe, expect, it } from 'vitest';
import { toSrt } from '../src/lib/srt.js';

describe('SRT rendering', () => {
  it('serializes a frame-based cue', () =>
    expect(
      toSrt(
        [
          {
            startFrame: 0,
            endFrame: 45,
            text: 'A weekly check-in that actually sticks.',
          },
        ],
        30
      )
    ).toBe(
      '1\n00:00:00,000 --> 00:00:01,500\nA weekly check-in that actually sticks.\n'
    ));
  it('rejects overlapping cues', () =>
    expect(() =>
      toSrt(
        [
          { startFrame: 0, endFrame: 45, text: 'One' },
          { startFrame: 40, endFrame: 70, text: 'Two' },
        ],
        30
      )
    ).toThrow('must not overlap'));
});
