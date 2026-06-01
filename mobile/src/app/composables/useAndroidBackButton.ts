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

export function useAndroidBackButton() {
  const route = useRoute();
  const router = useRouter();
  const meetingsStore = useMeetingsStore();
  let backButtonListener: ListenerHandle | null = null;

  async function handleBackButton(event: BackButtonEvent) {
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
