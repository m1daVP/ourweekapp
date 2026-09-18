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
  remove: () =>
    runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Medium })),
  refreshReady: () =>
    runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Light })),
  wheelStart: () => runNativeHaptic(() => Haptics.selectionStart()),
  wheelChange: () => runNativeHaptic(() => Haptics.selectionChanged()),
  wheelEnd: () => runNativeHaptic(() => Haptics.selectionEnd()),
  completeMeeting: () =>
    runNativeHaptic(() =>
      Haptics.notification({ type: NotificationType.Success })
    ),
  impact: () =>
    runNativeHaptic(() => Haptics.impact({ style: ImpactStyle.Medium })),
};
