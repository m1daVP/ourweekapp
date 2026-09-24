import {
  Capacitor,
  SystemBars,
  SystemBarsStyle,
  SystemBarType,
} from '@capacitor/core';
import { warnSafely } from '@/shared/services/safeLogService';

export const configureSystemBars = async () => {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await SystemBars.setStyle({
      bar: SystemBarType.StatusBar,
      style: SystemBarsStyle.Light,
    });
    await SystemBars.setStyle({
      bar: SystemBarType.NavigationBar,
      style: SystemBarsStyle.Dark,
    });
  } catch (error) {
    warnSafely('Unable to configure system bars.', error);
  }
};
