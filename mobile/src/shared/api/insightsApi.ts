import type {
  HouseholdInsightsResponse,
  HouseholdInsightsSearchResponse,
  InsightsPeriod,
  InsightsSearchRequest,
} from '@/features/insights/types';
import { apiRequest } from './httpClient';

export function getHouseholdInsights(period: InsightsPeriod) {
  return apiRequest<HouseholdInsightsResponse>(
    `/insights?period=${encodeURIComponent(period)}`,
    { requiresAuth: true }
  );
}

export function searchHouseholdInsights({
  q,
  limit,
  offset,
}: InsightsSearchRequest) {
  const parameters = new URLSearchParams({
    q,
    limit: String(limit),
    offset: String(offset),
  });

  return apiRequest<HouseholdInsightsSearchResponse>(
    `/insights/search?${parameters.toString()}`,
    { requiresAuth: true }
  );
}
