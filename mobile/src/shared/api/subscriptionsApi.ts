import type { FeatureKey, PlanType } from '@/features/access/types'
import { apiRequest, isBackendApiConfigured } from './httpClient'

export type SubscriptionProviderDto = 'mock' | 'google_play' | 'app_store'

export interface SubscriptionStatusDto {
  planType: PlanType
  provider: SubscriptionProviderDto
  enabledFeatures: FeatureKey[]
  expiresAt?: string
  checkedAt: string
}

export interface ValidateSubscriptionRequestDto {
  provider: Exclude<SubscriptionProviderDto, 'mock'>
  purchaseToken: string
  productId: string
}

const freeFeatureKeys: FeatureKey[] = [
  'basicMeetings',
  'defaultTemplate',
  'tasksAndAgreements',
  'manualResponsibility',
  'limitedHistory',
]

function createMockStatus(): SubscriptionStatusDto {
  return {
    planType: 'free',
    provider: 'mock',
    enabledFeatures: freeFeatureKeys,
    checkedAt: new Date().toISOString(),
  }
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatusDto> {
  if (!isBackendApiConfigured()) {
    return createMockStatus()
  }

  return apiRequest<SubscriptionStatusDto>('/subscriptions/status')
}

export async function validateSubscription(
  payload: ValidateSubscriptionRequestDto,
): Promise<SubscriptionStatusDto> {
  if (!isBackendApiConfigured()) {
    return createMockStatus()
  }

  return apiRequest<SubscriptionStatusDto>('/subscriptions/validate', {
    method: 'POST',
    body: payload,
  })
}
