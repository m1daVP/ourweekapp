import { describe, expect, it } from 'vitest';
import { shipatonBrief } from '../src/content/shipaton.js';
import { tiktokBriefs } from '../src/content/tiktok.js';
import { getBriefDurationFrames, secondsToFrames } from '../src/lib/timing.js';

describe('promo content boundaries', () => {
  it('converts seconds using the exact composition frame rate', () =>
    expect(secondsToFrames(1.5, 30)).toBe(45));
  it('keeps the flagship at or below 1:55', () =>
    expect(getBriefDurationFrames(shipatonBrief)).toBeLessThanOrEqual(
      115 * 30
    ));
  it('keeps each short in range with a two-second hook', () => {
    for (const brief of tiktokBriefs) {
      expect(getBriefDurationFrames(brief)).toBeGreaterThanOrEqual(20 * 30);
      expect(getBriefDurationFrames(brief)).toBeLessThanOrEqual(30 * 30);
      expect(brief.hook.endFrame).toBeLessThanOrEqual(2 * 30);
    }
  });
  it('uses only approved Shipaton categories and no OneSignal claim', () => {
    expect(shipatonBrief.categories).toEqual([
      'Grand Prize',
      'RevenueCat Design Award',
      'HAMM Award',
      'RevenueCat Peace Prize',
      '#BuildInPublic Award',
    ]);
    expect(JSON.stringify(shipatonBrief)).not.toMatch(
      /OneSignal|Keep Them Coming Back/i
    );
    expect(JSON.stringify(shipatonBrief)).toMatch(/local reminder/i);
  });
});
