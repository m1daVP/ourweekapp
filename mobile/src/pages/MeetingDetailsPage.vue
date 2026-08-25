<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useMeetingsStore } from '@/app/stores/meetings';
import { useParticipantsStore } from '@/app/stores/participants';
import {
  copyExportToClipboard,
  createMeetingExportFile,
  downloadExportFile,
  exportMeetingAsPdf,
  shareExportFile,
  type MeetingExportFormat,
} from '@/features/export/services/exportService';
import {
  generateMeetingSummary,
  getAiQuotaMessage,
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
import PremiumLock from '@/shared/components/PremiumLock.vue';
import { useFeatureAccess } from '@/shared/composables/useFeatureAccess';

const meetingsStore = useMeetingsStore();
const { t, locale } = useI18n();
const participantsStore = useParticipantsStore();
const route = useRoute();
const router = useRouter();
const { canUseFeature } = useFeatureAccess();

const meetingId = computed(() => String(route.params.meetingId ?? ''));
const isGeneratingSummary = ref(false);
const aiSummaryError = ref('');
const isExportModalOpen = ref(false);
const isExporting = ref(false);
const exportFormat = ref<MeetingExportFormat>('text');
const exportStatus = ref('');
const exportError = ref('');

const meeting = computed(
  () =>
    meetingsStore.meetings.find((item) => item.id === meetingId.value) ?? null
);

const aiSummary = computed(() => meeting.value?.aiSummary ?? null);

const canGenerateAiSummary = computed(() =>
  Boolean(
    meeting.value &&
    meeting.value.status === 'completed' &&
    !aiSummary.value &&
    canUseFeature('aiSummary')
  )
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

  return t('meeting.noContentPreview');
}

function getMeetingStatusLabel(item: Meeting) {
  return item.status === 'completed' ? t('export.finished') : t('export.draft');
}

function getTaskStatusLabel(status: MeetingTask['status']) {
  return t(`meeting.taskStatus.${status}`);
}

function getParticipantName(participantId: string) {
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

function getExportContext() {
  return {
    getParticipantName,
    locale: locale.value,
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

function openExportModal() {
  if (!meeting.value || !canUseFeature('export')) {
    return;
  }

  exportStatus.value = '';
  exportError.value = '';
  isExportModalOpen.value = true;
}

function closeExportModal() {
  if (isExporting.value) {
    return;
  }

  isExportModalOpen.value = false;
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

  exportStatus.value = '';
  exportError.value = '';
  isExporting.value = true;

  try {
    await copyExportToClipboard(file.content);
    exportStatus.value = t('meeting.copied');
  } catch {
    exportError.value = t('meeting.copyFailed');
  } finally {
    isExporting.value = false;
  }
}

async function shareOrSaveSelectedExport() {
  const file = getSelectedExportFile();

  if (!file) {
    return;
  }

  exportStatus.value = '';
  exportError.value = '';
  isExporting.value = true;

  try {
    const didShare = await shareExportFile(file);

    if (didShare) {
      exportStatus.value = t('meeting.sharedExport');
      return;
    }

    downloadExportFile(file);
    exportStatus.value = t('meeting.savedExport');
  } catch {
    exportError.value = t('meeting.shareFailed');
  } finally {
    isExporting.value = false;
  }
}

function printPdfExport() {
  if (!meeting.value) {
    return;
  }

  exportStatus.value = '';
  exportError.value = '';

  const didOpen = exportMeetingAsPdf(meeting.value, getExportContext());

  if (didOpen) {
    exportStatus.value = t('meeting.printOpened');
    return;
  }

  exportError.value = t('meeting.printFailed');
}

async function generateSummary() {
  if (
    !meeting.value ||
    isGeneratingSummary.value ||
    !canGenerateAiSummary.value
  ) {
    return;
  }

  aiSummaryError.value = '';
  isGeneratingSummary.value = true;

  try {
    const summary = await generateMeetingSummary(meeting.value);
    meetingsStore.saveAiSummary(meeting.value.id, summary);
  } catch (error) {
    aiSummaryError.value = getAiQuotaMessage(error) ?? t('meeting.generateFailed');
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
        <div>
          <p class="page-kicker">{{ meetingDateLabel }}</p>
          <h1>{{ displayMeetingTitle(meeting) }}</h1>
          <p class="page-copy">
            {{ getMeetingStatusLabel(meeting) }} - {{ allTasks.length }}
            {{ t('meeting.tasks') }} - {{ allAgreements.length }}
            {{ t('meeting.agreements') }}
          </p>
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

      <PremiumLock
        feature="export"
        :title="t('meeting.exportPremiumTitle')"
        :message="t('meeting.exportPremiumMessage')"
      >
        <section class="meeting-panel export-panel">
          <div>
            <h2>{{ t('meeting.exportMeeting') }}</h2>
            <p class="meeting-help">{{ t('meeting.exportHelp') }}</p>
          </div>
          <button
            type="button"
            class="meeting-primary"
            @click="openExportModal"
          >
            {{ t('common.export') }}
          </button>
        </section>
      </PremiumLock>

      <PremiumLock
        feature="aiSummary"
        :title="t('meeting.aiPremiumTitle')"
        :message="t('meeting.aiPremiumMessage')"
      >
        <section class="meeting-panel ai-summary-panel">
          <div class="ai-summary-panel__header">
            <div>
              <h2>{{ t('meeting.aiSummary') }}</h2>
              <p class="meeting-help">{{ t('meeting.aiDisclaimer') }}</p>
            </div>
            <button
              v-if="canGenerateAiSummary"
              type="button"
              class="meeting-primary ai-summary-panel__button"
              :disabled="isGeneratingSummary"
              @click="generateSummary"
            >
              {{
                t('meeting.generateSummary', { action: t('meeting.generate') })
              }}
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
              <h3>{{ t('meeting.mainTopics') }}</h3>
              <ul class="meeting-list">
                <li v-for="topic in aiSummary.mainTopics" :key="topic">
                  <p>{{ topic }}</p>
                </li>
              </ul>
            </div>

            <div class="meeting-summary__group">
              <h3>{{ t('meeting.keyTensions') }}</h3>
              <ul class="meeting-list">
                <li v-for="tension in aiSummary.keyTensions" :key="tension">
                  <p>{{ tension }}</p>
                </li>
              </ul>
            </div>

            <div class="meeting-summary__group">
              <h3>{{ t('meeting.agreementsMade') }}</h3>
              <ul class="meeting-list">
                <li v-for="agreement in aiSummary.agreements" :key="agreement">
                  <p>{{ agreement }}</p>
                </li>
              </ul>
            </div>

            <div class="meeting-summary__group">
              <h3>{{ t('meeting.openTasks') }}</h3>
              <ul
                v-if="aiSummary.tasks.length"
                class="meeting-list meeting-task-list"
              >
                <li v-for="task in aiSummary.tasks" :key="task.title">
                  <div>
                    <strong>{{ task.title }}</strong>
                    <p v-if="task.description">{{ task.description }}</p>
                    <small>
                      {{ getTaskStatusLabel(task.status) }} -
                      {{ getTaskResponsibleLabel(task) }}
                      <template v-if="task.dueDate">
                        - {{ t('common.due') }} {{ task.dueDate }}</template
                      >
                    </small>
                  </div>
                </li>
              </ul>
              <p v-else class="meeting-empty">
                {{ t('meeting.noOpenTasksSummarized') }}
              </p>
            </div>

            <div class="meeting-summary__group">
              <h3>{{ t('meeting.revisitNextWeek') }}</h3>
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
            {{ t('meeting.generateEmpty') }}
          </p>
        </section>
      </PremiumLock>

      <section
        v-for="section in meeting.sections"
        :key="section.id"
        class="meeting-panel meeting-details-section"
      >
        <h2>{{ sectionTitle(section) }}</h2>
        <p class="meeting-help">{{ sectionPrompt(section) }}</p>

        <div class="meeting-summary__group">
          <h3>{{ t('meeting.notes') }}</h3>
          <ul v-if="section.notes.length" class="meeting-list">
            <li v-for="note in section.notes" :key="note.id">
              <span>
                {{ getParticipantName(note.participantId) }} -
                {{ formatDateTime(note.createdAt) }}
              </span>
              <p>{{ note.text }}</p>
            </li>
          </ul>
          <p v-else class="meeting-empty">
            {{ t('meeting.noNotesInSection') }}
          </p>
        </div>

        <div class="meeting-summary__group">
          <h3>{{ t('meeting.tasks') }}</h3>
          <ul
            v-if="section.tasks.length"
            class="meeting-list meeting-task-list"
          >
            <li v-for="task in section.tasks" :key="task.id">
              <div>
                <strong>{{ task.title }}</strong>
                <p v-if="task.description">{{ task.description }}</p>
                <small>
                  {{ getTaskStatusLabel(task.status) }} -
                  {{ getTaskResponsibleLabel(task) }}
                  <template v-if="task.dueDate">
                    - {{ t('common.due') }} {{ task.dueDate }}</template
                  >
                </small>
              </div>
            </li>
          </ul>
          <p v-else class="meeting-empty">
            {{ t('meeting.noTasksInSection') }}
          </p>
        </div>

        <div class="meeting-summary__group">
          <h3>{{ t('meeting.agreements') }}</h3>
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
          <p v-else class="meeting-empty">
            {{ t('meeting.noAgreementsInSection') }}
          </p>
        </div>
      </section>

      <div
        v-if="isExportModalOpen"
        class="agreement-modal export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        <div class="agreement-modal__panel export-modal__panel">
          <div>
            <p class="page-kicker">{{ t('common.export') }}</p>
            <h2 id="export-modal-title">{{ displayMeetingTitle(meeting) }}</h2>
            <p class="meeting-help">{{ t('meeting.exportChoose') }}</p>
          </div>

          <fieldset class="export-format-options">
            <legend>{{ t('meeting.format') }}</legend>
            <label
              :class="{ 'is-selected': exportFormat === 'text' }"
              for="export-format-text"
            >
              <input
                id="export-format-text"
                v-model="exportFormat"
                type="radio"
                value="text"
              />
              <span>
                <strong>{{ t('meeting.plainText') }}</strong>
                <small>{{ t('meeting.plainTextHelp') }}</small>
              </span>
            </label>
            <label
              :class="{ 'is-selected': exportFormat === 'markdown' }"
              for="export-format-markdown"
            >
              <input
                id="export-format-markdown"
                v-model="exportFormat"
                type="radio"
                value="markdown"
              />
              <span>
                <strong>{{ t('common.markdown') }}</strong>
                <small>{{ t('meeting.markdownHelp') }}</small>
              </span>
            </label>
          </fieldset>

          <div class="export-modal__actions">
            <button
              type="button"
              class="meeting-primary"
              :disabled="isExporting"
              @click="copySelectedExport"
            >
              {{ t('common.copy') }}
            </button>
            <button
              type="button"
              :disabled="isExporting"
              @click="shareOrSaveSelectedExport"
            >
              {{ t('common.shareOrSave') }}
            </button>
            <button
              type="button"
              :disabled="isExporting"
              @click="printPdfExport"
            >
              {{ t('common.pdf') }}
            </button>
            <button
              type="button"
              :disabled="isExporting"
              @click="closeExportModal"
            >
              {{ t('common.close') }}
            </button>
          </div>

          <p v-if="exportStatus" class="meeting-status">{{ exportStatus }}</p>
          <p v-if="exportError" class="meeting-error">{{ exportError }}</p>
        </div>
      </div>
    </template>
  </section>
</template>
