import type {
  FeatureAccessMap,
  FeatureKey,
  PlanType,
} from '@/features/access/types';
import { apiRequest } from './httpClient';

export type SubscriptionProviderDto =
  'google_play' | 'app_store' | 'revenuecat' | null;

export interface SubscriptionStatusDto {
  planType: PlanType;
  provider: SubscriptionProviderDto;
  enabledFeatures: FeatureKey[];
  features?: FeatureAccessMap;
  expiresAt: string | null;
  checkedAt: string;
}

export interface RestoreSubscriptionStatusRequestDto {
  provider: 'google_play' | 'app_store';
}

export interface ManageSubscriptionResponseDto {
  url: string;
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatusDto> {
  return apiRequest<SubscriptionStatusDto>('/subscriptions/status', {
    requiresAuth: true,
  });
}

export async function restoreSubscriptionStatus(
  payload: RestoreSubscriptionStatusRequestDto
): Promise<SubscriptionStatusDto> {
  return apiRequest<SubscriptionStatusDto>('/subscriptions/restore', {
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
