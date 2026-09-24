<script lang="ts">
export type ActionMenuItem = {
  id: string;
  label: string;
  icon?: string;
  variant?: 'default' | 'destructive';
  dividerBefore?: boolean;
  disabled?: boolean;
};

export type ActionMenuAnchor = 'top-right' | 'center';
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { registerAndroidBackHandler } from '@/app/composables/useAndroidBackButton';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    items: ActionMenuItem[];
    anchor?: ActionMenuAnchor;
    closeOnSelect?: boolean;
    ariaLabel?: string;
    closeLabel?: string;
  }>(),
  {
    anchor: 'top-right',
    closeOnSelect: true,
    ariaLabel: 'Action menu',
    closeLabel: 'Close menu',
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  select: [itemId: string];
  close: [];
}>();

const panelElement = ref<HTMLElement | null>(null);
let previouslyFocusedElement: HTMLElement | null = null;

const popupClasses = computed(() => [
  'action-menu-popup',
  `action-menu-popup--${props.anchor}`,
]);

function closeMenu() {
  if (!props.modelValue) {
    return;
  }

  emit('update:modelValue', false);
  emit('close');
}

function selectItem(item: ActionMenuItem) {
  if (item.disabled) {
    return;
  }

  emit('select', item.id);

  if (props.closeOnSelect) {
    closeMenu();
  }
}

function getEnabledItemButtons() {
  return Array.from(
    panelElement.value?.querySelectorAll<HTMLButtonElement>(
      '.action-menu-popup__item:not(:disabled)'
    ) ?? []
  );
}

function focusFirstItem() {
  const [firstButton] = getEnabledItemButtons();
  (firstButton ?? panelElement.value)?.focus();
}

function restoreFocus() {
  previouslyFocusedElement?.focus();
  previouslyFocusedElement = null;
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (!props.modelValue) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeMenu();
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const buttons = getEnabledItemButtons();

  if (!buttons.length) {
    return;
  }

  const firstButton = buttons[0];
  const lastButton = buttons[buttons.length - 1];
  const activeElement = document.activeElement;

  if (event.shiftKey) {
    if (
      activeElement === firstButton ||
      !panelElement.value?.contains(activeElement)
    ) {
      event.preventDefault();
      lastButton.focus();
    }

    return;
  }

  if (activeElement === lastButton) {
    event.preventDefault();
    firstButton.focus();
  }
}

const unregisterAndroidBackHandler = registerAndroidBackHandler(() => {
  if (!props.modelValue) {
    return false;
  }

  closeMenu();
  return true;
});

watch(
  () => props.modelValue,
  async (isOpen) => {
    document.removeEventListener('keydown', handleDocumentKeydown);

    if (!isOpen) {
      restoreFocus();
      return;
    }

    previouslyFocusedElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.addEventListener('keydown', handleDocumentKeydown);
    await nextTick();
    focusFirstItem();
  }
);

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleDocumentKeydown);
  unregisterAndroidBackHandler();
});
</script>

<template>
  <Teleport to="body">
    <Transition name="action-menu-popup">
      <div v-if="modelValue" :class="popupClasses" role="presentation">
        <button
          class="action-menu-popup__scrim"
          type="button"
          :aria-label="closeLabel"
          @click="closeMenu"
        />
        <section
          ref="panelElement"
          class="action-menu-popup__panel"
          role="menu"
          :aria-label="ariaLabel"
          tabindex="-1"
        >
          <template v-for="item in items" :key="item.id">
            <div
              v-if="item.dividerBefore"
              class="action-menu-popup__divider"
              role="separator"
            />
            <button
              :class="[
                'action-menu-popup__item',
                `action-menu-popup__item--${item.variant ?? 'default'}`,
              ]"
              type="button"
              role="menuitem"
              :disabled="item.disabled"
              @click="selectItem(item)"
            >
              <span
                v-if="item.icon"
                class="action-menu-popup__icon material-symbols-outlined"
                aria-hidden="true"
              >
                {{ item.icon }}
              </span>
              <span v-else class="action-menu-popup__icon" aria-hidden="true" />
              <span>{{ item.label }}</span>
            </button>
          </template>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
