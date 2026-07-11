import { onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';
import { resolveDeepLinkRoute } from '@/shared/services/deepLinkService';

export function useDeepLinks() {
  const router = useRouter();
  let appUrlOpenListener: PluginListenerHandle | null = null;

  function handleDeepLink(url: string) {
    const target = resolveDeepLinkRoute(url);

    if (target) {
      void router.push(target);
    }
  }

  onMounted(async () => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    appUrlOpenListener = await CapacitorApp.addListener(
      'appUrlOpen',
      ({ url }) => handleDeepLink(url)
    );

    const launchUrl = await CapacitorApp.getLaunchUrl();

    if (launchUrl?.url) {
      await router.isReady();
      handleDeepLink(launchUrl.url);
    }
  });

  onBeforeUnmount(() => {
    void appUrlOpenListener?.remove();
    appUrlOpenListener = null;
  });
}
