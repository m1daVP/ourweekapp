<script setup lang="ts">
defineProps<{
  title: string;
  message?: string;
  actionLabel?: string;
}>();

const emit = defineEmits<{
  action: [];
}>();
</script>

<template>
  <div class="empty-state">
    <h2>{{ title }}</h2>
    <p v-if="message">{{ message }}</p>
    <button v-if="actionLabel" type="button" @click="emit('action')">
      {{ actionLabel }}
    </button>
  </div>
</template>
