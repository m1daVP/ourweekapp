<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { registerAndroidBackHandler } from '@/app/composables/useAndroidBackButton';

export type AnchoredActionMenuItem = {
  id: string;
  label: string;
  icon: string;
  variant?: 'default' | 'destructive';
};

const props = defineProps<{
  items: AnchoredActionMenuItem[];
  menuLabel: string;
  triggerLabel: string;
}>();

const emit = defineEmits<{
  select: [itemId: string];
}>();

const isOpen = ref(false);
const menuElement = ref<HTMLElement | null>(null);
const panelElement = ref<HTMLElement | null>(null);
const panelStyle = ref<Record<string, string>>({});
const triggerElement = ref<HTMLButtonElement | null>(null);

const viewportMargin = 8;
const menuOffset = 8;

function updatePanelPosition() {
  if (!triggerElement.value || !panelElement.value) {
    return;
  }

  const triggerRect = triggerElement.value.getBoundingClientRect();
  const panelRect = panelElement.value.getBoundingClientRect();
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const preferredTop = triggerRect.bottom + menuOffset;
  const top =
    preferredTop + panelRect.height <= viewportHeight - viewportMargin
      ? preferredTop
      : Math.max(
          viewportMargin,
          triggerRect.top - panelRect.height - menuOffset
        );
  const left = Math.min(
    Math.max(viewportMargin, triggerRect.right - panelRect.width),
    viewportWidth - panelRect.width - viewportMargin
  );

  panelStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
  };
}

function removeDocumentListeners() {
  document.removeEventListener('keydown', handleDocumentKeydown);
  document.removeEventListener('pointerdown', handleDocumentPointerdown);
  window.removeEventListener('resize', updatePanelPosition);
  window.removeEventListener('scroll', updatePanelPosition, true);
}

function closeMenu({ restoreFocus = true } = {}) {
  if (!isOpen.value) {
    return;
  }

  isOpen.value = false;
  removeDocumentListeners();

  if (restoreFocus) {
    void nextTick(() => triggerElement.value?.focus());
  }
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return;
  }

  event.preventDefault();
  closeMenu();
}

function handleDocumentPointerdown(event: PointerEvent) {
  const target = event.target;

  if (
    target instanceof Node &&
    (menuElement.value?.contains(target) ||
      panelElement.value?.contains(target))
  ) {
    return;
  }

  closeMenu();
}

async function openMenu() {
  isOpen.value = true;
  await nextTick();
  updatePanelPosition();
  document.addEventListener('keydown', handleDocumentKeydown);
  document.addEventListener('pointerdown', handleDocumentPointerdown);
  window.addEventListener('resize', updatePanelPosition);
  window.addEventListener('scroll', updatePanelPosition, true);
  panelElement.value
    ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
    ?.focus();
}

function toggleMenu() {
  if (isOpen.value) {
    closeMenu();
    return;
  }

  void openMenu();
}

function selectAction(itemId: string) {
  closeMenu({ restoreFocus: false });
  emit('select', itemId);
}

const unregisterAndroidBackHandler = registerAndroidBackHandler(() => {
  if (!isOpen.value) {
    return false;
  }

  closeMenu();
  return true;
});

onBeforeUnmount(() => {
  removeDocumentListeners();
  unregisterAndroidBackHandler();
});
</script>

<template>
  <span ref="menuElement" class="anchored-action-menu">
    <button
      ref="triggerElement"
      class="anchored-action-menu__trigger material-symbols-outlined"
      type="button"
      :aria-expanded="isOpen"
      aria-haspopup="menu"
      :aria-label="triggerLabel"
      @click="toggleMenu"
    >
      more_vert
    </button>
    <Teleport to="body">
      <section
        v-if="isOpen"
        ref="panelElement"
        class="anchored-action-menu__panel"
        :style="panelStyle"
        role="menu"
        :aria-label="menuLabel"
      >
        <button
          v-for="item in props.items"
          :key="item.id"
          :class="[
            'anchored-action-menu__item',
            `anchored-action-menu__item--${item.variant ?? 'default'}`,
          ]"
          type="button"
          role="menuitem"
          :aria-label="item.label"
          @click="selectAction(item.id)"
        >
          <span class="material-symbols-outlined" aria-hidden="true">
            {{ item.icon }}
          </span>
          <span>{{ item.label }}</span>
        </button>
      </section>
    </Teleport>
  </span>
</template>

<style scoped>
.anchored-action-menu {
  display: inline-flex;
  flex: 0 0 auto;
  margin-left: auto;
}

.anchored-action-menu__trigger {
  display: grid;
  width: 48px;
  min-width: 48px;
  height: 48px;
  min-height: 48px;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-primary);
  font-size: 1.25rem;
}

.anchored-action-menu__trigger:active {
  background: var(--color-surface-low);
}

.anchored-action-menu__trigger:focus-visible,
.anchored-action-menu__item:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 2px;
}

.anchored-action-menu__panel {
  position: fixed;
  z-index: 60;
  display: grid;
  min-width: 10.5rem;
  overflow: hidden;
  border: 1px solid var(--color-outline-variant);
  border-radius: 16px;
  background: var(--color-surface-lowest);
  box-shadow: 0 8px 24px rgba(47, 42, 38, 0.14);
}

.anchored-action-menu__item {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 12px;
  border: 0;
  background: transparent;
  padding: 12px 16px;
  color: var(--color-on-surface);
  font: inherit;
  font-weight: 600;
  text-align: left;
}

.anchored-action-menu__item:active {
  background: var(--color-surface-low);
}

.anchored-action-menu__item--destructive {
  color: var(--color-error);
}
</style>
