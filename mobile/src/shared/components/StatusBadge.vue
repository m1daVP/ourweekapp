<script setup lang="ts">
defineProps<{
  status: 'open' | 'done' | 'skipped' | 'draft' | 'finished' | 'premium';
}>();

const statusLabel = {
  open: 'Open',
  done: 'Done',
  skipped: 'Skipped',
  draft: 'Draft',
  finished: 'Finished',
  premium: 'Premium',
};
</script>

<template>
  <span :class="['status-badge', `status-badge--${status}`]">
    {{ statusLabel[status] }}
  </span>
</template>
