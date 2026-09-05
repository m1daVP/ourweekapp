export const TASK_SWIPE_THRESHOLD_RATIO = 0.25;
export const TASK_SWIPE_INTENT_PX = 8;

export function clampTaskSwipeOffset(
  deltaX: number,
  width: number,
  canFinish: boolean
) {
  if (width <= 0) {
    return 0;
  }

  return Math.max(-width, Math.min(canFinish ? width : 0, deltaX));
}

export function hasReachedTaskSwipeThreshold(
  offsetX: number,
  width: number,
  thresholdRatio = TASK_SWIPE_THRESHOLD_RATIO
) {
  return width > 0 && Math.abs(offsetX) >= width * thresholdRatio;
}

export function isHorizontalTaskSwipe(
  deltaX: number,
  deltaY: number,
  intentPx = TASK_SWIPE_INTENT_PX
) {
  return Math.abs(deltaX) >= intentPx && Math.abs(deltaX) > Math.abs(deltaY);
}

export function shouldSuppressClickAfterTaskSwipe(
  maxOffsetX: number,
  intentPx = TASK_SWIPE_INTENT_PX
) {
  return Math.abs(maxOffsetX) >= intentPx;
}
