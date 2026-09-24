import { computed } from 'vue';
import { useAuthStore } from '@/app/stores/auth';
import { getAggregateSyncStatus } from '@/shared/services/syncService';

export function useStartupLoadingState() {
  const authStore = useAuthStore();

  const isStartupLoading = computed(() => {
    if (authStore.sessionCheckStatus === 'checking') {
      return true;
    }

    return (
      authStore.isAuthenticated && getAggregateSyncStatus().state === 'syncing'
    );
  });

  return {
    isStartupLoading,
  };
}
