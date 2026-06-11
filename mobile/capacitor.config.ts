/// <reference types="@capacitor/splash-screen" />

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ourweek.app',
  appName: 'OurWeek',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 500,
      backgroundColor: '#6f8f72',
      androidSplashResourceName: 'splash_icon',
      androidScaleType: 'CENTER',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    LocalNotifications: {
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
  },
};

export default config;
