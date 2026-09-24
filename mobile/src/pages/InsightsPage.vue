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
          'insights-periods__button',
          {
            'insights-periods__button--active':
              store.selectedPeriod === period.value,
          },
        ]"
        :disabled="store.isLoading"
        @click="selectPeriod(period.value)"
      >
        {{ t(period.labelKey) }}
      </button>
    </div>

    <p
      v-if="store.isLoading"
      class="content-panel insights-message insights-message--loading"
    >
      {{ t('insights.loading') }}
    </p>
    <section
      v-else-if="store.errorMessage"
      class="content-panel insights-message insights-message--error"
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
          <strong class="insights-card__metric">{{
            t('insights.meetingsCompleted', {
              count: store.insights.meetingConsistency.completedMeetings,
            })
          }}</strong>
          <small
            v-if="
              store.insights.meetingConsistency.averageIntervalDays !== null
            "
            class="insights-card__detail"
          >
            {{
              t('insights.averageInterval', {
                days: store.insights.meetingConsistency.averageIntervalDays.toFixed(
                  1
                ),
              })
            }}
          </small>
          <small v-else class="insights-card__detail">{{
            t('insights.intervalUnavailable')
          }}</small>
        </article>

        <article class="content-panel insights-card">
          <p class="insights-card__eyebrow">
            {{ t('insights.taskFollowThrough') }}
          </p>
          <strong
            v-if="store.insights.taskFollowThrough.completionRate !== null"
            class="insights-card__metric"
          >
            {{
              t('insights.completionRate', {
                percent: Math.round(
                  store.insights.taskFollowThrough.completionRate * 100
                ),
              })
            }}
          </strong>
          <strong v-else class="insights-card__metric">{{
            t('insights.insufficientData')
          }}</strong>
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
          <strong class="insights-card__metric">{{
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
          <p
            v-if="!store.insights.recurringTopics.length"
            class="insights-card__empty"
          >
            {{ t('insights.noRecurringTopics') }}
          </p>
          <ul v-else class="insights-topic-list">
            <li
              v-for="topic in store.insights.recurringTopics"
              :key="topic.title"
            >
              <strong class="insights-topic-list__title">{{
                topic.title
              }}</strong>
              <span class="insights-topic-list__meta">{{
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
        <form class="insights-search__form" @submit.prevent="submitSearch">
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
            class="insights-search-group"
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
.insights-page {
  gap: var(--section-gap);
}

.insights-page__header {
  gap: var(--space-2);
  padding: var(--space-1) var(--space-1) 0;
}

.insights-page__header p {
  max-width: 34rem;
  color: var(--color-on-surface-variant);
}

.insights-page__header .page-kicker {
  color: var(--color-outline);
}

.insights-periods,
.insights-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.insights-periods {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-1);
  border: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 50%, transparent);
  border-radius: var(--radius-md);
  background: var(--color-surface-low);
  padding: var(--space-1);
}

.insights-periods__button {
  min-height: var(--touch-target-min);
  border: 1px solid transparent;
  border-radius: calc(var(--radius-md) - 4px);
  background: transparent;
  padding: 0 var(--space-2);
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-label-lg);
  font-weight: 800;
  line-height: 1.2;
  transition:
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    color 160ms ease;
}

.insights-periods__button--active {
  border-color: color-mix(
    in srgb,
    var(--color-outline-variant) 44%,
    transparent
  );
  background: var(--color-surface-lowest);
  color: var(--color-primary);
  box-shadow: 0 2px 6px rgba(47, 42, 38, 0.07);
}

.insights-periods__button:focus-visible,
.insights-topic-list .text-button:focus-visible,
.insights-result-list a:focus-visible {
  outline: 3px solid
    color-mix(in srgb, var(--color-primary-fixed) 82%, transparent);
  outline-offset: 2px;
}

.insights-periods__button:disabled {
  opacity: 0.56;
}

.insights-card-grid,
.insights-search-groups {
  display: grid;
  gap: var(--space-3);
}

.insights-card {
  display: grid;
  min-height: 148px;
  align-content: start;
  gap: var(--space-2);
  border-color: color-mix(
    in srgb,
    var(--color-outline-variant) 58%,
    transparent
  );
  border-radius: var(--radius-lg);
  background: var(--color-surface-lowest);
  box-shadow: var(--shadow-card);
  padding: var(--space-5);
}

.insights-card__eyebrow {
  margin: 0;
  color: var(--color-outline);
  font-size: var(--font-size-label-sm);
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.insights-card__metric {
  color: var(--color-on-surface);
  font-family: var(--font-display);
  font-size: var(--font-size-headline-lg);
  font-weight: 700;
  line-height: 1.3;
}

.insights-card__detail,
.insights-card__empty {
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-label-lg);
  line-height: 1.45;
}

.insights-tags span {
  border: 1px solid
    color-mix(in srgb, var(--color-primary-fixed) 72%, transparent);
  border-radius: var(--radius-pill);
  background: color-mix(
    in srgb,
    var(--color-primary-fixed) 48%,
    var(--color-surface-lowest)
  );
  padding: 5px var(--space-2);
  color: var(--color-primary);
  font-size: var(--font-size-label-sm);
  font-weight: 700;
  line-height: 1.25;
}

.insights-topic-list,
.insights-result-list {
  display: grid;
  gap: var(--space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}

.insights-topic-list li,
.insights-result-list a {
  display: grid;
  gap: var(--space-1);
  border: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 54%, transparent);
  border-radius: var(--radius-sm);
  background: var(--color-surface-low);
  padding: var(--space-3);
}

.insights-topic-list__title,
.insights-result-list strong {
  overflow-wrap: anywhere;
  color: var(--color-on-surface);
  font-size: var(--font-size-body-md);
  line-height: 1.3;
}

.insights-topic-list__meta,
.insights-result-list small {
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-label-sm);
  font-weight: 700;
}

