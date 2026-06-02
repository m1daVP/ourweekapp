import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

export const hideLaunchSplash = async () => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Unable to hide launch splash screen.', error);
    }
  }
};
