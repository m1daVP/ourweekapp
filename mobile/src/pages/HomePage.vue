<script setup lang="ts">
import PremiumLock from '@/shared/components/PremiumLock.vue';
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useTasksStore } from '@/app/stores/tasks';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';

const { canUseFeature, getFreeLimit } = useFeatureAccess();
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
  new Intl.DateTimeFormat(undefined, {
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
const openTaskCount = computed(() => tasksStore.openTasks.length);
const completedCount = computed(() => meetingsStore.completedMeetings.length);

function startMeeting() {
  router.push({ name: 'meeting-templates' });
}
</script>

<template>
  <section class="page-stack home-page">
    <section class="home-intro">
      <p class="home-date">{{ todayLabel }}</p>
      <h1 class="home-greeting">
        Good morning,<br />{{ householdNames || 'your household' }}.
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
        <h2>Ready for your 15-minute weekly reset?</h2>
        <p>
          Take a moment to align on the week ahead, celebrate wins, and connect.
        </p>
      </div>
      <button class="meeting-primary" type="button" @click="startMeeting">
        Start Meeting
        <span class="material-symbols-outlined" aria-hidden="true">
          arrow_forward
        </span>
      </button>
    </section>

    <section class="home-action-list" aria-label="Weekly Us shortcuts">
      <RouterLink class="content-panel home-action" :to="{ name: 'tasks' }">
        <span class="section-icon material-symbols-outlined" aria-hidden="true">
          check_circle
        </span>
        <span>
          <strong>{{ openTaskCount }} tasks to review</strong>
          <small>From weekly check-ins</small>
        </span>
        <span class="material-symbols-outlined" aria-hidden="true">
          chevron_right
        </span>
      </RouterLink>

      <RouterLink class="content-panel home-action" :to="{ name: 'history' }">
        <span class="section-icon material-symbols-outlined" aria-hidden="true">
          history
        </span>
        <span>
          <strong>{{ completedCount }} meetings saved</strong>
          <small v-if="canUseFeature('unlimitedHistory')">
            Full history available
          </small>
          <small v-else> Free opens latest {{ freeHistoryLimit }} </small>
        </span>
        <span class="material-symbols-outlined" aria-hidden="true">
          chevron_right
        </span>
      </RouterLink>
    </section>

    <PremiumLock
      feature="unlimitedHistory"
      title="Unlock full history"
      message="Look back at older weekly check-ins and agreements when your household needs context."
      :show-preview="false"
    />
  </section>
</template>