.insights-topic-list .text-button {
  justify-self: start;
  min-height: var(--touch-target-min);
  margin-top: var(--space-1);
  font-size: var(--font-size-label-lg);
}

.insights-search {
  gap: var(--space-3);
  border-color: color-mix(
    in srgb,
    var(--color-outline-variant) 58%,
    transparent
  );
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.insights-search h2 {
  margin: 0;
}

.insights-search__form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: stretch;
}

.insights-search__form input {
  min-width: 0;
}

.insights-search__form .secondary-button {
  min-width: 108px;
}

.insights-search-group {
  display: grid;
  gap: var(--space-2);
}

.insights-search-group h3 {
  margin: 0;
  color: var(--color-on-surface-variant);
  font-family: var(--font-body);
  font-size: var(--font-size-label-lg);
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.insights-result-list a {
  min-height: var(--touch-target-min);
  align-content: center;
  color: inherit;
  text-decoration: none;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    transform 120ms ease;
}

.insights-result-list a:active {
  transform: scale(0.985);
}

.insights-message {
  display: grid;
  min-height: 104px;
  align-content: center;
  gap: var(--space-3);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.insights-message--loading {
  color: var(--color-on-surface-variant);
}

.insights-message--error {
  border-color: color-mix(
    in srgb,
    var(--color-error-container) 78%,
    transparent
  );
  background: color-mix(
    in srgb,
    var(--color-error-container) 36%,
    var(--color-surface-lowest)
  );
}

@media (max-width: 380px) {
  .insights-periods {
    gap: 2px;
    padding: 2px;
  }

  .insights-periods__button {
    padding-inline: var(--space-1);
    font-size: var(--font-size-label-sm);
  }

  .insights-search__form {
    grid-template-columns: 1fr;
  }

  .insights-search__form .secondary-button {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .insights-periods__button,
  .insights-result-list a {
    transition: none;
  }
}
</style>
