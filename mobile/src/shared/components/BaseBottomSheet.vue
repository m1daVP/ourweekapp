<script setup lang="ts">
defineProps<{
  open: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="base-bottom-sheet"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <button
        class="base-bottom-sheet__scrim"
        type="button"
        aria-label="Close"
        @click="emit('close')"
      />
      <section class="base-bottom-sheet__panel">
        <header v-if="title" class="base-bottom-sheet__header">
          <h2>{{ title }}</h2>
          <button type="button" @click="emit('close')">Close</button>
        </header>
        <slot />
      </section>
    </div>
  </Teleport>
</template>
