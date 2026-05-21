<script setup lang="ts">
import BottomNavigation from '@/shared/components/BottomNavigation.vue';

withDefaults(
  defineProps<{
    showNavigation?: boolean;
  }>(),
  {
    showNavigation: true,
  }
);
</script>

<template>
  <div class="app-shell">
    <main class="app-main">
      <slot />
    </main>
    <BottomNavigation v-if="showNavigation" />
  </div>
</template>
