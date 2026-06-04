<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  open: boolean;
  title?: string;
}>();

const { t } = useI18n();
const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="base-bottom-sheet">
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
          :aria-label="t('common.close')"
          @click="emit('close')"
        />
        <section class="base-bottom-sheet__panel">
          <header v-if="title" class="base-bottom-sheet__header">
            <h2>{{ title }}</h2>
            <button type="button" @click="emit('close')">
              {{ t('common.close') }}
            </button>
          </header>
          <slot />
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
