export const SWIPE_DELETE_THRESHOLD_RATIO = 0.5;
export const SWIPE_DELETE_INTENT_PX = 8;

export function clampLeftSwipeOffset(deltaX: number, width: number) {
  if (width <= 0) {
    return 0;
  }

  return Math.min(0, Math.max(-width, deltaX));
}

export function hasReachedDeleteThreshold(
  offsetX: number,
  width: number,
  thresholdRatio = SWIPE_DELETE_THRESHOLD_RATIO
) {
  return width > 0 && Math.abs(offsetX) >= width * thresholdRatio;
}

export function isHorizontalDeleteSwipe(
  deltaX: number,
  deltaY: number,
  intentPx = SWIPE_DELETE_INTENT_PX
) {
  return (
    deltaX <= -intentPx &&
    Math.abs(deltaX) > Math.abs(deltaY) &&
    Math.abs(deltaX) >= intentPx
  );
}

export function shouldSuppressClickAfterSwipe(
  maxOffsetX: number,
  intentPx = SWIPE_DELETE_INTENT_PX
) {
  return Math.abs(maxOffsetX) >= intentPx;
}
