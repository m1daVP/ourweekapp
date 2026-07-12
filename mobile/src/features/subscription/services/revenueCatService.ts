import { Capacitor } from '@capacitor/core';
import {
  LOG_LEVEL,
  PAYWALL_RESULT,
  Purchases,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
} from '@revenuecat/purchases-capacitor';
import { RevenueCatUI } from '@revenuecat/purchases-capacitor-ui';
import { toRaw } from 'vue';
import { appConfig } from '@/shared/config/env';
import { translate } from '@/features/localization/i18n';

const ENTITLEMENT_ID = appConfig.revenueCatEntitlementId;

let configurePromise: Promise<void> | null = null;

function getApiKey() {
  const platform = Capacitor.getPlatform();

  if (platform === 'android') {
    return appConfig.revenueCatAndroidApiKey;
  }

  if (platform === 'ios') {
    return appConfig.revenueCatIosApiKey;
  }

  return null;
}

function assertRevenueCatAvailable() {
  if (!isRevenueCatAvailable()) {
    throw new Error(translate('upgrade.billingUnavailable'));
  }
}

export function isRevenueCatAvailable() {
  return Capacitor.isNativePlatform() && Boolean(getApiKey());
}

export async function configureRevenueCat(appUserID?: string | null) {
  if (!isRevenueCatAvailable()) {
    return;
  }

  if (!configurePromise) {
    const apiKey = getApiKey();

    if (!apiKey) {
      return;
    }

    configurePromise = (async () => {
      await Purchases.setLogLevel({
        level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO,
      });

      await Purchases.configure({
        apiKey,
        appUserID: appUserID ?? undefined,
      });
    })().catch((error: unknown) => {
      configurePromise = null;
      throw error;
    });
  }

  await configurePromise;
}

export async function logInRevenueCat(appUserID: string) {
  if (!isRevenueCatAvailable()) {
    return;
  }

  await configureRevenueCat();
  await Purchases.logIn({ appUserID });
}

export async function logOutRevenueCat() {
  if (!isRevenueCatAvailable()) {
    return;
  }

  await configureRevenueCat();
  await Purchases.logOut();
}

export async function getRevenueCatCustomerInfo() {
  assertRevenueCatAvailable();
  await configureRevenueCat();

  return Purchases.getCustomerInfo();
}

export function hasOurWeekPremium(customerInfo: CustomerInfo) {
  return Boolean(customerInfo.entitlements.active[ENTITLEMENT_ID]);
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  assertRevenueCatAvailable();
  await configureRevenueCat();

  const offerings = await Purchases.getOfferings();

  return (
    offerings.all[appConfig.revenueCatCurrentOfferingId] ??
    offerings.current ??
    null
  );
}

export async function findPackageByProductId(productId: string) {
  const offering = await getCurrentOffering();

  return (
    offering?.availablePackages.find(
      (candidate) => candidate.product.identifier === productId
    ) ?? null
  );
}

export async function purchasePackage(packageToPurchase: PurchasesPackage) {
  assertRevenueCatAvailable();
  await configureRevenueCat();

  return Purchases.purchasePackage({ aPackage: toRaw(packageToPurchase) });
}

export async function restoreRevenueCatPurchases() {
  assertRevenueCatAvailable();
  await configureRevenueCat();

  return Purchases.restorePurchases();
}

export async function presentPremiumPaywall() {
  assertRevenueCatAvailable();
  await configureRevenueCat();

  const { result } = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: ENTITLEMENT_ID,
    displayCloseButton: true,
  });

  return (
    result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED
  );
}

export async function presentRevenueCatCustomerCenter() {
  assertRevenueCatAvailable();
  await configureRevenueCat();
  await RevenueCatUI.presentCustomerCenter();
}
