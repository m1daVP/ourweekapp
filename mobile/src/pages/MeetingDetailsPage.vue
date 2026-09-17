<script setup lang="ts">
import { computed, ref } from 'vue';
import MeetingFollowThrough from '@/features/meeting/components/MeetingFollowThrough.vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import { useSubscriptionStore } from '@/app/stores/subscription';
import RecapAllowanceStatus from '@/features/meeting/components/RecapAllowanceStatus.vue';
import AiRecapRecoveryPanel from '@/features/meeting/components/AiRecapRecoveryPanel.vue';
import SavedMeetingExportCard from '@/features/meeting/components/SavedMeetingExportCard.vue';
import SavedMeetingSectionCard from '@/features/meeting/components/SavedMeetingSectionCard.vue';
import ParticipantAvatar from '@/features/participants/components/ParticipantAvatar.vue';
import { getAiRecapContentReadiness } from '@/features/meeting/aiRecapContentReadiness';
import {
  createSavedMeetingSectionViewModel,
  splitSavedMeetingSections,
  type SavedMeetingFormatters,
} from '@/features/meeting/savedMeetingSummary';
import {
  copyExportToClipboard,
  createMeetingExportFile,
  downloadExportFile,
  exportMeetingAsPdf,
  shareExportFile,
  type MeetingExportContext,
  type MeetingExportFormat,
} from '@/features/export/services/exportService';
import { isSupportedLocale } from '@/features/localization/locale';
import {
  generateMeetingSummary,
  getAiRecapRecovery,
  type AiRecapRecovery,
} from '@/features/meeting/aiSummaryService';
import {
  getMeetingSectionPrompt,
  getMeetingSectionTitle,
  getMeetingTemplateName,
} from '@/features/meeting/meetingTemplates';
import type {
  Meeting,
  MeetingSummaryTask,
  MeetingTask,
} from '@/features/meeting/types';
import ConfirmationDialog from '@/shared/components/ConfirmationDialog.vue';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';
import { useInAppNotification } from '@/shared/composables/useInAppNotification';
import { ApiClientError } from '@/shared/api/httpClient';

const meetingsStore = useMeetingsStore();
const { t, locale } = useI18n();
const participantsStore = useParticipantsStore();
const subscriptionStore = useSubscriptionStore();
const route = useRoute();
const router = useRouter();
const { canUseFeature } = useFeatureAccess();
const { showInAppNotification } = useInAppNotification();

const meetingId = computed(() => String(route.params.meetingId ?? ''));
const isGeneratingSummary = ref(false);
const aiSummaryRecovery = ref<AiRecapRecovery | null>(null);
const isLowContentConfirmationOpen = ref(false);
const pendingLowContentMeeting = ref<Meeting | null>(null);
const isExporting = ref(false);
const exportFormat = ref<MeetingExportFormat>('text');

const meeting = computed(
  () =>
    meetingsStore.meetings.find((item) => item.id === meetingId.value) ?? null
);

const aiSummary = computed(() => meeting.value?.aiSummary ?? null);

const aiRecapReadiness = computed(() =>
  meeting.value ? getAiRecapContentReadiness(meeting.value) : null
);

const canGenerateAiSummary = computed(() =>
  Boolean(
    meeting.value &&
    meeting.value.status === 'completed' &&
    (aiRecapReadiness.value?.discussionSignalCount ?? 0) > 0 &&
    !aiSummary.value &&
    subscriptionStore.canGenerateAssistantRecap &&
    !aiSummaryRecovery.value
  )
);

const meetingDateLabel = computed(() =>
  meeting.value ? formatDate(getMeetingDate(meeting.value)) : ''
);

const allTasks = computed(
  () => meeting.value?.sections.flatMap((section) => section.tasks) ?? []
);

const allAgreements = computed(
  () => meeting.value?.sections.flatMap((section) => section.agreements) ?? []
);

const meetingParticipants = computed(
  () =>
    meeting.value?.participantIds
      .map((participantId) =>
        participantsStore.getParticipantById(participantId)
      )
      .filter((participant): participant is NonNullable<typeof participant> =>
        Boolean(participant)
      ) ?? []
);

