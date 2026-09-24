import {
  computed,
  onMounted,
  onUnmounted,
  readonly,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue';
import { haptics } from '@/shared/services/hapticsService';

export const PULL_ACTIVATION_PX = 8;
export const PULL_THRESHOLD_PX = 72;
export const PULL_MAX_DISTANCE_PX = 104;

const PULL_RESISTANCE = 0.55;
const REFRESH_HOLD_DISTANCE_PX = 48;

export type PullToRefreshPhase = 'idle' | 'pulling' | 'ready' | 'refreshing';

export type PullGestureClassification = 'pending' | 'cancelled' | 'pulling';

export interface UsePullToRefreshOptions {
  container: Ref<HTMLElement | null>;
  enabled: ComputedRef<boolean>;
  onRefresh: () => Promise<void>;
}

export function calculatePullDistance(deltaY: number) {
  return Math.min(PULL_MAX_DISTANCE_PX, Math.max(0, deltaY) * PULL_RESISTANCE);
}

export function classifyPullGesture(
  deltaX: number,
  deltaY: number
): PullGestureClassification {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (
    horizontalDistance < PULL_ACTIVATION_PX &&
    verticalDistance < PULL_ACTIVATION_PX
  ) {
    return 'pending';
  }

  if (deltaY <= 0 || horizontalDistance > verticalDistance) {
    return 'cancelled';
  }

  return 'pulling';
}

export function getPullToRefreshPhase(
  distance: number,
  refreshing: boolean
): PullToRefreshPhase {
  if (refreshing) {
    return 'refreshing';
  }

  if (distance <= 0) {
    return 'idle';
  }

  return distance >= PULL_THRESHOLD_PX ? 'ready' : 'pulling';
}

export function shouldPulseOnPullReadyTransition(
  previousPhase: PullToRefreshPhase,
  nextPhase: PullToRefreshPhase
) {
  return (
    nextPhase === 'ready' &&
    previousPhase !== 'ready' &&
    previousPhase !== 'refreshing'
  );
}

export function usePullToRefresh({
  container,
  enabled,
  onRefresh,
}: UsePullToRefreshOptions) {
  const pullDistance = ref(0);
  const isRefreshing = ref(false);
  let startX = 0;
  let startY = 0;
  let isTracking = false;
  let isCaptured = false;
  let listenerTarget: HTMLElement | null = null;
  let previousPullPhase: PullToRefreshPhase = 'idle';

  const phase = computed(() =>
    getPullToRefreshPhase(pullDistance.value, isRefreshing.value)
  );

  function resetTracking() {
    startX = 0;
    startY = 0;
    isTracking = false;
    isCaptured = false;
  }

  function resetGesture() {
    resetTracking();
    pullDistance.value = 0;
    previousPullPhase = 'idle';
  }

  function handleTouchStart(event: TouchEvent) {
    const target = container.value;

    if (
      !target ||
      !enabled.value ||
      isRefreshing.value ||
      target.scrollTop > 0 ||
      event.touches.length !== 1
    ) {
      resetGesture();
      return;
    }

    const touch = event.touches[0];

    startX = touch.clientX;
    startY = touch.clientY;
    isTracking = true;
    isCaptured = false;
  }

  function handleTouchMove(event: TouchEvent) {
    const target = container.value;

    if (
      !target ||
      !isTracking ||
      isRefreshing.value ||
      event.touches.length !== 1
    ) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const classification = classifyPullGesture(deltaX, deltaY);

    if (classification === 'cancelled' || target.scrollTop > 0) {
      resetGesture();
      return;
    }

    if (classification === 'pending') {
      return;
    }

    isCaptured = true;
    pullDistance.value = calculatePullDistance(deltaY);
    const nextPullPhase = getPullToRefreshPhase(
      pullDistance.value,
      isRefreshing.value
    );

    if (shouldPulseOnPullReadyTransition(previousPullPhase, nextPullPhase)) {
      void haptics.refreshReady();
    }

    previousPullPhase = nextPullPhase;

    if (event.cancelable) {
      event.preventDefault();
    }
  }

  async function finishPull() {
    const shouldRefresh = isCaptured && pullDistance.value >= PULL_THRESHOLD_PX;

    resetTracking();

    if (!shouldRefresh || isRefreshing.value) {
      pullDistance.value = 0;
      previousPullPhase = 'idle';
      return;
    }

    isRefreshing.value = true;
    pullDistance.value = REFRESH_HOLD_DISTANCE_PX;
    previousPullPhase = 'refreshing';

    try {
      await onRefresh();
    } finally {
      isRefreshing.value = false;
      pullDistance.value = 0;
      previousPullPhase = 'idle';
    }
  }

  function handleTouchEnd() {
    if (!isTracking) {
      return;
    }

    void finishPull();
  }

  function handleTouchCancel() {
    if (!isRefreshing.value) {
      resetGesture();
    }
  }

  function removeListeners() {
    if (!listenerTarget) {
      return;
    }

    listenerTarget.removeEventListener('touchstart', handleTouchStart);
    listenerTarget.removeEventListener('touchmove', handleTouchMove);
    listenerTarget.removeEventListener('touchend', handleTouchEnd);
    listenerTarget.removeEventListener('touchcancel', handleTouchCancel);
    listenerTarget = null;
  }

  onMounted(() => {
    listenerTarget = container.value;

    if (!listenerTarget) {
      return;
    }

    listenerTarget.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    listenerTarget.addEventListener('touchmove', handleTouchMove, {
      passive: false,
    });
    listenerTarget.addEventListener('touchend', handleTouchEnd, {
      passive: true,
    });
    listenerTarget.addEventListener('touchcancel', handleTouchCancel, {
      passive: true,
    });
  });

  onUnmounted(() => {
    removeListeners();
    resetGesture();
  });

  watch(enabled, (isEnabled) => {
    if (!isEnabled) {
      resetGesture();
    }
  });

  return {
    phase,
    pullDistance: readonly(pullDistance),
    isRefreshing: readonly(isRefreshing),
  };
}
