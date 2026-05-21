import { defineStore } from 'pinia';
import { useUserAccessStore } from '@/app/stores/userAccess';
import { subscriptionsService } from '@/features/subscription/services/subscriptionService';
import type { FeatureKey, PlanType } from '@/features/access/types';
import type {
  ManageSubscriptionResult,
  SubscriptionEntitlementStatus,
  SubscriptionPlanId,
  SubscriptionPlanOption,
  SubscriptionProviderKind,
} from '@/features/subscription/types';

interface SubscriptionState {
  currentPlan: PlanType;
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
    provider: 'mock',
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
  },
  actions: {
    applySnapshot(
      snapshot: Awaited<ReturnType<typeof subscriptionsService.getCurrentPlan>>
    ) {
      const accessStore = useUserAccessStore();

      this.currentPlan = snapshot.currentPlan;
      this.provider = snapshot.provider;
      this.premiumEntitlement = snapshot.entitlements.premium;
      this.lastCheckedAt = snapshot.checkedAt;
      this.managementUrl = snapshot.management.url ?? null;
      this.canManageSubscription = snapshot.management.supported;
      accessStore.setAccountPlan(snapshot.currentPlan);
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
            : 'Something went wrong while checking Premium access.';
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
            : 'Something went wrong while checking Premium access.';
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
            : 'Something went wrong while starting Premium.';
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
            : 'Something went wrong while restoring purchases.';
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
            : 'Something went wrong while opening subscription management.';
        return null;
      } finally {
        this.isManaging = false;
      }
    },
  },
});
