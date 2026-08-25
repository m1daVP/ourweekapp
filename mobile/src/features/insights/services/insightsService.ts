import type {
  InsightsPeriod,
  InsightsSearchRequest,
} from '@/features/insights/types';
import {
  getHouseholdInsights,
  searchHouseholdInsights,
} from '@/shared/api/insightsApi';

export const insightsService = {
  loadInsights: (period: InsightsPeriod) => getHouseholdInsights(period),
  searchInsights: (request: InsightsSearchRequest) =>
    searchHouseholdInsights(request),
};
