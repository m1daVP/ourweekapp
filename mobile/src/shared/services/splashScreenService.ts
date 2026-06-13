import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { warnSafely } from '@/shared/services/safeLogService';

export const hideLaunchSplash = async () => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch (error) {
    warnSafely('Unable to hide launch splash screen.', error);
  }
};
