import { describe, expect, it } from 'vitest';
import {
  PULL_ACTIVATION_PX,
  PULL_MAX_DISTANCE_PX,
  PULL_THRESHOLD_PX,
  calculatePullDistance,
  classifyPullGesture,
  getPullToRefreshPhase,
} from '@/shared/composables/usePullToRefresh';

describe('pull-to-refresh gesture helpers', () => {
  it('adds resistance and caps visible distance', () => {
    expect(calculatePullDistance(0)).toBe(0);
    expect(calculatePullDistance(40)).toBeLessThan(40);
    expect(calculatePullDistance(1000)).toBe(PULL_MAX_DISTANCE_PX);
  });

  it('accepts only activated downward vertical movement', () => {
    expect(classifyPullGesture(1, PULL_ACTIVATION_PX - 1)).toBe('pending');
    expect(classifyPullGesture(3, PULL_ACTIVATION_PX + 4)).toBe('pulling');
    expect(classifyPullGesture(20, 8)).toBe('cancelled');
    expect(classifyPullGesture(0, -10)).toBe('cancelled');
  });

  it('maps state to presentation phases', () => {
    expect(getPullToRefreshPhase(0, false)).toBe('idle');
    expect(getPullToRefreshPhase(PULL_THRESHOLD_PX - 1, false)).toBe('pulling');
    expect(getPullToRefreshPhase(PULL_THRESHOLD_PX, false)).toBe('ready');
    expect(getPullToRefreshPhase(0, true)).toBe('refreshing');
  });
});
