import type { FeatureKey, PlanType } from '@/features/access/types';

export type BillingCadence = 'monthly' | 'yearly';
export type SubscriptionPlanId = 'premium_monthly' | 'premium_yearly';
export type SubscriptionProviderKind = 'mock' | 'revenuecat' | 'direct_store';
export type SubscriptionPlatform = 'web' | 'android' | 'ios';
export type SubscriptionEntitlementKey = 'premium';
export type EntitlementVerificationSource =
  | 'trusted_provider'
  | 'backend'
  | 'none';

export interface PlanBenefit {
  label: string;
  featureKey?: FeatureKey;
}

export interface SubscriptionPlanOption {
  id: SubscriptionPlanId;
  name: string;
  priceLabel: string;
  description: string;
  cadence: BillingCadence;
  planType: Extract<PlanType, 'premium'>;
  entitlementKey: SubscriptionEntitlementKey;
  productIds: Partial<Record<SubscriptionPlatform, string>>;
}

export interface PlanComparisonItem {
  planType: PlanType;
  label: string;
  benefits: PlanBenefit[];
}

export interface SubscriptionEntitlementStatus {
  key: SubscriptionEntitlementKey;
  isActive: boolean;
  unlockedFeatures: FeatureKey[];
  verification: EntitlementVerificationSource;
  expiresAt?: string;
  checkedAt: string;
}

export interface SubscriptionManagementInfo {
  supported: boolean;
  label: string;
  url?: string;
}

export interface SubscriptionSnapshot {
  currentPlan: PlanType;
  provider: SubscriptionProviderKind;
  entitlements: Record<
    SubscriptionEntitlementKey,
    SubscriptionEntitlementStatus
  >;
  management: SubscriptionManagementInfo;
  checkedAt: string;
}

export type SubscriptionActionStatus =
  | 'completed'
  | 'cancelled'
  | 'not_supported';

export interface SubscriptionActionResult {
  status: SubscriptionActionStatus;
  snapshot: SubscriptionSnapshot;
  message?: string;
}

export interface ManageSubscriptionResult {
  supported: boolean;
  message: string;
  url?: string;
}

export interface SubscriptionProvider {
  kind: SubscriptionProviderKind;
  getCurrentPlan(): Promise<SubscriptionSnapshot>;
  getAvailablePlans(): Promise<SubscriptionPlanOption[]>;
  purchasePlan(planId: SubscriptionPlanId): Promise<SubscriptionActionResult>;
  restorePurchases(): Promise<SubscriptionActionResult>;
  manageSubscription(): Promise<ManageSubscriptionResult>;
  presentPremiumPaywall?(): Promise<SubscriptionActionResult>;
  refreshCustomerInfo?(): Promise<SubscriptionActionResult>;
}
