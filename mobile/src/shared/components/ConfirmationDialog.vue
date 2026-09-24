<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    loading?: boolean;
  }>(),
  {
    confirmLabel: undefined,
    cancelLabel: undefined,
    destructive: false,
    loading: false,
  }
);
const emit = defineEmits<{
  close: [];
  confirm: [];
}>();
const { t } = useI18n();
const resolvedConfirmLabel = computed(
  () => props.confirmLabel ?? t('common.done')
);
const resolvedCancelLabel = computed(
  () => props.cancelLabel ?? t('common.cancel')
);

function closeDialog() {
  if (!props.loading) {
    emit('close');
  }
}
</script>

<template>
  <BaseBottomSheet :open="open" :title="title" @close="closeDialog">
    <div class="confirmation-dialog">
      <p>{{ message }}</p>
      <div class="confirmation-dialog__actions">
        <button
          class="secondary-button"
          type="button"
          :disabled="loading"
          @click="closeDialog"
        >
          {{ resolvedCancelLabel }}
        </button>
        <button
          :class="[
            destructive ? 'base-button--danger' : 'meeting-primary',
            'confirmation-dialog__confirm',
          ]"
          type="button"
          :disabled="loading"
          @click="emit('confirm')"
        >
          {{ resolvedConfirmLabel }}
        </button>
      </div>
    </div>
  </BaseBottomSheet>
</template>
