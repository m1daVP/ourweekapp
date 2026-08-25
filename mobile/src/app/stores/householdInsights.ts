import { defineStore } from 'pinia';
import { translate } from '@/features/localization/i18n';
import { insightsService } from '@/features/insights/services/insightsService';
import type {
  HouseholdInsightsResponse,
  HouseholdInsightsSearchResponse,
  InsightSearchGroup,
  InsightsPeriod,
} from '@/features/insights/types';

const SEARCH_PAGE_SIZE = 20;

interface HouseholdInsightsState {
  selectedPeriod: InsightsPeriod;
  insights: HouseholdInsightsResponse | null;
  isLoading: boolean;
  errorMessage: string;
  searchQuery: string;
  searchResults: HouseholdInsightsSearchResponse | null;
  isSearching: boolean;
  searchErrorMessage: string;
}

function mergeGroup(
  existing: InsightSearchGroup | undefined,
  incoming: InsightSearchGroup,
  offset: number
): InsightSearchGroup {
  if (offset === 0 || !existing) {
    return incoming;
  }

  return {
    data: [...existing.data, ...incoming.data],
    pagination: incoming.pagination,
  };
}

function mergeSearchResults(
  existing: HouseholdInsightsSearchResponse | null,
  incoming: HouseholdInsightsSearchResponse,
  offset: number
): HouseholdInsightsSearchResponse {
  return {
    meetings: mergeGroup(existing?.meetings, incoming.meetings, offset),
    tasks: mergeGroup(existing?.tasks, incoming.tasks, offset),
    agreements: mergeGroup(existing?.agreements, incoming.agreements, offset),
  };
}

export const useHouseholdInsightsStore = defineStore('householdInsights', {
  state: (): HouseholdInsightsState => ({
    selectedPeriod: '4w',
    insights: null,
    isLoading: false,
    errorMessage: '',
    searchQuery: '',
    searchResults: null,
    isSearching: false,
    searchErrorMessage: '',
  }),
  actions: {
    async load(period: InsightsPeriod = this.selectedPeriod) {
      this.isLoading = true;
      this.errorMessage = '';

      try {
        this.insights = await insightsService.loadInsights(period);
        this.selectedPeriod = period;
      } catch (error) {
        this.errorMessage =
          error instanceof Error ? error.message : translate('insights.loadFailed');
      } finally {
        this.isLoading = false;
      }
    },
    async search(query: string, offset = 0) {
      const trimmedQuery = query.trim();
      this.searchQuery = trimmedQuery;
      this.searchErrorMessage = '';

      if (trimmedQuery.length < 2) {
        this.searchResults = null;
        return;
      }

      this.isSearching = true;

      try {
        const response = await insightsService.searchInsights({
          q: trimmedQuery,
          limit: SEARCH_PAGE_SIZE,
          offset,
        });
        this.searchResults = mergeSearchResults(this.searchResults, response, offset);
      } catch (error) {
        this.searchErrorMessage =
          error instanceof Error ? error.message : translate('insights.searchFailed');
      } finally {
        this.isSearching = false;
      }
    },
  },
});
