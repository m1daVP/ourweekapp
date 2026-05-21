<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { generateMeetingSummary } from '@/features/meeting/aiSummaryService';
import type {
  Meeting,
  MeetingSummaryTask,
  MeetingTask,
} from '@/features/meeting/types';
import PremiumLock from '@/shared/components/PremiumLock.vue';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';

const meetingsStore = useMeetingsStore();
const participantsStore = useParticipantsStore();
const route = useRoute();
const router = useRouter();
const { canAccessMeetingHistoryItem, canUseFeature, getFreeLimit } =
  useFeatureAccess();

const freeHistoryLimit = getFreeLimit('limitedHistory') ?? 3;
const meetingId = computed(() => String(route.params.meetingId ?? ''));
const isGeneratingSummary = ref(false);
const aiSummaryError = ref('');

const meeting = computed(
  () =>
    meetingsStore.meetings.find((item) => item.id === meetingId.value) ?? null
);

const aiSummary = computed(() => meeting.value?.aiSummary ?? null);

const sortedCompletedMeetings = computed(() =>
  [...meetingsStore.completedMeetings].sort(compareMeetingsByDate)
);

const completedMeetingIndex = computed(() =>
  sortedCompletedMeetings.value.findIndex((item) => item.id === meetingId.value)
);

const canAccessMeeting = computed(() => {
  if (!meeting.value) {
    return false;
  }

  return canAccessMeetingHistoryItem(
    meeting.value,
    completedMeetingIndex.value
  );
});

const isLocked = computed(() =>
  Boolean(meeting.value && !canAccessMeeting.value)
);

const meetingDateLabel = computed(() =>
  meeting.value ? formatDate(getMeetingDate(meeting.value)) : ''
);

const meetingPreview = computed(() =>
  meeting.value ? getMeetingPreview(meeting.value) : ''
);

const allTasks = computed(
  () => meeting.value?.sections.flatMap((section) => section.tasks) ?? []
);

const allAgreements = computed(
  () => meeting.value?.sections.flatMap((section) => section.agreements) ?? []
);

function compareMeetingsByDate(first: Meeting, second: Meeting) {
  return getMeetingDate(second).getTime() - getMeetingDate(first).getTime();
}

