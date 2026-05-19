<script setup lang="ts">
import AppNavigation from '@/shared/components/AppNavigation.vue'
</script>

<template>
  <div class="app-shell">
    <main class="app-main">
      <RouterView />
    </main>
    <AppNavigation />
  </div>
</template>
