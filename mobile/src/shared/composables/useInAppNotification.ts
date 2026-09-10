import { readonly, ref } from 'vue';

export type InAppNotificationTone = 'status' | 'error';

interface InAppNotificationOptions {
  durationMs?: number;
  tone?: InAppNotificationTone;
}

interface InAppNotificationState {
  id: number;
  message: string;
  tone: InAppNotificationTone;
}

const DEFAULT_DURATION_MS = 3000;
const notificationState = ref<InAppNotificationState | null>(null);
let notificationId = 0;
let dismissalTimer: ReturnType<typeof setTimeout> | undefined;

function clearDismissalTimer() {
  if (!dismissalTimer) {
    return;
  }

  clearTimeout(dismissalTimer);
  dismissalTimer = undefined;
}

function dismissInAppNotification() {
  clearDismissalTimer();
  notificationState.value = null;
}

function showInAppNotification(
  message: string,
  options: InAppNotificationOptions = {}
) {
  clearDismissalTimer();

  notificationState.value = {
    id: ++notificationId,
    message,
    tone: options.tone ?? 'status',
  };

  dismissalTimer = setTimeout(() => {
    notificationState.value = null;
    dismissalTimer = undefined;
  }, options.durationMs ?? DEFAULT_DURATION_MS);
}

export function useInAppNotification() {
  return {
    dismissInAppNotification,
    notificationState: readonly(notificationState),
    showInAppNotification,
  };
}
