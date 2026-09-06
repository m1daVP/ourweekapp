import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { warnSafely } from '@/shared/services/safeLogService';

async function runNativeHaptic(action: () => Promise<void>) {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await action();
  } catch (error) {
    warnSafely('Unable to provide haptic feedback.', error);
  }
}

export const haptics = {
  confirm: () =>
    runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Light })),
  completeMeeting: () =>
    runNativeHaptic(() =>
      Haptics.notification({ type: NotificationType.Success })
    ),
  impact: () =>
    runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Medium })),
};
