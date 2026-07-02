import { readonly, ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { Toast, type ToastShowOptions } from '@capacitor/toast';
import { warnSafely } from '@/shared/services/safeLogService';

type ToastTone = 'error' | 'status';
type NativeToastDuration = NonNullable<ToastShowOptions['duration']>;
type NativeToastPosition = NonNullable<ToastShowOptions['position']>;

interface ToastOptions {
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: NativeToastDuration;
  durationMs?: number;
  position?: NativeToastPosition;
  tone?: ToastTone;
}

interface ToastState {
  action?: {
    label: string;
    onClick: () => void;
  };
  id: number;
  message: string;
  tone: ToastTone;
}

const toastState = ref<ToastState | null>(null);
let toastId = 0;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function clearToastTimer() {
  if (!hideTimer) {
    return;
  }

  clearTimeout(hideTimer);
  hideTimer = undefined;
}

function showWebToast(message: string, options: ToastOptions) {
  clearToastTimer();

  toastState.value = {
    action: options.action,
    id: ++toastId,
    message,
    tone: options.tone ?? 'status',
  };

  hideTimer = setTimeout(() => {
    toastState.value = null;
    hideTimer = undefined;
  }, options.durationMs ?? 2400);
}

export function useToast() {
  async function showToast(message: string, options: ToastOptions = {}) {
    if (!Capacitor.isNativePlatform() || options.action) {
      showWebToast(message, options);
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
      showWebToast(message, options);
    }
  }

  function dismissToast() {
    clearToastTimer();
    toastState.value = null;
  }

  return {
    dismissToast,
    showToast,
    toastState: readonly(toastState),
  };
}
