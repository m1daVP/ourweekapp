<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useSubscriptionStore } from '@/app/stores/subscription';
import {
  generateMeetingSummary,
  AiRecapUnavailableError,
  isRecapAllowanceExhausted,
  getAiQuotaMessage,
  formatAiQuotaMessage,
  type AiQuotaInfo,
  type AiQuotaScope,
} from '@/features/meeting/aiSummaryService';
import { getMeetingTemplateName } from '@/features/meeting/meetingTemplates';
import type {
  Meeting,
  MeetingSummaryTask,
  MeetingTask,
} from '@/features/meeting/types';
import type { Participant } from '@/features/participants/types';
import ParticipantAvatar from '@/features/participants/components/ParticipantAvatar.vue';
import RecapAllowanceStatus from '@/features/meeting/components/RecapAllowanceStatus.vue';
import { useToast } from '@/shared/composables/useToast';

interface SummaryParticipant {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
}

interface SummaryActionItem {
  id: string;
  title: string;
  assigneeName: string;
  assigneeInitials: string;
  assigneeAvatarColor: string;
  completed: boolean;
}

type AiInsightState = 'available' | 'empty' | 'error' | 'loading';

interface SummaryViewModel {
  id: string;
  title: string;
  date: string;
  participants: SummaryParticipant[];
  aiInsight: string | null;
  keyDecisions: string[];
  actionItems: SummaryActionItem[];
}

const route = useRoute();
const router = useRouter();
const { t, te, locale } = useI18n();
const meetingsStore = useMeetingsStore();
const participantsStore = useParticipantsStore();
const subscriptionStore = useSubscriptionStore();
const shareError = ref('');
const isSharing = ref(false);
const aiSummaryError = ref('');
const isGeneratingSummary = ref(false);
const { showToast } = useToast();

const meetingSummaryFallbackText = {
  aiDisclaimer:
    'AI summaries may be inaccurate. Review before relying on them.',
  aiGenerating: 'Preparing the AI insight...',
  aiLocked:
    'AI insight is available with Premium. The saved decisions and action items are still shown below.',
  aiUpgrade: 'Review Premium',
  aiFailed:
    'The AI insight could not be prepared right now. The saved decisions and action items are still shown below.',
  aiEmpty:
    'No AI insight is saved for this meeting yet. The saved decisions and action items are still shown below.',
  aiGenerate: 'Generate AI insight',
  noDecisions: 'No decisions were recorded in this meeting.',
  noActions: 'No action items were recorded in this meeting.',
  unavailableTitle: 'Summary unavailable',
  unavailableText:
    'This meeting summary is not available on this device right now.',
  viewFullNotes: 'View full notes',
} as const;

type MeetingSummaryFallbackKey = keyof typeof meetingSummaryFallbackText;

function meetingSummaryText(key: MeetingSummaryFallbackKey) {
  const path = `meetingSummary.${key}`;
  return te(path) ? t(path) : meetingSummaryFallbackText[key];
}

const meetingId = computed(() => String(route.params.meetingId ?? ''));

const meeting = computed(
  () =>
    meetingsStore.meetings.find((item) => item.id === meetingId.value) ?? null
);

const accessibleMeeting = computed(() => meeting.value);

const meetingSummary = computed(() =>
  accessibleMeeting.value
    ? createSummaryViewModel(accessibleMeeting.value)
    : null
);

const visibleParticipants = computed(
  () => meetingSummary.value?.participants.slice(0, 2) ?? []
);

const hiddenParticipantCount = computed(() =>
  Math.max(0, (meetingSummary.value?.participants.length ?? 0) - 2)
);

const canGenerateAiSummary = computed(() =>
  Boolean(
    accessibleMeeting.value &&
    accessibleMeeting.value.status === 'completed' &&
    subscriptionStore.canGenerateAssistantRecap &&
    !accessibleMeeting.value.aiSummary &&
    !isGeneratingSummary.value
  )
);

const aiSummaryRouteStatus = computed(() =>
  String(route.query.aiSummary ?? '')
);

const aiSummaryRouteQuotaInfo = computed<AiQuotaInfo | null>(() => {
  const scope = route.query.aiSummaryScope;
  const resetAt = route.query.aiSummaryReset;
  const limit = Number(route.query.aiSummaryLimit);

  if (
    (scope === 'user' || scope === 'workspace') &&
    typeof resetAt === 'string' &&
    Number.isFinite(limit)
  ) {
    return { scope: scope as AiQuotaScope, limit, resetAt };
  }

  return null;
});

