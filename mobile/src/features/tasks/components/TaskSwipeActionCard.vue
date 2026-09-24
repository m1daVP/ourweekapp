<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Participant } from '@/features/participants/types';
import type { TaskStatus } from '@/features/tasks/types';
import ParticipantAvatar from '@/features/participants/components/ParticipantAvatar.vue';
import { haptics } from '@/shared/services/hapticsService';
import {
  clampTaskSwipeOffset,
  hasReachedTaskSwipeThreshold,
  isHorizontalTaskSwipe,
  shouldPulseOnTaskSwipeReadyTransition,
  shouldSuppressClickAfterTaskSwipe,
  TASK_SWIPE_INTENT_PX,
} from '@/features/tasks/taskSwipeActions';

type TaskCardTone = 'default' | 'danger';
type TaskCardAccessory = 'avatars' | 'badge' | 'none';

const props = defineProps<{
  title: string;
  status: TaskStatus;
  metadataIcon: string;
  metadataText: string;
  metadataTone: TaskCardTone;
  participants: Participant[];
  accessory: TaskCardAccessory;
  badgeCount?: number;
  canToggle: boolean;
  canFinish: boolean;
  canRemove: boolean;
  isCompleting: boolean;
  toggleLabel: string;
  finishLabel: string;
  removeLabel: string;
}>();

const emit = defineEmits<{
  open: [];
  toggleStatus: [];
  finish: [];
  requestDelete: [];
}>();

const offsetX = ref(0);
const cardWidth = ref(0);
const isDragging = ref(false);
const isSwipeGesture = ref(false);
const suppressNextOpen = ref(false);
const wasActionReady = ref(false);

let pointerId: number | null = null;
let pointerTarget: HTMLElement | null = null;
let startX = 0;
let startY = 0;
let maxOffsetX = 0;

const cardStyle = computed(() => ({
  transform: `translateX(${offsetX.value}px)`,
}));
const isFinishReady = computed(
  () =>
    offsetX.value > 0 &&
    hasReachedTaskSwipeThreshold(offsetX.value, cardWidth.value)
);
const isDeleteReady = computed(
  () =>
    offsetX.value < 0 &&
    hasReachedTaskSwipeThreshold(offsetX.value, cardWidth.value)
);

function resetSwipe() {
  offsetX.value = 0;
  isDragging.value = false;
  isSwipeGesture.value = false;
  wasActionReady.value = false;
  pointerId = null;
  pointerTarget = null;
}

function updateActionReadyFeedback() {
  const isActionReady = isFinishReady.value || isDeleteReady.value;

  if (
    shouldPulseOnTaskSwipeReadyTransition(wasActionReady.value, isActionReady)
  ) {
    void haptics.refreshReady();
  }

  wasActionReady.value = isActionReady;
}

function releasePointerCapture() {
  if (
    pointerId === null ||
    !pointerTarget?.hasPointerCapture?.(pointerId) ||
    !pointerTarget.releasePointerCapture
  ) {
    return;
  }

  pointerTarget.releasePointerCapture(pointerId);
}

function handlePointerDown(event: PointerEvent) {
  if (event.button !== 0 || props.isCompleting) {
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
    if (isHorizontalTaskSwipe(deltaX, deltaY)) {
      isSwipeGesture.value = true;
      pointerTarget?.setPointerCapture?.(event.pointerId);
    } else if (
      Math.abs(deltaY) >= TASK_SWIPE_INTENT_PX &&
      Math.abs(deltaY) > Math.abs(deltaX)
    ) {
      resetSwipe();
      return;
    } else {
      return;
    }
  }

  event.preventDefault();
  const canMoveInDirection =
    deltaX > 0 ? props.canFinish : deltaX < 0 ? props.canRemove : true;
  offsetX.value = canMoveInDirection
    ? clampTaskSwipeOffset(deltaX, cardWidth.value, props.canFinish)
    : 0;
  updateActionReadyFeedback();

  if (Math.abs(deltaX) > Math.abs(maxOffsetX)) {
    maxOffsetX = deltaX;
  }
}

function handlePointerEnd(event: PointerEvent) {
  if (!isDragging.value || event.pointerId !== pointerId) {
    return;
  }

  const shouldFinish = props.canFinish && isFinishReady.value;
  const shouldRequestDelete = props.canRemove && isDeleteReady.value;
  suppressNextOpen.value = shouldSuppressClickAfterTaskSwipe(maxOffsetX);

  releasePointerCapture();
  resetSwipe();

  if (shouldFinish) {
    emit('finish');
    return;
  }

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

function handleOpen(event: MouseEvent) {
  if (suppressNextOpen.value) {
    event.preventDefault();
    event.stopPropagation();
    suppressNextOpen.value = false;
    return;
  }

  emit('open');
}
</script>

<template>
  <li
    :class="[
      'task-swipe-card',
      {
        'is-done': status === 'done',
        'is-completing': isCompleting,
        'is-swiping': offsetX !== 0,
        'is-swiping-right': offsetX > 0,
        'is-swiping-left': offsetX < 0,
        'is-dragging': isSwipeGesture,
        'is-finish-ready': isFinishReady,
        'is-delete-ready': isDeleteReady,
      },
    ]"
  >
    <div class="task-swipe-card__frame">
      <div class="task-swipe-card__finish-underlay" aria-hidden="true">
        <span class="material-symbols-outlined">check_circle</span>
        <span>{{ finishLabel }}</span>
      </div>
      <div class="task-swipe-card__delete-underlay" aria-hidden="true">
        <span>{{ removeLabel }}</span>
        <span class="material-symbols-outlined">delete</span>
      </div>
      <div
        :class="[
          'task-card',
          'task-swipe-card__surface',
          {
            'is-done': status === 'done',
            'is-completing': isCompleting,
          },
        ]"
        :style="cardStyle"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerEnd"
        @pointercancel="handlePointerCancel"
      >
        <button
          type="button"
          class="task-card__checkbox"
          :class="{ 'is-checked': status === 'done' }"
          :aria-label="toggleLabel"
          :disabled="!canToggle || isCompleting"
          @click.stop="emit('toggleStatus')"
        >
          <span class="material-symbols-outlined" aria-hidden="true">
            check
          </span>
        </button>
        <button
          type="button"
          class="task-card__content"
          :disabled="isCompleting"
          @click="handleOpen"
        >
          <strong>{{ title }}</strong>
          <span
            class="task-card__metadata"
            :class="{ 'is-danger': metadataTone === 'danger' }"
          >
            <span class="material-symbols-outlined" aria-hidden="true">
              {{ metadataIcon }}
            </span>
            {{ metadataText }}
          </span>
        </button>
        <div class="task-card__side" aria-hidden="true">
          <div v-if="accessory === 'avatars'" class="task-avatar-stack">
            <ParticipantAvatar
              v-for="participant in participants.slice(0, 2)"
              :key="participant.id"
              class="task-avatar"
              :participant="participant"
              decorative
            />
          </div>
          <span v-else-if="accessory === 'badge'" class="task-count">
            {{ badgeCount }}
          </span>
        </div>
      </div>
    </div>
    <button
      v-if="canRemove"
      type="button"
      class="task-swipe-card__remove-accessible"
      @click="emit('requestDelete')"
    >
      {{ removeLabel }}
    </button>
  </li>
</template>
