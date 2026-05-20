<script setup lang="ts">
import AppNavigation from '@/shared/components/AppNavigation.vue'
import { useNotifications } from '@/shared/composables/useNotifications'

const { initializeReminderSync } = useNotifications()

initializeReminderSync()
</script>

<template>
  <div class="app-shell">
    <main class="app-main">
      <RouterView />
    </main>
    <AppNavigation />
  </div>
</template>
