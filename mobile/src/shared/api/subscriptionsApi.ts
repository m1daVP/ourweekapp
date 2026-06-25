import type { FeatureKey, PlanType } from '@/features/access/types';
import { apiRequest } from './httpClient';

export type SubscriptionProviderDto =
  | 'google_play'
  | 'app_store'
  | 'revenuecat'
  | null;

export interface SubscriptionStatusDto {
  planType: PlanType;
  provider: SubscriptionProviderDto;
  enabledFeatures: FeatureKey[];
  expiresAt: string | null;
  checkedAt: string;
}

export interface ValidateRevenueCatSubscriptionRequestDto {
  provider: 'revenuecat';
  appUserID: string;
  productId?: string;
  entitlementId: string;
}

export interface ManageSubscriptionResponseDto {
  url: string;
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatusDto> {
  return apiRequest<SubscriptionStatusDto>('/subscriptions/status', {
    requiresAuth: true,
  });
}

export async function validateRevenueCatSubscription(
  payload: ValidateRevenueCatSubscriptionRequestDto
): Promise<SubscriptionStatusDto> {
  return apiRequest<SubscriptionStatusDto>('/subscriptions/validate', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
  });
}

export async function getSubscriptionManagementUrl(): Promise<ManageSubscriptionResponseDto> {
  return apiRequest<ManageSubscriptionResponseDto>('/subscriptions/manage', {
    requiresAuth: true,
  });
}