const aiSummaryErrorMessage = computed(
  () =>
    aiSummaryError.value ||
    (aiSummaryRouteQuotaInfo.value
      ? formatAiQuotaMessage(aiSummaryRouteQuotaInfo.value)
      : '') ||
    meetingSummaryText('aiFailed')
);

const aiInsightState = computed<AiInsightState>(() => {
  if (!accessibleMeeting.value || !meetingSummary.value) {
    return 'empty';
  }

  if (meetingSummary.value.aiInsight) {
    return 'available';
  }

  if (
    isGeneratingSummary.value ||
    aiSummaryRouteStatus.value === 'generating'
  ) {
    return 'loading';
  }

  if (aiSummaryError.value || aiSummaryRouteStatus.value === 'failed') {
    return 'error';
  }

  return 'empty';
});

const unavailableText = computed(() => meetingSummaryText('unavailableText'));

function getMeetingDate(item: Meeting) {
  return new Date(item.completedAt ?? item.updatedAt ?? item.createdAt);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function toSummaryParticipant(participant: Participant): SummaryParticipant {
  return {
    id: participant.id,
    name: participant.name,
    initials: participant.initials || getInitials(participant.name),
    avatarColor: participant.avatarColor,
    avatarType: participant.avatarType ?? null,
  };
}

function getMeetingParticipants(item: Meeting) {
  const participants = item.participantIds
    .map((participantId) => participantsStore.getParticipantById(participantId))
    .filter((participant): participant is Participant => Boolean(participant));

  if (participants.length) {
    return participants.map(toSummaryParticipant);
  }

  return participantsStore.activeParticipants.map(toSummaryParticipant);
}

function getFallbackParticipant(participants: SummaryParticipant[]) {
  return (
    participants[0] ?? {
      id: 'fallback',
      name: t('meeting.someone'),
      initials: 'WU',
      avatarColor: '#456349',
    }
  );
}

function getParticipantById(participantId: string) {
  const participant = participantsStore.getParticipantById(participantId);

  return participant ? toSummaryParticipant(participant) : null;
}

function getActionAssignee(
  task: Pick<
    MeetingTask | MeetingSummaryTask,
    'responsibilityType' | 'responsibleParticipantIds'
  >,
  participants: SummaryParticipant[]
) {
  const firstResponsibleId = task.responsibleParticipantIds[0];

  if (firstResponsibleId) {
    return (
      getParticipantById(firstResponsibleId) ??
      participants.find((participant) => participant.id === firstResponsibleId)
    );
  }

  if (task.responsibilityType === 'shared') {
    return getFallbackParticipant(participants);
  }

  return getFallbackParticipant(participants);
}

function createActionItem(
  task: Pick<
    MeetingTask | MeetingSummaryTask,
    'title' | 'status' | 'responsibilityType' | 'responsibleParticipantIds'
  > & { id?: string },
  participants: SummaryParticipant[],
  index: number
): SummaryActionItem {
  const assignee = getActionAssignee(task, participants);

  return {
    id: task.id ?? `summary-task-${index}`,
    title: task.title,
    assigneeName: assignee.name,
    assigneeInitials: assignee.initials,
    assigneeAvatarColor: assignee.avatarColor,
    completed: task.status === 'done',
  };
}

function isOpenTask(
  task: Pick<MeetingTask | MeetingSummaryTask, 'status'>
): boolean {
  return task.status !== 'done';
}

function createSummaryViewModel(item: Meeting): SummaryViewModel {
  const participants = getMeetingParticipants(item);
  const agreements = item.sections.flatMap((section) =>
    section.agreements.map((agreement) => agreement.text)
  );
  const tasks = item.sections
    .flatMap((section) => section.tasks)
    .filter(isOpenTask);
  const summaryTasks = item.aiSummary?.tasks.filter(isOpenTask) ?? [];
  const visibleTasks = summaryTasks.length ? summaryTasks : tasks;
  const keyDecisions = item.aiSummary?.agreements.length
    ? item.aiSummary.agreements
    : agreements;

  return {
    id: item.aiSummary?.id ?? item.id,
    title: getMeetingTemplateName(item.templateId, item.title),
    date: formatDate(getMeetingDate(item)),
    participants,
    aiInsight: item.aiSummary?.shortSummary ?? null,
    keyDecisions,
    actionItems: visibleTasks.length
      ? visibleTasks.map((task, index) =>
          createActionItem(task, participants, index)
        )
      : [],
  };
}

function getShareText(summary: SummaryViewModel) {
  const visibleAiInsight = summary.aiInsight;
  const decisions = summary.keyDecisions.map((item) => `- ${item}`).join('\n');
  const actions = summary.actionItems
    .map((item) => `- ${item.title} (${item.assigneeName})`)
    .join('\n');

  const lines = [
    summary.title,
    summary.date,
    '',
    t('meetingSummary.keyDecisions'),
    decisions || meetingSummaryText('noDecisions'),
    '',
    t('meetingSummary.actionItems'),
    actions || meetingSummaryText('noActions'),
  ];

  if (visibleAiInsight) {
    lines.splice(
      3,
      0,
      t('meetingSummary.aiInsight'),
      visibleAiInsight,
      meetingSummaryText('aiDisclaimer'),
      ''
    );
  }

  return lines.join('\n');
}

async function shareVisibleSummary() {
  if (!meetingSummary.value) {
    throw new Error('Summary sharing is not available for this meeting.');
  }

  const text = getShareText(meetingSummary.value);

  // TODO: Use Capacitor native share integration when the mobile provider is added.
  if (navigator.share) {
    await navigator.share({
      title: meetingSummary.value.title,
      text,
    });
    await showToast(t('meetingSummary.shared'));
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    await showToast(t('meetingSummary.copied'));
    return;
  }

  throw new Error('Summary sharing is not available in this browser.');
}

async function handleShareSummary() {
  if (isSharing.value) {
    return;
  }

  shareError.value = '';
  isSharing.value = true;

  try {
    await shareVisibleSummary();
  } catch {
    shareError.value = t('meetingSummary.shareFailed');
  } finally {
    isSharing.value = false;
  }
}

async function handleGenerateSummary() {
  if (
    !accessibleMeeting.value ||
    !canGenerateAiSummary.value ||
    isGeneratingSummary.value
  ) {
    return;
  }

  aiSummaryError.value = '';
  isGeneratingSummary.value = true;

  try {
    await generateMeetingSummary(accessibleMeeting.value);
  } catch (error) {
    aiSummaryError.value =
      error instanceof AiRecapUnavailableError ||
      isRecapAllowanceExhausted(error)
        ? ''
        : (getAiQuotaMessage(error) ?? meetingSummaryText('aiFailed'));
  } finally {
    isGeneratingSummary.value = false;
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }

  router.push({ name: 'history' });
}
</script>

<template>
  <article class="meeting-summary-page">
    <header class="meeting-summary-top-bar">
      <button
        class="meeting-summary-top-bar__back material-symbols-outlined"
        type="button"
        :aria-label="t('common.goBack')"
        @click="goBack"
      >
        arrow_back
      </button>
      <h1>{{ t('meetingSummary.title') }}</h1>
      <span aria-hidden="true"></span>
    </header>

    <main v-if="meetingSummary" class="meeting-summary-content">
      <section class="meeting-summary-hero" aria-labelledby="summary-title">
        <span class="meeting-summary-hero__badge" aria-hidden="true">
          <span class="material-symbols-outlined">groups</span>
        </span>
        <div>
          <h2 id="summary-title">{{ meetingSummary.title }}</h2>
          <p>{{ meetingSummary.date }}</p>
        </div>
        <div class="meeting-summary-avatar-stack" aria-hidden="true">
          <ParticipantAvatar
            v-for="participant in visibleParticipants"
            :key="participant.id"
            class="meeting-summary-avatar"
            :participant="participant"
            decorative
          />
          <span
            v-if="hiddenParticipantCount"
            class="meeting-summary-avatar meeting-summary-avatar--count"
          >
            +{{ hiddenParticipantCount }}
          </span>
        </div>
      </section>

      <section
        class="meeting-summary-ai-card"
        aria-labelledby="summary-ai-title"
      >
        <div class="meeting-summary-card-title">
          <span class="material-symbols-outlined" aria-hidden="true">
            auto_awesome
          </span>
          <h2 id="summary-ai-title">{{ t('meetingSummary.aiInsight') }}</h2>
        </div>
        <template v-if="aiInsightState === 'available'">
          <p>{{ meetingSummary.aiInsight }}</p>
          <p class="meeting-summary-ai-card__note">
            {{ meetingSummaryText('aiDisclaimer') }}
          </p>
        </template>
        <p v-else-if="aiInsightState === 'loading'">
          {{ meetingSummaryText('aiGenerating') }}
        </p>
        <p v-else-if="aiInsightState === 'error'">
          {{ aiSummaryErrorMessage }}
        </p>
        <p v-else>{{ meetingSummaryText('aiEmpty') }}</p>
        <RecapAllowanceStatus />
        <button
          v-if="canGenerateAiSummary"
          data-testid="generate-meeting-recap"
          class="meeting-summary-ai-card__button"
          type="button"
          @click="handleGenerateSummary"
        >
          <span class="material-symbols-outlined" aria-hidden="true">
            auto_awesome
          </span>
          {{ meetingSummaryText('aiGenerate') }}
        </button>
      </section>

      <section class="meeting-summary-section">
        <div class="meeting-summary-section__title">
          <span class="material-symbols-outlined" aria-hidden="true">
            task_alt
          </span>
          <h2>{{ t('meetingSummary.keyDecisions') }}</h2>
        </div>
        <ul
          v-if="meetingSummary.keyDecisions.length"
          class="meeting-summary-decision-card"
        >
          <li v-for="decision in meetingSummary.keyDecisions" :key="decision">
            <span aria-hidden="true"></span>
            <p>{{ decision }}</p>
          </li>
        </ul>
        <div v-else class="meeting-summary-decision-card">
          <p>{{ meetingSummaryText('noDecisions') }}</p>
        </div>
      </section>

      <section class="meeting-summary-section">
        <div class="meeting-summary-section__title">
          <span
            class="meeting-summary-section__title-icon--tertiary material-symbols-outlined"
            aria-hidden="true"
          >
            checklist
          </span>
          <h2>{{ t('meetingSummary.actionItems') }}</h2>
        </div>
        <ul
          v-if="meetingSummary.actionItems.length"
          class="meeting-summary-action-list"
        >
          <li v-for="item in meetingSummary.actionItems" :key="item.id">
            <span
              :class="[
                'meeting-summary-action-list__check',
                { 'is-complete': item.completed },
              ]"
              aria-hidden="true"
            ></span>
            <p>{{ item.title }}</p>
            <span
              class="meeting-summary-avatar meeting-summary-avatar--assignee"
              :style="{ backgroundColor: item.assigneeAvatarColor }"
              :aria-label="item.assigneeName"
              role="img"
            >
              {{ item.assigneeInitials }}
            </span>
          </li>
        </ul>
        <div v-else class="meeting-summary-decision-card">
          <p>{{ meetingSummaryText('noActions') }}</p>
        </div>
      </section>
    </main>

    <main v-else class="meeting-summary-content">
      <section class="meeting-summary-hero" aria-labelledby="summary-title">
        <span class="meeting-summary-hero__badge" aria-hidden="true">
          <span class="material-symbols-outlined">summarize</span>
        </span>
        <div>
          <h2 id="summary-title">
            {{ meetingSummaryText('unavailableTitle') }}
          </h2>
          <p>{{ unavailableText }}</p>
        </div>
      </section>
    </main>

    <footer
      v-if="meetingSummary"
      class="meeting-summary-bottom-action floating-bottom-block"
    >
      <p v-if="shareError" class="meeting-summary-share-error">
        {{ shareError }}
      </p>
      <RouterLink
        v-if="accessibleMeeting"
        class="meeting-summary-full-notes-link"
        :to="{ name: 'meeting-details', params: { meetingId } }"
      >
        {{ meetingSummaryText('viewFullNotes') }}
      </RouterLink>
      <button
        class="meeting-summary-share-button"
        data-testid="share-meeting-summary"
        type="button"
        :disabled="isSharing"
        @click="handleShareSummary"
      >
        <span class="material-symbols-outlined" aria-hidden="true">
          ios_share
        </span>
        <span>{{ t('meetingSummary.shareSummary') }}</span>
      </button>
    </footer>
  </article>
</template>
