import { Capacitor } from '@capacitor/core';
import { Toast, type ToastShowOptions } from '@capacitor/toast';
import { warnSafely } from '@/shared/services/safeLogService';

type NativeToastDuration = NonNullable<ToastShowOptions['duration']>;
type NativeToastPosition = NonNullable<ToastShowOptions['position']>;

interface NativeToastOptions {
  duration?: NativeToastDuration;
  position?: NativeToastPosition;
}

export function useNativeToast() {
  async function showToast(message: string, options: NativeToastOptions = {}) {
    if (!Capacitor.isNativePlatform()) {
      warnSafely('Native toast is unavailable outside a Capacitor app.');
      return;
    }

    try {
      await Toast.show({
        text: message,
        duration: options.duration ?? 'short',
        position: options.position ?? 'bottom',
      });
    } catch (error) {
      warnSafely('Unable to show native toast.', error);
    }
  }

  return {
    showToast,
  };
}