const visibleParticipants = computed(() =>
  meetingParticipants.value.slice(0, 3)
);

const hiddenParticipantCount = computed(() =>
  Math.max(
    0,
    meetingParticipants.value.length - visibleParticipants.value.length
  )
);

const savedSections = computed(() =>
  splitSavedMeetingSections(meeting.value?.sections ?? [])
);

const savedSectionFormatters = computed<SavedMeetingFormatters>(() => ({
  formatNoteDate: formatDateTime,
  getParticipantName,
  getTaskStatusLabel: (status) => getTaskStatusLabel(status),
  getTaskResponsibleLabel: (task) => getTaskResponsibleLabel(task),
  formatDueDate,
}));

const regularSectionCards = computed(() =>
  savedSections.value.regularSections.map((section) =>
    createSavedMeetingSectionViewModel(
      {
        ...section,
        title: sectionTitle(section),
        prompt: sectionPrompt(section),
      },
      savedSectionFormatters.value
    )
  )
);

const finalSectionCard = computed(() => {
  const section = savedSections.value.finalSection;

  return section
    ? createSavedMeetingSectionViewModel(
        {
          ...section,
          title: sectionTitle(section),
          prompt: sectionPrompt(section),
        },
        savedSectionFormatters.value
      )
    : null;
});

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDueDate(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);

  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function getMeetingStatusLabel(item: Meeting) {
  return item.status === 'completed' ? t('export.finished') : t('export.draft');
}

function getTaskStatusLabel(status: MeetingTask['status'] | undefined) {
  if (!status) return t('followThrough.unknownStatus');
  return t(`meeting.taskStatus.${status}`);
}

function getParticipantName(participantId?: string) {
  if (!participantId) {
    return t('meeting.shared');
  }

  return (
    participantsStore.getParticipantById(participantId)?.name ??
    t('meeting.someone')
  );
}

