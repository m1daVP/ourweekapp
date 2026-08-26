<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useHouseholdInsightsStore } from '@/app/stores/householdInsights';
import { getInsightResultRoute } from '@/features/insights/presentation';
import type { InsightsPeriod } from '@/features/insights/types';

const { t } = useI18n();
const router = useRouter();
const store = useHouseholdInsightsStore();
const searchInput = ref('');
const periods: Array<{ value: InsightsPeriod; labelKey: string }> = [
  { value: '4w', labelKey: 'insights.periods.fourWeeks' },
  { value: '12w', labelKey: 'insights.periods.twelveWeeks' },
  { value: 'all', labelKey: 'insights.periods.all' },
];

const hasSearchResults = computed(() => {
  const results = store.searchResults;

  return Boolean(
    results &&
    (results.meetings.data.length ||
      results.tasks.data.length ||
      results.agreements.data.length)
  );
});
const canLoadMore = computed(() => {
  const results = store.searchResults;
  return Boolean(
    results &&
    (results.meetings.pagination.hasMore ||
      results.tasks.pagination.hasMore ||
      results.agreements.pagination.hasMore)
  );
});

onMounted(() => {
  void store.load();
});

function selectPeriod(period: InsightsPeriod) {
  void store.load(period);
}

function submitSearch() {
  void store.search(searchInput.value);
}

function loadMore() {
  const offset = store.searchResults?.meetings.pagination.offset ?? 0;
  void store.search(searchInput.value, offset + 20);
}

function openMeeting(meetingId: string) {
  router.push({ name: 'meeting-summary', params: { meetingId } });
}
</script>

