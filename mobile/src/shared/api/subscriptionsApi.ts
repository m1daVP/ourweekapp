import type { FeatureKey, PlanType } from '@/features/access/types';
import { apiRequest, isBackendApiConfigured } from './httpClient';
import { nowIso } from '@/shared/utils/dates';

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

export interface ValidateSubscriptionRequestDto {
  provider: Exclude<SubscriptionProviderDto, 'revenuecat' | null>;
  purchaseToken: string;
  productId: string;
}

export interface ValidateRevenueCatSubscriptionRequestDto {
  provider: 'revenuecat';
  appUserID: string;
  productId?: string;
  entitlementId: string;
}

export interface RestoreSubscriptionRequestDto {
  provider: Exclude<SubscriptionProviderDto, 'revenuecat' | null>;
}

export interface ManageSubscriptionResponseDto {
  url: string;
}

const freeFeatureKeys: FeatureKey[] = [
  'basicMeetings',
  'defaultTemplate',
  'tasksAndAgreements',
  'manualResponsibility',
  'limitedHistory',
];

function createMockStatus(): SubscriptionStatusDto {
  return {
    planType: 'free',
    provider: null,
    enabledFeatures: freeFeatureKeys,
    expiresAt: null,
    checkedAt: nowIso(),
  };
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatusDto> {
  if (!isBackendApiConfigured()) {
    return createMockStatus();
  }

  return apiRequest<SubscriptionStatusDto>('/subscriptions/status', {
    requiresAuth: true,
  });
}

export async function validateSubscription(
  payload: ValidateSubscriptionRequestDto
): Promise<SubscriptionStatusDto> {
  if (!isBackendApiConfigured()) {
    return createMockStatus();
  }

  return apiRequest<SubscriptionStatusDto>('/subscriptions/validate', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
  });
}

export async function validateRevenueCatSubscription(
  payload: ValidateRevenueCatSubscriptionRequestDto
): Promise<SubscriptionStatusDto> {
  if (!isBackendApiConfigured()) {
    return createMockStatus();
  }

  return apiRequest<SubscriptionStatusDto>('/subscriptions/validate', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
  });
}

export async function restoreSubscription(
  payload: RestoreSubscriptionRequestDto
): Promise<SubscriptionStatusDto> {
  if (!isBackendApiConfigured()) {
    return createMockStatus();
  }

  return apiRequest<SubscriptionStatusDto>('/subscriptions/restore', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
  });
}

export async function getSubscriptionManagementUrl(): Promise<ManageSubscriptionResponseDto> {
  if (!isBackendApiConfigured()) {
    return { url: '' };
  }

  return apiRequest<ManageSubscriptionResponseDto>('/subscriptions/manage', {
    requiresAuth: true,
  });
}
