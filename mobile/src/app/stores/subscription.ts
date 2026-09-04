import { defineStore } from 'pinia';
import { translate } from '@/features/localization/i18n';
import { subscriptionsService } from '@/features/subscription/services/subscriptionService';
import type { FeatureKey, PlanType } from '@/features/access/types';
import { createLegacyFeatureAccessMap } from '@/features/access/legacyFeatureAccess';
import type { FeatureAccessMap } from '@/features/access/types';
import type {
  AssistantRecapAllowance,
  ManageSubscriptionResult,
  SubscriptionEntitlementStatus,
  SubscriptionPlanId,
  SubscriptionPlanOption,
  SubscriptionProviderKind,
} from '@/features/subscription/types';

// A reset allocates a fresh epoch, so old async responses cannot repopulate the store.
let nextSubscriptionEpoch = 0;

interface SubscriptionState {
  subscriptionEpoch: number;
  planReadId: number;
  recapRefreshPending: boolean;
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
  assistantRecap: AssistantRecapAllowance | null;
}

export const useSubscriptionStore = defineStore('subscription', {
  state: (): SubscriptionState => ({
    subscriptionEpoch: ++nextSubscriptionEpoch,
    planReadId: 0,
    recapRefreshPending: false,
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
    assistantRecap: null,
  }),
  getters: {
    hasPremiumEntitlement: (state) =>
      Boolean(state.premiumEntitlement?.isActive),
    enabledFeatureKeys: (state): FeatureKey[] =>
      state.premiumEntitlement?.unlockedFeatures ?? [],
    getFeatureAccess: (state) => (featureKey: FeatureKey) =>
      state.featureAccess[featureKey],
    isCheckingRecapAllowance: (state) =>
      state.isLoading || state.isPurchasing || state.isRestoring,
    canGenerateAssistantRecap: (state) =>
      !state.isLoading &&
      !state.isPurchasing &&
      !state.isRestoring &&
      state.assistantRecap?.canGenerate === true,
  },
  actions: {
    invalidateAssistantRecap() {
      this.assistantRecap = null;
    },
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
      this.assistantRecap = snapshot.assistantRecap ?? null;
    },
    async initializeSubscriptions() {
      if (this.isPurchasing || this.isRestoring) return;
      const epoch = this.subscriptionEpoch;
      const readId = ++this.planReadId;
      const isCurrent = () =>
        this.subscriptionEpoch === epoch && this.planReadId === readId;
      this.isLoading = true;
      this.errorMessage = '';

      try {
        const [snapshot, plans] = await Promise.all([
          subscriptionsService.getCurrentPlan(),
          subscriptionsService.getAvailablePlans(),
        ]);

        if (!isCurrent()) return;
        this.availablePlans = plans;
        this.applySnapshot(snapshot);
      } catch (error) {
        if (!isCurrent()) return;
        this.invalidateAssistantRecap();
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('upgrade.checkFailed');
      } finally {
        if (isCurrent()) this.isLoading = false;
      }
    },
    async refreshCurrentPlan() {
      if (this.isPurchasing || this.isRestoring) {
        this.recapRefreshPending = true;
        this.invalidateAssistantRecap();
        return;
      }
      this.recapRefreshPending = false;
      const epoch = this.subscriptionEpoch;
      const readId = ++this.planReadId;
      const isCurrent = () =>
        this.subscriptionEpoch === epoch && this.planReadId === readId;
      this.isLoading = true;
      this.errorMessage = '';

      try {
        const snapshot = await subscriptionsService.getCurrentPlan();
        if (!isCurrent()) return;
        this.applySnapshot(snapshot);
      } catch (error) {
        if (!isCurrent()) return;
        this.invalidateAssistantRecap();
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('upgrade.checkFailed');
      } finally {
        if (isCurrent()) this.isLoading = false;
      }
    },
    async purchasePlan(planId: SubscriptionPlanId) {
      if (this.isPurchasing || this.isRestoring) return false;
      const epoch = this.subscriptionEpoch;
      const readId = ++this.planReadId;
      const isCurrent = () =>
        this.subscriptionEpoch === epoch && this.planReadId === readId;
      this.isLoading = false;
      this.isPurchasing = true;
      this.errorMessage = '';
      this.statusMessage = '';

      try {
        const result = await subscriptionsService.purchasePlan(planId);
        if (!isCurrent()) return false;
        this.applySnapshot(result.snapshot);
        this.statusMessage = result.message ?? '';
        return result.status === 'completed';
      } catch (error) {
        if (!isCurrent()) return false;
        this.invalidateAssistantRecap();
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('upgrade.startFailed');
        return false;
      } finally {
        if (isCurrent()) {
          this.isPurchasing = false;
          if (this.recapRefreshPending) await this.refreshCurrentPlan();
        }
      }
    },
    async restorePurchases() {
      if (this.isPurchasing || this.isRestoring) return false;
      const epoch = this.subscriptionEpoch;
      const readId = ++this.planReadId;
      const isCurrent = () =>
        this.subscriptionEpoch === epoch && this.planReadId === readId;
      this.isLoading = false;
      this.isRestoring = true;
      this.errorMessage = '';
      this.statusMessage = '';

      try {
        const result = await subscriptionsService.restorePurchases();
        if (!isCurrent()) return false;
        this.applySnapshot(result.snapshot);
        this.statusMessage = result.message ?? '';
        return result.status === 'completed';
      } catch (error) {
        if (!isCurrent()) return false;
        this.invalidateAssistantRecap();
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('upgrade.restoreFailed');
        return false;
      } finally {
        if (isCurrent()) {
          this.isRestoring = false;
          if (this.recapRefreshPending) await this.refreshCurrentPlan();
        }
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
      if (this.isPurchasing || this.isRestoring) return false;
      const epoch = this.subscriptionEpoch;
      const readId = ++this.planReadId;
      const isCurrent = () =>
        this.subscriptionEpoch === epoch && this.planReadId === readId;
      this.isLoading = false;
      this.isPurchasing = true;
      this.errorMessage = '';
      this.statusMessage = '';

      try {
        const result = await subscriptionsService.presentPremiumPaywall();
        if (!isCurrent()) return false;
        this.applySnapshot(result.snapshot);
        this.statusMessage = result.message ?? '';
        return result.status === 'completed';
      } catch (error) {
        if (!isCurrent()) return false;
        this.invalidateAssistantRecap();
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('upgrade.startFailed');
        return false;
      } finally {
        if (isCurrent()) {
          this.isPurchasing = false;
          if (this.recapRefreshPending) await this.refreshCurrentPlan();
        }
      }
    },
    async refreshCustomerInfo() {
      if (this.isPurchasing || this.isRestoring) return false;
      const epoch = this.subscriptionEpoch;
      const readId = ++this.planReadId;
      const isCurrent = () =>
        this.subscriptionEpoch === epoch && this.planReadId === readId;
      this.isLoading = true;
      this.errorMessage = '';

      try {
        const result = await subscriptionsService.refreshCustomerInfo();
        if (!isCurrent()) return false;
        this.applySnapshot(result.snapshot);
        this.statusMessage = result.message ?? '';
        return result.status === 'completed';
      } catch (error) {
        if (!isCurrent()) return false;
        this.invalidateAssistantRecap();
        this.errorMessage =
          error instanceof Error
            ? error.message
            : translate('upgrade.checkFailed');
        return false;
      } finally {
        if (isCurrent()) this.isLoading = false;
      }
    },
  },
});