function getTaskResponsibleLabel(
  task: Pick<
    MeetingTask | MeetingSummaryTask,
    'responsibilityType' | 'responsibleParticipantIds'
  >
) {
  if (task.responsibilityType === 'needsDiscussion') {
    return t('meeting.needsDiscussion');
  }

  if (!task.responsibleParticipantIds.length) {
    return t('meeting.unassigned');
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

function getExportContext(): MeetingExportContext {
  return {
    getParticipantName,
    locale: isSupportedLocale(locale.value) ? locale.value : 'en',
    formatDate,
    formatDateTime,
  };
}

function displayMeetingTitle(item: Meeting) {
  return getMeetingTemplateName(item.templateId, item.title);
}

function sectionTitle(section: Meeting['sections'][number]) {
  return getMeetingSectionTitle(section.id, section.title);
}

function sectionPrompt(section: Meeting['sections'][number]) {
  return getMeetingSectionPrompt(section.id, section.prompt);
}

function getSelectedExportFile() {
  if (!meeting.value) {
    return null;
  }

  return createMeetingExportFile(
    meeting.value,
    getExportContext(),
    exportFormat.value
  );
}

async function copySelectedExport() {
  const file = getSelectedExportFile();

  if (!file) {
    return;
  }

  isExporting.value = true;

  try {
    await copyExportToClipboard(file.content);
    showInAppNotification(t('meeting.copied'));
  } catch {
    showInAppNotification(t('meeting.copyFailed'), { tone: 'error' });
  } finally {
    isExporting.value = false;
  }
}

async function shareOrSaveSelectedExport() {
  const file = getSelectedExportFile();

  if (!file) {
    return;
  }

  isExporting.value = true;

  try {
    const didShare = await shareExportFile(file);

    if (didShare) {
      showInAppNotification(t('meeting.sharedExport'));
      return;
    }

    downloadExportFile(file);
    showInAppNotification(t('meeting.savedExport'));
  } catch {
    showInAppNotification(t('meeting.shareFailed'), { tone: 'error' });
  } finally {
    isExporting.value = false;
  }
}

async function printPdfExport() {
  if (!meeting.value || isExporting.value) {
    return;
  }

  isExporting.value = true;

  try {
    const delivery = await exportMeetingAsPdf(meeting.value.id);
    showInAppNotification(
      delivery === 'shared'
        ? t('meeting.sharedExport')
        : t('meeting.savedExport')
    );
  } catch (error) {
    const message =
      error instanceof ApiClientError && error.code === 'meeting_not_found'
        ? t('meeting.pdfRequiresSync')
        : t('meeting.pdfFailed');
    showInAppNotification(message, { tone: 'error' });
  } finally {
    isExporting.value = false;
  }
}

async function generateSummary() {
  if (
    !meeting.value ||
    isGeneratingSummary.value ||
    meeting.value.status !== 'completed' ||
    !aiRecapReadiness.value ||
    aiRecapReadiness.value.discussionSignalCount === 0 ||
    !subscriptionStore.canGenerateAssistantRecap
  ) {
    return;
  }

  if (!aiRecapReadiness.value.isReady) {
    pendingLowContentMeeting.value = meeting.value;
    isLowContentConfirmationOpen.value = true;
    return;
  }

  await generateSummaryForMeeting(meeting.value);
}

async function confirmLowContentGeneration() {
  const targetMeeting = pendingLowContentMeeting.value;
  pendingLowContentMeeting.value = null;
  isLowContentConfirmationOpen.value = false;

  if (!targetMeeting) {
    return;
  }

  await generateSummaryForMeeting(targetMeeting, true);
}

function deferLowContentGeneration() {
  pendingLowContentMeeting.value = null;
  isLowContentConfirmationOpen.value = false;
}

async function generateSummaryForMeeting(
  targetMeeting: Meeting,
  allowLowContent = false
) {
  if (isGeneratingSummary.value) {
    return;
  }

  aiSummaryRecovery.value = null;
  isGeneratingSummary.value = true;

  try {
    await generateMeetingSummary(targetMeeting, { allowLowContent });
  } catch (error) {
    aiSummaryRecovery.value = getAiRecapRecovery(error);
  } finally {
    isGeneratingSummary.value = false;
  }
}
</script>

<template>
  <section class="page-stack meeting-details-page">
    <div v-if="!meeting" class="content-panel">
      <h1>{{ t('meeting.meetingNotFound') }}</h1>
      <p>{{ t('meeting.notSaved') }}</p>
      <RouterLink class="secondary-button link-button" to="/history">
        {{ t('meeting.backToHistory') }}
      </RouterLink>
    </div>

    <template v-else>
      <header class="meeting-details-header">
        <div class="meeting-details-header__copy">
          <p class="page-kicker">{{ meetingDateLabel }}</p>
          <h1>{{ displayMeetingTitle(meeting) }}</h1>
          <p class="page-copy">
            <span>{{ getMeetingStatusLabel(meeting) }}</span>
            <span>{{ allTasks.length }} {{ t('meeting.tasks') }}</span>
            <span>
              {{ allAgreements.length }} {{ t('meeting.agreements') }}
            </span>
          </p>
          <div
            v-if="visibleParticipants.length"
            class="meeting-details-header__participants"
            :aria-label="t('meeting.participants')"
          >
            <ParticipantAvatar
              v-for="participant in visibleParticipants"
              :key="participant.id"
              class="meeting-details-header__avatar"
              :participant="participant"
              size="small"
            />
            <span
              v-if="hiddenParticipantCount"
              class="meeting-details-header__participant-count"
            >
              +{{ hiddenParticipantCount }}
            </span>
          </div>
        </div>
        <button
          v-if="meeting.status !== 'completed'"
          type="button"
          class="meeting-save"
          @click="resumeDraft"
        >
          {{ t('common.resume') }}
        </button>
      </header>

      <section
        class="meeting-summary-ai-card saved-meeting-ai-card ai-summary-panel"
      >
        <div class="ai-summary-panel__header">
          <div class="saved-meeting-ai-card__heading">
            <div class="meeting-summary-card-title">
              <span class="material-symbols-outlined" aria-hidden="true">
                auto_awesome
              </span>
              <h2>{{ t('meeting.aiSummary') }}</h2>
            </div>
            <p class="meeting-help">{{ t('meeting.aiDisclaimer') }}</p>
          </div>
          <button
            v-if="canGenerateAiSummary"
            data-testid="generate-meeting-recap"
            type="button"
            class="meeting-summary-ai-card__button ai-summary-panel__button"
            :disabled="isGeneratingSummary"
            @click="generateSummary"
          >
            {{
              t('meeting.generateSummary', { action: t('meeting.generate') })
            }}
          </button>
        </div>

        <RecapAllowanceStatus />
        <AiRecapRecoveryPanel
          v-if="aiSummaryRecovery"
          :recovery="aiSummaryRecovery"
          @retry="generateSummary"
        />

        <MeetingFollowThrough
          v-if="aiSummary"
          :meeting="meeting"
          :can-regenerate="
            meeting.status === 'completed' &&
            subscriptionStore.canGenerateAssistantRecap
          "
          :generating="isGeneratingSummary"
          @regenerate="generateSummary"
        />

        <div
          v-if="aiSummary && !aiSummary.followThrough"
          class="saved-meeting-ai-card__legacy"
        >
          <section v-if="aiSummary.mainTopics.length">
            <h3>{{ t('meeting.mainTopics') }}</h3>
            <ul>
              <li v-for="topic in aiSummary.mainTopics" :key="topic">
                {{ topic }}
              </li>
            </ul>
          </section>
          <section v-if="aiSummary.keyTensions.length">
            <h3>{{ t('meeting.keyTensions') }}</h3>
            <ul>
              <li v-for="tension in aiSummary.keyTensions" :key="tension">
                {{ tension }}
              </li>
            </ul>
          </section>
          <section v-if="aiSummary.agreements.length">
            <h3>{{ t('meeting.agreementsMade') }}</h3>
            <ul>
              <li v-for="agreement in aiSummary.agreements" :key="agreement">
                {{ agreement }}
              </li>
            </ul>
          </section>
          <section v-if="aiSummary.tasks.length">
            <h3>{{ t('meeting.tasks') }}</h3>
            <ul>
              <li v-for="task in aiSummary.tasks" :key="task.title">
                <strong>{{ task.title }}</strong>
                <span>
                  {{ getTaskStatusLabel(task.status) }} ·
                  {{ getTaskResponsibleLabel(task) }}
                </span>
              </li>
            </ul>
          </section>
          <section v-if="aiSummary.suggestedNextMeetingFocus.length">
            <h3>{{ t('meeting.revisitNextWeek') }}</h3>
            <ul>
              <li
                v-for="focus in aiSummary.suggestedNextMeetingFocus"
                :key="focus"
              >
                {{ focus }}
              </li>
            </ul>
          </section>
        </div>

        <p v-if="!aiSummary" class="meeting-empty">
          {{ t('meeting.generateEmpty') }}
        </p>
      </section>

      <SavedMeetingExportCard
        v-model:format="exportFormat"
        :available="canUseFeature('export')"
        :exporting="isExporting"
        @copy="copySelectedExport"
        @share="shareOrSaveSelectedExport"
        @pdf="printPdfExport"
      />

      <section class="saved-meeting-sections" aria-labelledby="sections-title">
        <header class="saved-meeting-sections__header">
          <h2 id="sections-title">
            {{ t('meeting.savedSummary.sectionsTitle') }}
          </h2>
          <span data-testid="saved-section-count">
            {{
              t('meeting.savedSummary.sectionCount', {
                count: regularSectionCards.length,
              })
            }}
          </span>
        </header>

        <SavedMeetingSectionCard
          v-for="section in regularSectionCards"
          :key="section.id"
          :section="section"
          variant="regular"
        />
      </section>

      <SavedMeetingSectionCard
        v-if="finalSectionCard"
        :section="finalSectionCard"
        variant="final"
      />
    </template>
    <ConfirmationDialog
      :open="isLowContentConfirmationOpen"
      :title="t('ai.recap.lowContent.title')"
      :message="t('ai.recap.lowContent.body')"
      :confirm-label="t('ai.recap.lowContent.generateAnyway')"
      :cancel-label="t('ai.recap.lowContent.addMore')"
      :loading="isGeneratingSummary"
      @close="deferLowContentGeneration"
      @confirm="confirmLowContentGeneration"
    />
  </section>
</template>

<style scoped>
.meeting-details-page {
  padding-bottom: calc(var(--section-gap) + env(safe-area-inset-bottom));
}

.meeting-details-header {
  border: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 34%, transparent);
  border-radius: 24px;
  background: var(--color-surface-lowest);
  box-shadow: var(--shadow-card);
  padding: 18px;
}

.meeting-details-header__copy {
  min-width: 0;
}

.meeting-details-header h1 {
  margin: 0;
  color: var(--color-on-surface);
  font-family: var(--font-display);
  font-size: clamp(1.55rem, 7vw, 2rem);
  line-height: 1.12;
}

.meeting-details-header .page-copy {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin: 2px 0 0;
  font-size: var(--font-size-label-lg);
}

.meeting-details-header .page-copy span + span::before {
  margin-right: 12px;
  color: var(--color-outline-variant);
  content: '•';
}

.meeting-details-header__participants {
  display: flex;
  margin-top: 10px;
  align-items: center;
}

.meeting-details-header__avatar + .meeting-details-header__avatar,
.meeting-details-header__participant-count {
  margin-left: -7px;
}

.meeting-details-header__avatar {
  border: 2px solid var(--color-surface-lowest);
  border-radius: 50%;
}

.meeting-details-header__participant-count {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 2px solid var(--color-surface-lowest);
  border-radius: 50%;
  background: var(--color-primary-fixed);
  color: var(--color-primary);
  font-size: var(--font-size-label-sm);
  font-weight: 800;
}

.saved-meeting-ai-card {
  display: grid;
  gap: 14px;
}

.saved-meeting-ai-card__heading {
  display: grid;
  gap: 6px;
}

.saved-meeting-ai-card__heading .meeting-help {
  margin: 0;
}

.saved-meeting-ai-card__legacy {
  display: grid;
  gap: 14px;
}

.saved-meeting-ai-card__legacy section {
  display: grid;
  gap: 7px;
}

.saved-meeting-ai-card__legacy h3,
.saved-meeting-ai-card__legacy ul {
  margin: 0;
}

.saved-meeting-ai-card__legacy h3 {
  color: var(--color-outline);
  font-size: var(--font-size-label-sm);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.saved-meeting-ai-card__legacy ul {
  display: grid;
  gap: 8px;
  border: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 38%, transparent);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  list-style-position: inside;
}

.saved-meeting-ai-card__legacy li {
  color: var(--color-on-surface);
  font-size: var(--font-size-label-lg);
  line-height: 1.45;
}

.saved-meeting-ai-card__legacy li strong,
.saved-meeting-ai-card__legacy li span {
  display: block;
}

.saved-meeting-ai-card__legacy li span {
  margin-top: 2px;
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-label-sm);
}

.saved-meeting-ai-card :deep(.ai-summary-panel__header) {
  align-items: start;
}

.saved-meeting-sections {
  display: grid;
  gap: 14px;
}

.saved-meeting-sections__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-inline: 4px;
}

.saved-meeting-sections__header h2,
.saved-meeting-sections__header span {
  margin: 0;
}

.saved-meeting-sections__header h2 {
  color: var(--color-outline);
  font-size: var(--font-size-label-lg);
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.saved-meeting-sections__header span {
  color: var(--color-primary);
  font-size: var(--font-size-label-sm);
}

@media (max-width: 360px) {
  .meeting-details-header {
    grid-template-columns: 1fr;
  }

  .meeting-details-header .meeting-save {
    width: 100%;
  }

  .meeting-details-header .page-copy span + span::before {
    display: none;
  }
}
</style>
