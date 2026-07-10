<script setup lang="ts">
import PremiumLock from '@/shared/components/PremiumLock.vue';
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useTasksStore } from '@/app/stores/tasks';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';
import { useStartupLoadingState } from '@/shared/composables/useStartupLoadingState';

const { canUseFeature, getFreeLimit } = useFeatureAccess();
const { isStartupLoading } = useStartupLoadingState();
const { t, locale } = useI18n();
const router = useRouter();
const meetingsStore = useMeetingsStore();
const participantsStore = useParticipantsStore();
const tasksStore = useTasksStore();
const freeHistoryLimit = getFreeLimit('limitedHistory') ?? 3;

onMounted(() => {
  participantsStore.ensureDefaultParticipants();
  tasksStore.syncFromMeetings(meetingsStore.meetings);
});

const todayLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date())
);
const householdNames = computed(() =>
  participantsStore.activeParticipants
    .slice(0, 2)
    .map((participant) => participant.name)
    .join(' & ')
);
const greetingName = computed(
  () => householdNames.value || t('home.householdFallback')
);
const openTaskCount = computed(() => tasksStore.openTasks.length);
const completedCount = computed(() => meetingsStore.completedMeetings.length);
const showTaskShortcutSkeleton = computed(
  () => isStartupLoading.value && tasksStore.tasks.length === 0
);
const showHistoryShortcutSkeleton = computed(
  () => isStartupLoading.value && meetingsStore.meetings.length === 0
);

function startMeeting() {
  router.push({ name: 'meeting-templates' });
}
</script>

<template>
  <section class="page-stack home-page">
    <section class="home-intro">
      <p class="home-date">{{ todayLabel }}</p>
      <h1 class="home-greeting">
        {{ t('home.greetingPrefix') }}<br />{{ greetingName }}.
      </h1>
    </section>

    <section class="content-panel home-hero">
      <span
        class="home-hero__icon material-symbols-outlined"
        aria-hidden="true"
      >
        spa
      </span>
      <div>
        <h2>{{ t('home.heroTitle') }}</h2>
        <p>{{ t('home.heroText') }}</p>
      </div>
      <button class="meeting-primary" type="button" @click="startMeeting">
        {{ t('home.startMeeting') }}
        <span class="material-symbols-outlined" aria-hidden="true">
          arrow_forward
        </span>
      </button>
    </section>

    <section class="home-action-list" :aria-label="t('home.shortcutsLabel')">
      <RouterLink class="content-panel home-action" :to="{ name: 'tasks' }">
        <span class="section-icon material-symbols-outlined" aria-hidden="true">
          check_circle
        </span>
        <span
          v-if="showTaskShortcutSkeleton"
          class="app-skeleton-group"
          :aria-label="t('app.loadingSavedData')"
        >
          <span class="app-skeleton app-skeleton--title" aria-hidden="true" />
          <span
            class="app-skeleton app-skeleton--text app-skeleton--short"
            aria-hidden="true"
          />
        </span>
        <span v-else>
          <strong>{{
            t('home.tasksToReview', { count: openTaskCount })
          }}</strong>
          <small>{{ t('home.fromCheckIns') }}</small>
        </span>
        <span class="material-symbols-outlined" aria-hidden="true">
          chevron_right
        </span>
      </RouterLink>

      <RouterLink class="content-panel home-action" :to="{ name: 'history' }">
        <span class="section-icon material-symbols-outlined" aria-hidden="true">
          history
        </span>
        <span
          v-if="showHistoryShortcutSkeleton"
          class="app-skeleton-group"
          :aria-label="t('app.loadingSavedData')"
        >
          <span class="app-skeleton app-skeleton--title" aria-hidden="true" />
          <span
            class="app-skeleton app-skeleton--text app-skeleton--short"
            aria-hidden="true"
          />
        </span>
        <span v-else>
          <strong>{{
            t('home.meetingsSaved', { count: completedCount })
          }}</strong>
          <small v-if="canUseFeature('unlimitedHistory')">
            {{ t('home.fullHistory') }}
          </small>
          <small v-else>
            {{ t('home.freeLatest', { count: freeHistoryLimit }) }}
          </small>
        </span>
        <span class="material-symbols-outlined" aria-hidden="true">
          chevron_right
        </span>
      </RouterLink>
    </section>

    <PremiumLock
      feature="unlimitedHistory"
      :title="t('home.unlockHistory')"
      :message="t('home.unlockHistoryMessage')"
      :show-preview="false"
    />
  </section>
</template>
