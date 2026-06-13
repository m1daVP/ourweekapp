<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAndroidBackButton } from '@/app/composables/useAndroidBackButton';
import { useSubscriptionStore } from '@/app/stores/subscription';
import AppShell from '@/shared/components/AppShell.vue';
import { useNotifications } from '@/shared/composables/useNotifications';
import { useCoreDataSync } from '@/shared/composables/useCoreDataSync';

const route = useRoute();
const subscriptionStore = useSubscriptionStore();
const { initializeReminderSync } = useNotifications();
const showNavigation = computed(() => !route.meta.hideNavigation);

subscriptionStore.initializeSubscriptions();
initializeReminderSync();
useCoreDataSync();
useAndroidBackButton();
</script>

<template>
  <AppShell :show-navigation="showNavigation">
    <RouterView />
  </AppShell>
</template>
