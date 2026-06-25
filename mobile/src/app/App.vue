<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAndroidBackButton } from '@/app/composables/useAndroidBackButton';
import { useAuthStore } from '@/app/stores/auth';
import { useSubscriptionStore } from '@/app/stores/subscription';
import AppShell from '@/shared/components/AppShell.vue';
import { useNotifications } from '@/shared/composables/useNotifications';
import { useCoreDataSync } from '@/shared/composables/useCoreDataSync';

const route = useRoute();
const authStore = useAuthStore();
const subscriptionStore = useSubscriptionStore();
const { initializeReminderSync } = useNotifications();
const showNavigation = computed(() => !route.meta.hideNavigation);

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      void subscriptionStore.initializeSubscriptions();
      return;
    }

    subscriptionStore.$reset();
  },
  { immediate: true }
);
initializeReminderSync();
useCoreDataSync();
useAndroidBackButton();
</script>

<template>
  <AppShell :show-navigation="showNavigation">
    <RouterView />
  </AppShell>
</template>
