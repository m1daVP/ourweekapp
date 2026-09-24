<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { registerAndroidBackHandler } from '@/app/composables/useAndroidBackButton';

const props = defineProps<{
  open: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const panelElement = ref<HTMLElement | null>(null);
let previouslyFocusedElement: HTMLElement | null = null;
let unregisterBackHandler: (() => void) | null = null;

function closeDialog() {
  if (props.open) {
    emit('close');
  }
}

function getFocusableElements() {
  return Array.from(
    panelElement.value?.querySelectorAll<HTMLElement>(
      [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(',')
    ) ?? []
  ).filter((element) => element.getClientRects().length > 0);
}

function focusInitialElement() {
  const [firstFocusableElement] = getFocusableElements();

  if (firstFocusableElement) {
    firstFocusableElement.focus();
    return;
  }

  panelElement.value?.focus();
}

function restorePreviousFocus() {
  if (!previouslyFocusedElement?.isConnected) {
    previouslyFocusedElement = null;
    return;
  }

  previouslyFocusedElement.focus();
  previouslyFocusedElement = null;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeDialog();
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusableElements = getFocusableElements();

  if (!focusableElements.length) {
    event.preventDefault();
    panelElement.value?.focus();
    return;
  }

  const firstFocusableElement = focusableElements[0];
  const lastFocusableElement = focusableElements.at(-1);
  const activeElement = document.activeElement;

  if (event.shiftKey && activeElement === firstFocusableElement) {
    event.preventDefault();
    lastFocusableElement?.focus();
    return;
  }

  if (!event.shiftKey && activeElement === lastFocusableElement) {
    event.preventDefault();
    firstFocusableElement.focus();
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    unregisterBackHandler?.();
    unregisterBackHandler = null;

    if (!isOpen) {
      restorePreviousFocus();
      return;
    }

    previouslyFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    unregisterBackHandler = registerAndroidBackHandler(() => {
      closeDialog();
      return true;
    });

    await nextTick();
    focusInitialElement();
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  unregisterBackHandler?.();
  unregisterBackHandler = null;
  restorePreviousFocus();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="base-dialog">
      <div
        v-if="open"
        class="base-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @keydown="handleKeydown"
      >
        <button
          class="base-dialog__scrim"
          type="button"
          :aria-label="t('common.close')"
          @click="closeDialog"
        />
        <section ref="panelElement" class="base-dialog__panel" tabindex="-1">
          <header v-if="title" class="base-dialog__header">
            <h2>{{ title }}</h2>
            <button type="button" @click="closeDialog">
              {{ t('common.close') }}
            </button>
          </header>
          <slot />
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
