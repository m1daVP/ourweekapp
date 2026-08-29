<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useAndroidBackButton } from '@/app/composables/useAndroidBackButton';
import { useDeepLinks } from '@/app/composables/useDeepLinks';
import { useNotificationActions } from '@/app/composables/useNotificationActions';
import { useAuthStore } from '@/app/stores/auth';
import { useSubscriptionStore } from '@/app/stores/subscription';
import AppShell from '@/shared/components/AppShell.vue';
import { useToast } from '@/shared/composables/useToast';
import { useNotifications } from '@/shared/composables/useNotifications';
import { useCoreDataSync } from '@/shared/composables/useCoreDataSync';

const route = useRoute();
const { t } = useI18n();
const authStore = useAuthStore();
const subscriptionStore = useSubscriptionStore();
const { dismissToast, showToast } = useToast();
const { initializeReminderSync } = useNotifications();
const showNavigation = computed(() => !route.meta.hideNavigation);
const isSessionCheckToastVisible = ref(false);

watch(
  () => authStore.sessionCheckStatus,
  (sessionCheckStatus) => {
    if (sessionCheckStatus === 'checking') {
      isSessionCheckToastVisible.value = true;
      void showToast(t('auth.checkingSession'), {
        loading: true,
        persistent: true,
      });
      return;
    }

    if (isSessionCheckToastVisible.value) {
      dismissToast();
      isSessionCheckToastVisible.value = false;
    }

    if (sessionCheckStatus === 'failed') {
      void showToast(
        authStore.sessionCheckErrorMessage || t('auth.sessionCheckUnavailable'),
        {
          durationMs: 3600,
          tone: 'error',
        }
      );
    }
  },
  { immediate: true }
);

watch(
  () => ({
    isAuthenticated: authStore.isAuthenticated,
    sessionCheckStatus: authStore.sessionCheckStatus,
  }),
  ({ isAuthenticated, sessionCheckStatus }) => {
    if (isAuthenticated && sessionCheckStatus === 'verified') {
      void subscriptionStore.initializeSubscriptions();
      return;
    }

    if (!isAuthenticated && sessionCheckStatus !== 'checking') {
      subscriptionStore.$reset();
    }
  },
  { immediate: true }
);
initializeReminderSync();
useCoreDataSync();
useAndroidBackButton();
useDeepLinks();
useNotificationActions();
</script>

<template>
  <AppShell :show-navigation="showNavigation">
    <RouterView />
  </AppShell>
</template>