function getMeetingDate(item: Meeting) {
  return new Date(item.completedAt ?? item.updatedAt ?? item.createdAt);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function truncateText(text: string, maxLength = 120) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function getMeetingPreview(item: Meeting) {
  for (const section of item.sections) {
    const note = section.notes[0];

    if (note) {
      return truncateText(note.text);
    }

    const task = section.tasks[0];

    if (task) {
      return truncateText(task.title);
    }

    const agreement = section.agreements[0];

    if (agreement) {
      return truncateText(agreement.text);
    }
  }

  return 'No notes, tasks, or agreements yet.';
}

function getMeetingStatusLabel(item: Meeting) {
  return item.status === 'completed' ? 'finished' : 'draft';
}

function getParticipantName(participantId: string) {
  return participantsStore.getParticipantById(participantId)?.name ?? 'Someone';
}

function getTaskResponsibleLabel(
  task: Pick<
    MeetingTask | MeetingSummaryTask,
    'responsibilityType' | 'responsibleParticipantIds'
  >
) {
  if (task.responsibilityType === 'needsDiscussion') {
    return 'Needs discussion';
  }

  if (!task.responsibleParticipantIds.length) {
    return 'Unassigned';
  }

  return task.responsibleParticipantIds.map(getParticipantName).join(', ');
}

function resumeDraft() {
  if (!meeting.value || meeting.value.status === 'completed') {
    return;
  }

  meetingsStore.resumeMeeting(meeting.value.id);
  router.push({ name: 'meeting' });
}

async function generateSummary() {
  if (
    !meeting.value ||
    isGeneratingSummary.value ||
    !canUseFeature('aiSummary')
  ) {
    return;
  }

  aiSummaryError.value = '';
  isGeneratingSummary.value = true;

  try {
    const summary = await generateMeetingSummary(meeting.value);
    meetingsStore.saveAiSummary(meeting.value.id, summary);
  } catch {
    aiSummaryError.value = 'Could not generate a summary right now.';
  } finally {
    isGeneratingSummary.value = false;
  }
}
</script>

<template>
  <section class="page-stack meeting-details-page">
    <div v-if="!meeting" class="content-panel">
      <h1>Meeting not found</h1>
      <p>This meeting is not saved on this device.</p>
      <RouterLink class="secondary-button link-button" to="/history">
        Back to history
      </RouterLink>
    </div>

    <template v-else-if="isLocked">
      <header>
        <p class="page-kicker">{{ meetingDateLabel }}</p>
        <h1>{{ meeting.title }}</h1>
        <p class="page-copy">{{ meetingPreview }}</p>
      </header>

      <PremiumLock
        feature="unlimitedHistory"
        title="Older meeting locked"
        :message="`Free history opens the latest ${freeHistoryLimit} finished meetings. Upgrade to review every section, note, task, and agreement.`"
      >
        <div class="content-panel feature-summary">
          <h2>{{ meeting.title }}</h2>
          <p>{{ getMeetingStatusLabel(meeting) }} - {{ meetingDateLabel }}</p>
        </div>
      </PremiumLock>
    </template>

    <template v-else>
      <header class="meeting-details-header">
        <div>
          <p class="page-kicker">{{ meetingDateLabel }}</p>
          <h1>{{ meeting.title }}</h1>
          <p class="page-copy">
            {{ getMeetingStatusLabel(meeting) }} - {{ allTasks.length }} tasks -
            {{ allAgreements.length }} agreements
          </p>
        </div>
        <button
          v-if="meeting.status !== 'completed'"
          type="button"
          class="meeting-save"
          @click="resumeDraft"
        >
          Resume
        </button>
      </header>

      <PremiumLock
        feature="aiSummary"
        title="AI summaries are premium"
        message="Upgrade to generate neutral meeting summaries and next steps."
      >
        <section class="meeting-panel ai-summary-panel">
          <div class="ai-summary-panel__header">
            <div>
              <h2>AI summary</h2>
              <p class="meeting-help">
                AI summaries may be inaccurate. Review before relying on them.
                This is not professional relationship advice.
              </p>
            </div>
            <button
              type="button"
              class="meeting-primary ai-summary-panel__button"
              :disabled="isGeneratingSummary"
              @click="generateSummary"
            >
              {{ aiSummary ? 'Regenerate' : 'Generate' }} summary
            </button>
          </div>

          <p v-if="aiSummaryError" class="meeting-error">
            {{ aiSummaryError }}
          </p>

          <template v-if="aiSummary">
            <p class="ai-summary-panel__summary">
              {{ aiSummary.shortSummary }}
            </p>

            <div class="meeting-summary__group">
              <h3>Main topics discussed</h3>
              <ul class="meeting-list">
                <li v-for="topic in aiSummary.mainTopics" :key="topic">
                  <p>{{ topic }}</p>
                </li>
              </ul>
            </div>

            <div class="meeting-summary__group">
              <h3>Key tensions</h3>
              <ul class="meeting-list">
                <li v-for="tension in aiSummary.keyTensions" :key="tension">
                  <p>{{ tension }}</p>
                </li>
              </ul>
            </div>

            <div class="meeting-summary__group">
              <h3>Agreements made</h3>
              <ul class="meeting-list">
                <li v-for="agreement in aiSummary.agreements" :key="agreement">
                  <p>{{ agreement }}</p>
                </li>
              </ul>
            </div>

            <div class="meeting-summary__group">
              <h3>Open tasks</h3>
              <ul
                v-if="aiSummary.tasks.length"
                class="meeting-list meeting-task-list"
              >
                <li v-for="task in aiSummary.tasks" :key="task.title">
                  <div>
                    <strong>{{ task.title }}</strong>
                    <p v-if="task.description">{{ task.description }}</p>
                    <small>
                      {{ task.status }} - {{ getTaskResponsibleLabel(task) }}
                      <template v-if="task.dueDate">
                        - due {{ task.dueDate }}</template
                      >
                    </small>
                  </div>
                </li>
              </ul>
              <p v-else class="meeting-empty">No open tasks were summarized.</p>
            </div>

            <div class="meeting-summary__group">
              <h3>Topics to revisit next week</h3>
              <ul class="meeting-list">
                <li
                  v-for="focus in aiSummary.suggestedNextMeetingFocus"
                  :key="focus"
                >
                  <p>{{ focus }}</p>
                </li>
              </ul>
            </div>
          </template>

          <p v-else class="meeting-empty">
            Generate a neutral summary of the meeting, agreements, and next
            steps.
          </p>
        </section>
      </PremiumLock>

      <section
        v-for="section in meeting.sections"
        :key="section.id"
        class="meeting-panel meeting-details-section"
      >
        <h2>{{ section.title }}</h2>
        <p class="meeting-help">{{ section.prompt }}</p>

        <div class="meeting-summary__group">
          <h3>Notes</h3>
          <ul v-if="section.notes.length" class="meeting-list">
            <li v-for="note in section.notes" :key="note.id">
              <span>
                {{ getParticipantName(note.participantId) }} -
                {{ formatDateTime(note.createdAt) }}
              </span>
              <p>{{ note.text }}</p>
            </li>
          </ul>
          <p v-else class="meeting-empty">No notes in this section.</p>
        </div>

        <div class="meeting-summary__group">
          <h3>Tasks</h3>
          <ul
            v-if="section.tasks.length"
            class="meeting-list meeting-task-list"
          >
            <li v-for="task in section.tasks" :key="task.id">
              <div>
                <strong>{{ task.title }}</strong>
                <p v-if="task.description">{{ task.description }}</p>
                <small>
                  {{ task.status }} - {{ getTaskResponsibleLabel(task) }}
                  <template v-if="task.dueDate">
                    - due {{ task.dueDate }}</template
                  >
                </small>
              </div>
            </li>
          </ul>
          <p v-else class="meeting-empty">No tasks in this section.</p>
        </div>

        <div class="meeting-summary__group">
          <h3>Agreements</h3>
          <ul v-if="section.agreements.length" class="meeting-list">
            <li v-for="agreement in section.agreements" :key="agreement.id">
              <span>
                {{
                  agreement.participantIds.map(getParticipantName).join(', ')
                }}
              </span>
              <p>{{ agreement.text }}</p>
            </li>
          </ul>
          <p v-else class="meeting-empty">No agreements in this section.</p>
        </div>
      </section>
    </template>
  </section>
</template>
