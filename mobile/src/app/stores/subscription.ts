import { defineStore } from 'pinia';
import { translate } from '@/features/localization/i18n';
import { subscriptionsService } from '@/features/subscription/services/subscriptionService';
import type { FeatureKey, PlanType } from '@/features/access/types';
import { createLegacyFeatureAccessMap } from '@/features/access/legacyFeatureAccess';
import type { FeatureAccessMap } from '@/features/access/types';
import type {
  ManageSubscriptionResult,
  SubscriptionEntitlementStatus,
  SubscriptionPlanId,
  SubscriptionPlanOption,
  SubscriptionProviderKind,
} from '@/features/subscription/types';

interface SubscriptionState {
  currentPlan: PlanType;
  featureAccess: FeatureAccessMap;
  provider: SubscriptionProviderKind;
  premiumEntitlement: SubscriptionEntitlementStatus | null;
  availablePlans: SubscriptionPlanOption[];
  isLoading: boolean;
  isPurchasing: boolean;
  isRestoring: boolean;
  isManaging: boolean;
  errorMessage: string;
  statusMessage: string;
  lastCheckedAt: string | null;
  managementUrl: string | null;
  canManageSubscription: boolean;
}

export const useSubscriptionStore = defineStore('subscription', {
  state: (): SubscriptionState => ({
    currentPlan: 'free',
    featureAccess: createLegacyFeatureAccessMap({ planType: 'free' }),
    provider: 'backend',
    premiumEntitlement: null,
    availablePlans: [],
    isLoading: false,
    isPurchasing: false,
    isRestoring: false,
    isManaging: false,
    errorMessage: '',
    statusMessage: '',
    lastCheckedAt: null,
    managementUrl: null,
    canManageSubscription: false,
  }),
  getters: {
    hasPremiumEntitlement: (state) =>
      Boolean(state.premiumEntitlement?.isActive),
    enabledFeatureKeys: (state): FeatureKey[] =>
      state.premiumEntitlement?.unlockedFeatures ?? [],
    getFeatureAccess: (state) => (featureKey: FeatureKey) =>
      state.featureAccess[featureKey],
  },
  actions: {
    applySnapshot(
      snapshot: Awaited<ReturnType<typeof subscriptionsService.getCurrentPlan>>
    ) {
      this.currentPlan = snapshot.currentPlan;
      this.featureAccess = snapshot.featureAccess;
      this.provider = snapshot.provider;
      this.premiumEntitlement = snapshot.entitlements.premium;
      this.lastCheckedAt = snapshot.checkedAt;
      this.managementUrl = snapshot.management.url ?? null;
      this.canManageSubscription = snapshot.management.supported;
    },
    async initializeSubscriptions() {
      this.isLoading = true;
      this.errorMessage = '';

      try {
        const [snapshot, plans] = await Promise.all([
          subscriptionsService.getCurrentPlan(),
          subscriptionsService.getAvailablePlans(),
        ]);

        this.availablePlans = plans;
        this.applySnapshot(snapshot);
      } catch (error) {
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('upgrade.checkFailed');
      } finally {
        this.isLoading = false;
      }
    },
    async refreshCurrentPlan() {
      this.isLoading = true;
      this.errorMessage = '';

      try {
        const snapshot = await subscriptionsService.getCurrentPlan();
        this.applySnapshot(snapshot);
      } catch (error) {
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('upgrade.checkFailed');
      } finally {
        this.isLoading = false;
      }
    },
    async purchasePlan(planId: SubscriptionPlanId) {
      this.isPurchasing = true;
      this.errorMessage = '';
      this.statusMessage = '';

      try {
        const result = await subscriptionsService.purchasePlan(planId);
        this.applySnapshot(result.snapshot);
        this.statusMessage = result.message ?? '';
        return result.status === 'completed';
      } catch (error) {
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('upgrade.startFailed');
        return false;
      } finally {
        this.isPurchasing = false;
      }
    },
    async restorePurchases() {
      this.isRestoring = true;
      this.errorMessage = '';
      this.statusMessage = '';

      try {
        const result = await subscriptionsService.restorePurchases();
        this.applySnapshot(result.snapshot);
        this.statusMessage = result.message ?? '';
        return result.status === 'completed';
      } catch (error) {
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('upgrade.restoreFailed');
        return false;
      } finally {
        this.isRestoring = false;
      }
    },
    async manageSubscription(): Promise<ManageSubscriptionResult | null> {
      this.isManaging = true;
      this.errorMessage = '';
      this.statusMessage = '';

      try {
        const result = await subscriptionsService.manageSubscription();
        this.statusMessage = result.message;

        if (result.supported && result.url) {
          window.location.assign(result.url);
        }

        return result;
      } catch (error) {
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('upgrade.manageFailed');
        return null;
      } finally {
        this.isManaging = false;
      }
    },
    async presentPremiumPaywall() {
      this.isPurchasing = true;
      this.errorMessage = '';
      this.statusMessage = '';

      try {
        const result = await subscriptionsService.presentPremiumPaywall();
        this.applySnapshot(result.snapshot);
        this.statusMessage = result.message ?? '';
        return result.status === 'completed';
      } catch (error) {
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('upgrade.startFailed');
        return false;
      } finally {
        this.isPurchasing = false;
      }
    },
    async refreshCustomerInfo() {
      this.isLoading = true;
      this.errorMessage = '';

      try {
        const result = await subscriptionsService.refreshCustomerInfo();
        this.applySnapshot(result.snapshot);
        this.statusMessage = result.message ?? '';
        return result.status === 'completed';
      } catch (error) {
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('upgrade.checkFailed');
        return false;
      } finally {
        this.isLoading = false;
      }
    },
  },
});
