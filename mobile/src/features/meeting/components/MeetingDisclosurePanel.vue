<script setup lang="ts">
defineProps<{ controls: string; label: string; open: boolean }>();
const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <section class="meeting-disclosure-panel" :class="{ 'is-open': open }">
    <button
      class="meeting-disclosure-panel__toggle"
      type="button"
      :aria-expanded="open"
      :aria-controls="controls"
      @click="emit('toggle')"
    >
      <span
        v-if="$slots.leading"
        class="meeting-disclosure-panel__leading"
        aria-hidden="true"
        ><slot name="leading"
      /></span>
      <span class="meeting-disclosure-panel__label">{{ label }}</span>
      <span
        class="meeting-disclosure-panel__chevron material-symbols-outlined"
        aria-hidden="true"
        >{{ open ? 'expand_less' : 'expand_more' }}</span
      >
    </button>
    <div
      :id="controls"
      class="meeting-disclosure-panel__reveal"
      :aria-hidden="!open"
      :inert="open ? undefined : true"
    >
      <div class="meeting-disclosure-panel__reveal-inner"><slot /></div>
    </div>
  </section>
</template>

<style scoped>
.meeting-disclosure-panel {
  overflow: hidden;
  border: 1px solid var(--color-outline-variant);
  border-radius: 28px;
  background: #f8f7f2;
}
.meeting-disclosure-panel__toggle {
  display: flex;
  width: 100%;
  min-height: 56px;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  padding: 10px 14px 10px 18px;
  color: var(--color-primary);
  font: inherit;
  font-weight: 700;
  text-align: left;
}
.meeting-disclosure-panel__leading {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  place-items: center;
  border-radius: 50%;
  background: #e9ece5;
  font-size: 1.15rem;
}
.meeting-disclosure-panel__label {
  flex: 1;
  min-width: 0;
}
.meeting-disclosure-panel__chevron {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-surface-lowest);
  font-size: 1.5rem;
}
.meeting-disclosure-panel__reveal {
  display: grid;
  grid-template-rows: 0fr;
  overflow: hidden;
  opacity: 0;
  transform: translateY(-8px);
  transition:
    grid-template-rows 340ms cubic-bezier(0.22, 0.8, 0.3, 1),
    opacity 220ms ease,
    transform 340ms cubic-bezier(0.22, 0.8, 0.3, 1);
}
.meeting-disclosure-panel.is-open .meeting-disclosure-panel__reveal {
  grid-template-rows: 1fr;
  opacity: 1;
  transform: none;
}
.meeting-disclosure-panel__reveal-inner {
  min-height: 0;
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .meeting-disclosure-panel__reveal {
    transition-duration: 0.01ms;
  }
}
</style>
