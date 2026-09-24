<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  kicker?: string;
  title: string;
  subtitle?: string;
  showBack?: boolean;
}>();

const { t } = useI18n();
const emit = defineEmits<{
  back: [];
}>();
</script>

<template>
  <header class="page-header">
    <button
      v-if="showBack"
      class="page-header__back"
      type="button"
      :aria-label="t('common.goBack')"
      @click="emit('back')"
    >
      {{ t('common.back') }}
    </button>
    <div>
      <p v-if="kicker" class="page-kicker">{{ kicker }}</p>
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="page-copy">{{ subtitle }}</p>
    </div>
    <slot />
  </header>
</template>
