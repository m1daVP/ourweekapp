import { describe, expect, it } from 'vitest';
import {
  clampTaskSwipeOffset,
  hasReachedTaskSwipeThreshold,
  isHorizontalTaskSwipe,
  shouldSuppressClickAfterTaskSwipe,
} from '@/features/tasks/taskSwipeActions';

describe('task swipe actions', () => {
  it('reaches either action threshold at one quarter of the card width', () => {
    expect(hasReachedTaskSwipeThreshold(49, 200)).toBe(false);
    expect(hasReachedTaskSwipeThreshold(50, 200)).toBe(true);
    expect(hasReachedTaskSwipeThreshold(-50, 200)).toBe(true);
  });

  it('blocks a finish-direction drag for a completed task', () => {
    expect(clampTaskSwipeOffset(72, 200, false)).toBe(0);
    expect(clampTaskSwipeOffset(-72, 200, false)).toBe(-72);
  });

  it('clamps drags to the card width', () => {
    expect(clampTaskSwipeOffset(260, 200, true)).toBe(200);
    expect(clampTaskSwipeOffset(-260, 200, true)).toBe(-200);
  });

  it('requires clear horizontal motion in either direction', () => {
    expect(isHorizontalTaskSwipe(12, 4)).toBe(true);
    expect(isHorizontalTaskSwipe(-12, 4)).toBe(true);
    expect(isHorizontalTaskSwipe(6, 1)).toBe(false);
    expect(isHorizontalTaskSwipe(-12, 20)).toBe(false);
  });

  it('suppresses a following card click after a meaningful drag', () => {
    expect(shouldSuppressClickAfterTaskSwipe(7)).toBe(false);
    expect(shouldSuppressClickAfterTaskSwipe(-8)).toBe(true);
  });
});
