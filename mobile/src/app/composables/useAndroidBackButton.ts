import { onBeforeUnmount, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useMeetingsStore } from '@/app/stores/meetings';

interface BackButtonEvent {
  canGoBack: boolean;
}

interface ListenerHandle {
  remove: () => Promise<void>;
}

type AndroidBackHandler = () => boolean;

const androidBackHandlers: AndroidBackHandler[] = [];

export function registerAndroidBackHandler(handler: AndroidBackHandler) {
  androidBackHandlers.push(handler);

  return () => {
    const handlerIndex = androidBackHandlers.lastIndexOf(handler);

    if (handlerIndex >= 0) {
      androidBackHandlers.splice(handlerIndex, 1);
    }
  };
}

export function useAndroidBackButton() {
  const route = useRoute();
  const router = useRouter();
  const meetingsStore = useMeetingsStore();
  let backButtonListener: ListenerHandle | null = null;

  async function handleBackButton(event: BackButtonEvent) {
    for (const handler of [...androidBackHandlers].reverse()) {
      if (handler()) {
        return;
      }
    }

    const activeMeeting = meetingsStore.activeMeeting;

    if (
      route.name === 'meeting' &&
      activeMeeting &&
      activeMeeting.currentSectionIndex > 0
    ) {
      meetingsStore.setCurrentSection(activeMeeting.currentSectionIndex - 1);
      return;
    }

    if (event.canGoBack) {
      router.back();
      return;
    }

    if (route.name !== 'home') {
      await router.push({ name: 'home' });
      return;
    }

    await CapacitorApp.minimizeApp();
  }

  onMounted(async () => {
    if (
      Capacitor.getPlatform() !== 'android' ||
      !Capacitor.isNativePlatform()
    ) {
      return;
    }

    backButtonListener = await CapacitorApp.addListener(
      'backButton',
      handleBackButton
    );
  });

  onBeforeUnmount(() => {
    void backButtonListener?.remove();
    backButtonListener = null;
  });
}
