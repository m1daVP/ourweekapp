import { Capacitor } from '@capacitor/core';
import { translate } from '@/features/localization/i18n';
import type { SubscriptionPlanId } from '../types';
import type {
  RestoreSubscriptionRequestDto,
  ValidateSubscriptionRequestDto,
} from '@/shared/api/subscriptionsApi';

export type NativePurchaseResult = ValidateSubscriptionRequestDto;

function getStoreProvider(): RestoreSubscriptionRequestDto['provider'] | null {
  const platform = Capacitor.getPlatform();

  if (platform === 'android') {
    return 'google_play';
  }

  if (platform === 'ios') {
    return 'app_store';
  }

  return null;
}

export const nativeBillingService = {
  getRestoreProvider() {
    return getStoreProvider();
  },
  async purchasePlan(
    planId: SubscriptionPlanId
  ): Promise<NativePurchaseResult> {
    void planId;

    const provider = getStoreProvider();

    if (!provider) {
      throw new Error(translate('upgrade.billingUnavailable'));
    }

    throw new Error(translate('upgrade.billingUnavailable'));
  },
};
