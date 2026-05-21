<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useSubscriptionStore } from '@/app/stores/subscription';
import AppNavigation from '@/shared/components/AppNavigation.vue';
import { useNotifications } from '@/shared/composables/useNotifications';

const route = useRoute();
const subscriptionStore = useSubscriptionStore();
const { initializeReminderSync } = useNotifications();
const showNavigation = computed(() => !route.meta.hideNavigation);

subscriptionStore.initializeSubscriptions();
initializeReminderSync();
</script>

<template>
  <div class="app-shell">
    <main class="app-main">
      <RouterView />
    </main>
    <AppNavigation v-if="showNavigation" />
  </div>
</template>