<template>
  <section class="page-stack insights-page">
    <header class="insights-page__header">
      <p class="page-kicker">{{ t('insights.kicker') }}</p>
      <h1>{{ t('insights.title') }}</h1>
      <p>{{ t('insights.intro') }}</p>
    </header>

    <div class="insights-periods" :aria-label="t('insights.periodLabel')">
      <button
        v-for="period in periods"
        :key="period.value"
        type="button"
        :class="[
          'filter-chip',
          { 'filter-chip--active': store.selectedPeriod === period.value },
        ]"
        :disabled="store.isLoading"
        @click="selectPeriod(period.value)"
      >
        {{ t(period.labelKey) }}
      </button>
    </div>

    <p v-if="store.isLoading" class="content-panel insights-message">
      {{ t('insights.loading') }}
    </p>
    <section
      v-else-if="store.errorMessage"
      class="content-panel insights-message"
      aria-live="polite"
    >
      <p>{{ store.errorMessage }}</p>
      <button
        class="secondary-button"
        type="button"
        @click="selectPeriod(store.selectedPeriod)"
      >
        {{ t('insights.retry') }}
      </button>
    </section>

    <template v-else-if="store.insights">
      <section
        class="insights-card-grid"
        :aria-label="t('insights.cardsLabel')"
      >
        <article class="content-panel insights-card">
          <p class="insights-card__eyebrow">
            {{ t('insights.meetingConsistency') }}
          </p>
          <strong>{{
            t('insights.meetingsCompleted', {
              count: store.insights.meetingConsistency.completedMeetings,
            })
          }}</strong>
          <small
            v-if="
              store.insights.meetingConsistency.averageIntervalDays !== null
            "
          >
            {{
              t('insights.averageInterval', {
                days: store.insights.meetingConsistency.averageIntervalDays.toFixed(
                  1
                ),
              })
            }}
          </small>
          <small v-else>{{ t('insights.intervalUnavailable') }}</small>
        </article>

        <article class="content-panel insights-card">
          <p class="insights-card__eyebrow">
            {{ t('insights.taskFollowThrough') }}
          </p>
          <strong
            v-if="store.insights.taskFollowThrough.completionRate !== null"
          >
            {{
              t('insights.completionRate', {
                percent: Math.round(
                  store.insights.taskFollowThrough.completionRate * 100
                ),
              })
            }}
          </strong>
          <strong v-else>{{ t('insights.insufficientData') }}</strong>
          <div class="insights-tags">
            <span>{{
              t('insights.doneTag', {
                count: store.insights.taskFollowThrough.done,
              })
            }}</span>
            <span>{{
              t('insights.openTag', {
                count: store.insights.taskFollowThrough.open,
              })
            }}</span>
            <span v-if="store.insights.taskFollowThrough.overdue">{{
              t('insights.overdueTag', {
                count: store.insights.taskFollowThrough.overdue,
              })
            }}</span>
          </div>
        </article>

        <article class="content-panel insights-card">
          <p class="insights-card__eyebrow">
            {{ t('insights.agreementFollowThrough') }}
          </p>
          <strong>{{
            t('insights.resolvedTag', {
              count: store.insights.agreementFollowThrough.resolved,
            })
          }}</strong>
          <div class="insights-tags">
            <span>{{
              t('insights.unresolvedTag', {
                count: store.insights.agreementFollowThrough.unresolved,
              })
            }}</span>
            <span>{{
              t('insights.notTrackedTag', {
                count: store.insights.agreementFollowThrough.notTrackedYet,
              })
            }}</span>
          </div>
        </article>

        <article class="content-panel insights-card">
          <p class="insights-card__eyebrow">
            {{ t('insights.recurringTopics') }}
          </p>
          <p v-if="!store.insights.recurringTopics.length">
            {{ t('insights.noRecurringTopics') }}
          </p>
          <ul v-else class="insights-topic-list">
            <li
              v-for="topic in store.insights.recurringTopics"
              :key="topic.title"
            >
              <strong>{{ topic.title }}</strong>
              <span>{{
                t('insights.meetingCount', { count: topic.meetingCount })
              }}</span>
              <button
                type="button"
                class="text-button"
                @click="openMeeting(topic.meetingIds[0]!)"
              >
                {{ t('insights.viewSource') }}
              </button>
            </li>
          </ul>
        </article>
      </section>

      <section class="content-panel insights-search">
        <h2>{{ t('insights.searchLabel') }}</h2>
        <form @submit.prevent="submitSearch">
          <label class="sr-only" for="insights-search">{{
            t('insights.searchLabel')
          }}</label>
          <input
            id="insights-search"
            v-model="searchInput"
            type="search"
            :placeholder="t('insights.searchPlaceholder')"
            minlength="2"
          />
          <button
            class="secondary-button"
            type="submit"
            :disabled="store.isSearching"
          >
            {{ t('insights.searchAction') }}
          </button>
        </form>
        <p v-if="store.searchErrorMessage" class="insights-message">
          {{ store.searchErrorMessage }}
        </p>
        <p
          v-else-if="
            store.searchQuery.length >= 2 &&
            !store.isSearching &&
            !hasSearchResults
          "
        >
          {{ t('insights.noResults') }}
        </p>
        <div v-else-if="hasSearchResults" class="insights-search-groups">
          <section
            v-for="group in [
              { key: 'meetings', label: t('insights.meetings') },
              { key: 'tasks', label: t('insights.tasks') },
              { key: 'agreements', label: t('insights.agreements') },
            ]"
            :key="group.key"
          >
            <h3>{{ group.label }}</h3>
            <ul
              v-if="store.searchResults?.[group.key].data.length"
              class="insights-result-list"
            >
              <li
                v-for="item in store.searchResults?.[group.key].data"
                :key="item.id"
              >
                <RouterLink :to="getInsightResultRoute(item)">
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.status ?? t('insights.agreement') }}</small>
                </RouterLink>
              </li>
            </ul>
          </section>
          <button
            v-if="canLoadMore"
            class="secondary-button"
            type="button"
            :disabled="store.isSearching"
            @click="loadMore"
          >
            {{ t('insights.loadMore') }}
          </button>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.insights-page__header p {
  color: var(--color-text-muted);
}
.insights-periods,
.insights-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.insights-card-grid,
.insights-search-groups {
  display: grid;
  gap: 0.75rem;
}
.insights-card {
  display: grid;
  gap: 0.5rem;
}
.insights-card__eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
.insights-tags span {
  border-radius: 999px;
  background: var(--color-surface-muted);
  padding: 0.25rem 0.5rem;
  font-size: 0.8125rem;
}
.insights-topic-list,
.insights-result-list {
  display: grid;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.insights-topic-list li,
.insights-result-list a {
  display: grid;
  gap: 0.2rem;
}
.insights-search form {
  display: flex;
  gap: 0.5rem;
  margin-block: 0.75rem;
}
.insights-search input {
  flex: 1;
  min-width: 0;
}
.insights-message {
  display: grid;
  gap: 0.75rem;
}
</style>
