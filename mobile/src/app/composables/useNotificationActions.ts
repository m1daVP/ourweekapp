import { onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { PluginListenerHandle } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export function useNotificationActions() {
  const router = useRouter();
  let notificationActionListener: PluginListenerHandle | null = null;

  onMounted(async () => {
    if (
      !Capacitor.isNativePlatform() ||
      !Capacitor.isPluginAvailable('LocalNotifications')
    ) {
      return;
    }

    try {
      notificationActionListener = await LocalNotifications.addListener(
        'localNotificationActionPerformed',
        async () => {
          try {
            await router.isReady();
            await router.push({ name: 'meeting-templates' });
          } catch {
            // Native event callbacks must not reject if navigation is unavailable.
          }
        }
      );
    } catch {
      notificationActionListener = null;
    }
  });

  onBeforeUnmount(() => {
    void notificationActionListener?.remove();
    notificationActionListener = null;
  });
}
