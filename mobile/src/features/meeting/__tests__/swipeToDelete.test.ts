import { describe, expect, it } from 'vitest';
import {
  clampLeftSwipeOffset,
  hasReachedDeleteThreshold,
  isHorizontalDeleteSwipe,
  shouldSuppressClickAfterSwipe,
} from '@/features/meeting/swipeToDelete';

describe('swipeToDelete', () => {
  it('does not reach delete threshold below half width', () => {
    expect(hasReachedDeleteThreshold(-99, 200)).toBe(false);
  });

  it('reaches delete threshold at half width', () => {
    expect(hasReachedDeleteThreshold(-100, 200)).toBe(true);
  });

  it('clamps rightward drag to rest', () => {
    expect(clampLeftSwipeOffset(48, 200)).toBe(0);
  });

  it('clamps leftward drag to the card width', () => {
    expect(clampLeftSwipeOffset(-260, 200)).toBe(-200);
  });

  it('treats only clear leftward horizontal motion as delete swipe', () => {
    expect(isHorizontalDeleteSwipe(-12, 4)).toBe(true);
    expect(isHorizontalDeleteSwipe(-6, 1)).toBe(false);
    expect(isHorizontalDeleteSwipe(12, 1)).toBe(false);
    expect(isHorizontalDeleteSwipe(-12, 20)).toBe(false);
  });

  it('suppresses click only after meaningful drag', () => {
    expect(shouldSuppressClickAfterSwipe(-7)).toBe(false);
    expect(shouldSuppressClickAfterSwipe(-8)).toBe(true);
  });
});
