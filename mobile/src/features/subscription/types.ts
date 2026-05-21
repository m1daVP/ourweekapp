import type { FeatureKey, PlanType } from '@/features/access/types';

export type BillingCadence = 'monthly' | 'yearly';

export interface PlanBenefit {
  label: string;
  featureKey?: FeatureKey;
}

export interface SubscriptionPlanOption {
  id: BillingCadence;
  name: string;
  priceLabel: string;
  description: string;
}

export interface PlanComparisonItem {
  planType: PlanType;
  label: string;
  benefits: PlanBenefit[];
}
