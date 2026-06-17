<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  clampLeftSwipeOffset,
  hasReachedDeleteThreshold,
  isHorizontalDeleteSwipe,
  shouldSuppressClickAfterSwipe,
  SWIPE_DELETE_INTENT_PX,
} from '@/features/meeting/swipeToDelete';

defineProps<{
  title: string;
  subtitle: string;
  deleteLabel: string;
}>();

const emit = defineEmits<{
  open: [];
  requestDelete: [];
}>();

const offsetX = ref(0);
const cardWidth = ref(0);
const isDragging = ref(false);
const isSwipeGesture = ref(false);
const suppressNextClick = ref(false);

let pointerId: number | null = null;
let startX = 0;
let startY = 0;
let maxOffsetX = 0;
let pointerTarget: HTMLElement | null = null;

const isDeleteReady = computed(() =>
  hasReachedDeleteThreshold(offsetX.value, cardWidth.value)
);
const cardStyle = computed(() => ({
  transform: `translateX(${offsetX.value}px)`,
}));

function resetSwipe() {
  offsetX.value = 0;
  isDragging.value = false;
  isSwipeGesture.value = false;
  pointerId = null;
  pointerTarget = null;
}

function releasePointerCapture() {
  if (pointerId === null || !pointerTarget?.hasPointerCapture(pointerId)) {
    return;
  }

  pointerTarget.releasePointerCapture(pointerId);
}

function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }

  const target = event.currentTarget;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  pointerId = event.pointerId;
  pointerTarget = target;
  startX = event.clientX;
  startY = event.clientY;
  maxOffsetX = 0;
  cardWidth.value = target.getBoundingClientRect().width;
  isDragging.value = true;
  isSwipeGesture.value = false;
}

function handlePointerMove(event: PointerEvent) {
  if (!isDragging.value || event.pointerId !== pointerId) {
    return;
  }

  const deltaX = event.clientX - startX;
  const deltaY = event.clientY - startY;

  if (!isSwipeGesture.value) {
    if (isHorizontalDeleteSwipe(deltaX, deltaY)) {
      isSwipeGesture.value = true;
      pointerTarget?.setPointerCapture(pointerId);
    } else if (
      Math.abs(deltaY) >= SWIPE_DELETE_INTENT_PX &&
      Math.abs(deltaY) > Math.abs(deltaX)
    ) {
      resetSwipe();
      return;
    } else {
      return;
    }
  }

  event.preventDefault();
  offsetX.value = clampLeftSwipeOffset(deltaX, cardWidth.value);
  maxOffsetX = Math.min(maxOffsetX, offsetX.value);
}

function handlePointerEnd(event: PointerEvent) {
  if (!isDragging.value || event.pointerId !== pointerId) {
    return;
  }

  const shouldRequestDelete = isDeleteReady.value;
  suppressNextClick.value = shouldSuppressClickAfterSwipe(maxOffsetX);

  releasePointerCapture();
  resetSwipe();

  if (shouldRequestDelete) {
    emit('requestDelete');
  }
}

function handlePointerCancel(event: PointerEvent) {
  if (event.pointerId !== pointerId) {
    return;
  }

  releasePointerCapture();
  resetSwipe();
}

function handleClick(event: MouseEvent) {
  if (suppressNextClick.value) {
    event.preventDefault();
    event.stopPropagation();
    suppressNextClick.value = false;
    return;
  }

  emit('open');
}
</script>

<template>
  <li
    :class="[
      'history-progress-card',
      {
        'is-swiping': offsetX < 0,
        'is-dragging': isSwipeGesture,
        'is-delete-ready': isDeleteReady,
      },
    ]"
  >
    <div class="history-progress-card__swipe-frame">
      <div class="history-progress-card__delete-underlay" aria-hidden="true">
        <span
          class="history-progress-card__delete-icon material-symbols-outlined"
        >
          delete
        </span>
      </div>
      <button
        type="button"
        class="history-progress-card__button"
        :style="cardStyle"
        @click="handleClick"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerEnd"
        @pointercancel="handlePointerCancel"
      >
        <span class="history-progress-card__icon" aria-hidden="true">
          <span class="material-symbols-outlined">edit_document</span>
        </span>
        <span class="history-progress-card__copy">
          <strong>{{ title }}</strong>
          <small>{{ subtitle }}</small>
        </span>
        <span
          class="history-card__chevron material-symbols-outlined"
          aria-hidden="true"
        >
          chevron_right
        </span>
      </button>
    </div>
    <button
      type="button"
      class="history-progress-card__delete-accessible"
      @click="emit('requestDelete')"
    >
      {{ deleteLabel }}
    </button>
  </li>
</template>
