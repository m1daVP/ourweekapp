<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  EnrichedAgreement,
  EnrichedMeetingNote,
  EnrichedMeetingTask,
  MeetingReviewCounts,
} from '@/features/meeting/composables/useMeetingSession';
import AnchoredActionMenu, {
  type AnchoredActionMenuItem,
} from '@/shared/components/AnchoredActionMenu.vue';
import MeetingDisclosurePanel from './MeetingDisclosurePanel.vue';

const props = defineProps<{
  allAgreements: EnrichedAgreement[];
  allNotes: EnrichedMeetingNote[];
  allTasks: EnrichedMeetingTask[];
  canCreateMeeting: boolean;
  canEditMeeting: boolean;
  canEditTasks: boolean;
  formError: string;
  hasMeetingContent: boolean;
  isCompleted: boolean;
  isFinishingMeeting: boolean;
  meetingDurationLabel: string;
  progressPercent: string;
  reviewCounts: MeetingReviewCounts;
  statusMessage: string;
}>();

const emit = defineEmits<{
  'delete-agreement': [agreementId: string];
  'delete-note': [noteId: string];
  'delete-task': [taskId: string];
  capture: [type: 'note' | 'task' | 'agreement'];
  'edit-agreement': [agreement: EnrichedAgreement];
  'edit-note': [note: EnrichedMeetingNote];
  'edit-actions': [];
  'edit-task': [task: EnrichedMeetingTask];
  exit: [];
  finish: [];
  'go-back': [];
  'open-menu': [];
  'start-new': [];
  'toggle-task': [taskId: string, status: EnrichedMeetingTask['status']];
}>();

const { t, te } = useI18n();
const areNotesExpanded = ref(false);
const emptyReviewText = () =>
  te('meeting.reviewEmpty')
    ? t('meeting.reviewEmpty')
    : 'You made time to check in. Nothing was recorded.';
const notesToggleText = computed(() => {
  const key = areNotesExpanded.value
    ? 'meeting.hideRecordedNotes'
    : 'meeting.showRecordedNotes';
  const fallback = areNotesExpanded.value ? 'Hide notes' : 'Show notes';
  return te(key) ? t(key) : fallback;
});
const notesDisclosureLabel = computed(
  () => `${notesToggleText.value} (${props.reviewCounts.notes})`
);
const itemActions = computed<AnchoredActionMenuItem[]>(() => [
  { id: 'edit', label: t('common.edit'), icon: 'edit' },
  {
    id: 'delete',
    label: t('common.delete'),
    icon: 'delete_outline',
    variant: 'destructive',
  },
]);
const notesBySection = computed(() => {
  const groups = new Map<string, EnrichedMeetingNote[]>();

  for (const note of props.allNotes) {
    groups.set(note.sectionTitle, [
      ...(groups.get(note.sectionTitle) ?? []),
      note,
    ]);
  }

  return [...groups.entries()].map(([sectionTitle, notes]) => ({
    sectionTitle,
    notes,
  }));
});

function handleTaskAction(actionId: string, task: EnrichedMeetingTask) {
  if (actionId === 'edit') {
    emit('edit-task', task);
  }

  if (actionId === 'delete') {
    emit('delete-task', task.id);
  }
}

function handleAgreementAction(actionId: string, agreement: EnrichedAgreement) {
  if (actionId === 'edit') {
    emit('edit-agreement', agreement);
  }

  if (actionId === 'delete') {
    emit('delete-agreement', agreement.id);
  }
}

function handleNoteAction(actionId: string, note: EnrichedMeetingNote) {
  if (actionId === 'edit') {
    emit('edit-note', note);
  }

  if (actionId === 'delete') {
    emit('delete-note', note.id);
  }
}
</script>

<template>
  <article class="meeting-page--review-close">
    <header class="review-close-top-bar">
      <button
        class="review-close-icon material-symbols-outlined"
        type="button"
        :aria-label="t('meeting.closeMeeting')"
        @click="emit('exit')"
      >
        close
      </button>
      <h1>{{ t('meeting.reviewCloseTitle') }}</h1>
      <button
        class="review-close-icon material-symbols-outlined"
        type="button"
        :aria-label="t('meeting.menu.open')"
        :disabled="isCompleted || !canEditMeeting"
        @click="emit('open-menu')"
      >
        more_vert
      </button>
    </header>

    <main class="review-close-content">
      <section
        class="review-close-progress"
        :aria-label="t('meeting.progressCompleteLabel')"
      >
        <div class="review-close-progress__labels">
          <span>{{ t('meeting.meetingProgress') }}</span>
          <strong>100%</strong>
        </div>
        <div class="review-close-progress__track">
          <div
            class="review-close-progress__bar"
            :style="{ width: progressPercent }"
          />
        </div>
      </section>

      <section class="review-close-hero" aria-labelledby="review-close-title">
        <span
          class="review-close-hero__icon material-symbols-outlined"
          aria-hidden="true"
        >
          check_circle
        </span>
        <h2 id="review-close-title">{{ t('meeting.reviewReadyTitle') }}</h2>
        <p>{{ t('meeting.reviewReadyText') }}</p>
      </section>

      <!-- <section
        class="review-close-stats"
        :aria-label="t('meeting.meetingMetadata')"
      >
        <article class="review-close-stat-card">
          <span
            class="review-close-stat-card__icon material-symbols-outlined"
            aria-hidden="true"
          >
            schedule
          </span>
          <h3>{{ t('meeting.timeSpent') }}</h3>
          <p>{{ meetingDurationLabel }}</p>
        </article>
      </section> -->

      <section
        v-if="allTasks.length"
        class="review-close-card review-close-actions-card"
        aria-labelledby="review-close-actions-title"
      >
        <header class="review-close-card__header">
          <span
            class="review-close-card__title-icon material-symbols-outlined"
            aria-hidden="true"
          >
            task_alt
          </span>
          <h3 id="review-close-actions-title">
            {{ t('meeting.agreedActions') }}
          </h3>
          <span class="review-close-badge">
            {{ t('meeting.itemCount', { count: reviewCounts.tasks }) }}
          </span>
        </header>

        <ul v-if="allTasks.length" class="review-close-action-list">
          <li v-for="task in allTasks" :key="task.id">
            <button
              type="button"
              class="review-close-task-toggle"
              :data-testid="`review-task-toggle-${task.id}`"
              :aria-label="
                task.status === 'done'
                  ? t('meeting.markTaskOpen', { title: task.title })
                  : t('meeting.markTaskDone', { title: task.title })
              "
              :disabled="!canEditTasks || isCompleted"
              @click="emit('toggle-task', task.id, task.status)"
            >
              <span class="material-symbols-outlined" aria-hidden="true">
                {{
                  task.status === 'done'
                    ? 'check_circle'
                    : 'radio_button_unchecked'
                }}
              </span>
            </button>
            <span>
              {{ task.title }}
              <small>{{ task.responsibilityLabel }}</small>
            </span>
            <AnchoredActionMenu
              v-if="canEditTasks && !isCompleted"
              :items="itemActions"
              :menu-label="t('meeting.itemActionsAria', { item: task.title })"
              :trigger-label="
                t('meeting.itemActionsAria', { item: task.title })
              "
              @select="handleTaskAction($event, task)"
            />
          </li>
        </ul>
      </section>

      <section
        v-if="allAgreements.length"
        class="review-close-card review-close-card--agreements"
        aria-labelledby="review-close-agreements-title"
      >
        <header class="review-close-card__header">
          <span
            class="review-close-card__title-icon material-symbols-outlined"
            aria-hidden="true"
          >
            handshake
          </span>
          <h3 id="review-close-agreements-title">
            {{ t('meeting.agreements') }}
          </h3>
          <span class="review-close-badge">
            {{ t('meeting.itemCount', { count: reviewCounts.agreements }) }}
          </span>
        </header>

        <ul
          v-if="allAgreements.length"
          class="review-close-text-list review-close-text-list--actions"
        >
          <li v-for="agreement in allAgreements" :key="agreement.id">
            <div>
              <!-- <span>{{ agreement.participantLabel }}</span> -->
              <p>«{{ agreement.text }}»</p>
            </div>
            <AnchoredActionMenu
              v-if="canEditMeeting && !isCompleted"
              :items="itemActions"
              :menu-label="
                t('meeting.itemActionsAria', { item: agreement.text })
              "
              :trigger-label="
                t('meeting.itemActionsAria', { item: agreement.text })
              "
              @select="handleAgreementAction($event, agreement)"
            />
          </li>
        </ul>
      </section>

      <section
        v-if="allNotes.length"
        class="review-close-card review-close-card--notes"
        aria-labelledby="review-close-notes-title"
      >
        <header class="review-close-card__header">
          <span
            class="review-close-card__title-icon material-symbols-outlined"
            aria-hidden="true"
          >
            edit_note
          </span>
          <h3 id="review-close-notes-title">{{ t('meeting.notes') }}</h3>
          <span class="review-close-badge">
            {{ t('meeting.itemCount', { count: reviewCounts.notes }) }}
          </span>
        </header>

        <p class="review-close-notes-intro">
          {{ t('meeting.notesReviewIntro') }}
        </p>

        <MeetingDisclosurePanel
          class="review-close-notes-picker"
          data-testid="review-notes-picker"
          :open="areNotesExpanded"
          :label="notesDisclosureLabel"
          controls="review-close-notes-list"
          @toggle="areNotesExpanded = !areNotesExpanded"
        >
          <ul class="review-close-note-groups">
            <li v-for="group in notesBySection" :key="group.sectionTitle">
              <span>{{ group.sectionTitle }}</span>
              <ul
                class="review-close-text-list review-close-text-list--actions"
              >
                <li v-for="note in group.notes" :key="note.id">
                  <div>
                    <!-- <span>{{ note.participantName }}</span> -->
                    <p>{{ note.text }}</p>
                  </div>
                  <AnchoredActionMenu
                    v-if="canEditMeeting && !isCompleted"
                    :items="itemActions"
                    :menu-label="
                      t('meeting.itemActionsAria', { item: note.text })
                    "
                    :trigger-label="
                      t('meeting.itemActionsAria', { item: note.text })
                    "
                    @select="handleNoteAction($event, note)"
                  />
                </li>
              </ul>
            </li>
          </ul>
        </MeetingDisclosurePanel>
      </section>

      <section v-if="!hasMeetingContent" class="review-close-card">
        <p class="review-close-empty">{{ emptyReviewText() }}</p>
      </section>
      <section
        v-if="!isCompleted && canEditMeeting"
        class="review-close-card review-close-card--capture"
      >
        <p class="meeting-help">{{ t('meeting.reviewReadyText') }}</p>
        <div class="review-close-capture-actions">
          <button
            type="button"
            class="review-close-edit"
            @click="emit('capture', 'agreement')"
          >
            <span class="material-symbols-outlined" aria-hidden="true"
              >add</span
            >
            {{ t('meeting.addAgreement') }}
          </button>
          <button
            type="button"
            class="review-close-edit"
            @click="emit('capture', 'task')"
          >
            <span class="material-symbols-outlined" aria-hidden="true"
              >add</span
            >
            {{ t('meeting.addTask') }}
          </button>
          <button
            type="button"
            class="review-close-edit"
            data-testid="review-capture-note"
            @click="emit('capture', 'note')"
          >
            <span class="material-symbols-outlined" aria-hidden="true"
              >add</span
            >
            {{ t('meeting.addNote') }}
          </button>
        </div>
      </section>
      <p v-if="formError" class="meeting-error" role="alert">
        {{ formError }}
      </p>
      <p v-if="statusMessage" class="meeting-status" role="status">
        {{ statusMessage }}
      </p>
    </main>

    <footer
      class="review-close-bottom-actions floating-bottom-block meeting-step-actions meeting-step-actions--review"
    >
      <button
        class="review-close-back"
        type="button"
        :disabled="!canEditMeeting"
        @click="emit('go-back')"
      >
        {{ t('meeting.goBackEdit') }}
      </button>
      <button
        v-if="!isCompleted && canEditMeeting"
        class="review-close-finish"
        data-testid="review-finish"
        type="button"
        :disabled="isFinishingMeeting"
        @click="emit('finish')"
      >
        <span class="material-symbols-outlined" aria-hidden="true">
          done_all
        </span>
        <span>
          {{
            isFinishingMeeting
              ? t('meeting.finishingMeeting')
              : t('common.finish')
          }}
        </span>
      </button>
      <button
        v-else-if="canCreateMeeting"
        class="review-close-finish"
        type="button"
        @click="emit('start-new')"
      >
        <span class="material-symbols-outlined" aria-hidden="true">
          add_circle
        </span>
        <span>{{ t('meeting.newMeeting') }}</span>
      </button>
    </footer>
  </article>
</template>

<style scoped>
/* :global(.app-shell:has(.meeting-page--review-close)) {
  background: #faf9f5;
}

:global(.app-shell:has(.meeting-page--review-close) .app-main) {
  padding: 0;
  background: #faf9f5;
}

:global(.meeting-page:has(.meeting-page--review-close)) {
  min-height: 100%;
  gap: 0;
} */

.meeting-page--review-close {
  display: flex;
  width: 100%;
  min-height: 100%;
  flex-direction: column;
  background: #faf9f5;
  color: #1a1c1a;
}

.review-close-top-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 52px;
  min-height: calc(72px + env(safe-area-inset-top));
  align-items: center;
  padding: env(safe-area-inset-top) 0 0;
  background: #faf9f5;
}

.review-close-top-bar h1 {
  margin: 0;
  color: var(--color-primary);
  font-family: var(--font-display);
  font-size: var(--font-size-headline-lg);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.18;
  text-align: center;
}

.review-close-icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: #30362f;
  font-size: 2rem;
  box-shadow: none;
}

.review-close-icon:disabled {
  opacity: 0.48;
}

.review-close-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  padding: 12px 0 0;
}

.review-close-progress {
  display: grid;
  gap: 6px;
}

.review-close-progress__labels {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  color: #30362f;
  font-family: var(--font-display);
  font-size: var(--font-size-body-md);
  line-height: 1.3;
}

.review-close-progress__labels strong {
  color: var(--color-primary);
  font-weight: 700;
}

.review-close-progress__track {
  height: 6px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-outline-variant) 42%, white);
}

.review-close-progress__bar {
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
}

.review-close-hero {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 16px 0 12px;
  text-align: center;
}

.review-close-hero__icon {
  display: grid;
  width: 72px;
  height: 72px;
  border: 3px solid #e4eee3;
  place-items: center;
  border-radius: var(--radius-pill);
  background: #c9e2cd;
  color: var(--color-primary);
  font-size: 2.35rem;
  font-variation-settings:
    'FILL' 0,
    'wght' 500,
    'GRAD' 0,
    'opsz' 48;
}

.review-close-hero h2 {
  margin: 6px 0 0;
  color: #101210;
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 7vw, 2.05rem);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.16;
}

.review-close-hero p {
  max-width: 20em;
  color: #5d685e;
  font-family: var(--font-body);
  font-size: var(--font-size-body-md);
  line-height: 1.42;
}

.review-close-card {
  display: grid;
  gap: 12px;
  border: 1px solid #e8e0d3;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(47, 42, 38, 0.06);
  padding: 16px;
}

.review-close-card__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  border-bottom: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 58%, white);
  padding-bottom: 12px;
}

.review-close-card__title-icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 50%;
  background: #f1f5f0;
  color: #365e3c;
  font-size: 1.35rem;
  font-variation-settings:
    'FILL' 0,
    'wght' 500,
    'GRAD' 0,
    'opsz' 32;
}

.review-close-card__header h3 {
  margin: 0;
  overflow-wrap: anywhere;
  color: #101210;
  font-family: var(--font-display);
  font-size: var(--font-size-body-md);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.18;
}

.review-close-badge {
  display: inline-flex;
  /* min-height: 34px; */
  align-items: center;
  border-radius: var(--radius-pill);
  border: 1px solid #eadbc8;
  background: #f7efe3;
  padding: 2px 12px;
  color: #81571f;
  font-family: var(--font-display);
  font-size: var(--font-size-label-sm);
  font-weight: 600;
  white-space: nowrap;
}

.review-close-action-list,
.review-close-text-list,
.review-close-note-groups {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.review-close-action-list li {
  display: flex;
  align-items: center;
  /* grid-template-columns: auto minmax(0, 1fr) auto; */
  gap: 4px;
  align-items: start;
  border: 1px solid #ebe2d5;
  border-radius: 18px;
  background: #fcfbf8;
  padding: 14px;
  color: #30362f;
  font-family: var(--font-display);
  font-size: var(--font-size-body-md);
  line-height: 1.42;
}

.review-close-action-list li > span,
.review-close-text-list p {
  overflow-wrap: anywhere;
}

.review-close-action-list li > span:not(.anchored-action-menu) {
  flex-grow: 1;
}

.review-close-action-list small {
  display: block;
  margin-top: 2px;
  width: fit-content;
  border-radius: 8px;
  background: #eef4ef;
  padding: 2px 8px;
  color: #5d705f;
  font-family: var(--font-body);
  font-size: var(--font-size-label-sm);
  font-weight: 650;
}

.review-close-text-list li {
  display: flex;
  gap: 4px;
}

.review-close-note-groups > li {
  display: grid;
  gap: 12px;
}

.review-close-note-groups > li > span {
  font-weight: 600;
  color: var(--color-secondary);
}

.review-close-note-groups .review-close-text-list--actions {
  gap: 12px;
}

.review-close-note-groups .review-close-text-list--actions > li {
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 48%, white);
  border-radius: var(--radius-md);
  background: #fff;
  padding: 14px 12px;
}

.review-close-card--agreements .review-close-text-list--actions > li {
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 58%, white);
  border-radius: 20px;
  background: #fbfaf7;
  padding: 16px;
}

.review-close-card--agreements .review-close-text-list--actions p {
  margin: 8px 0 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-style: italic;
  line-height: 1.55;
}

.review-close-notes-intro {
  margin: 0;
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-body-md);
  line-height: 1.45;
}

.review-close-notes-picker:deep(.meeting-disclosure-panel) {
  border: 1px solid #e4ddd0;
  border-radius: 18px;
  background: #f8f7f2;
}

.review-close-notes-picker :deep(.meeting-disclosure-panel__toggle) {
  min-height: 48px;
  justify-content: center;
  border: 0;
  border-radius: 18px;
  background: transparent;
  color: var(--color-primary);
  font-family: var(--font-display);
  font-size: var(--font-size-body-md);
  font-weight: 700;
}

.review-close-notes-picker :deep(.meeting-disclosure-panel__label) {
  flex: 0 1 auto;
}

.review-close-notes-picker :deep(.meeting-disclosure-panel__chevron) {
  width: 36px;
  height: 36px;
  background: transparent;
}

.review-close-notes-picker :deep(.meeting-disclosure-panel__reveal-inner) {
  padding: 0;
}

.review-close-notes-picker.is-open
  :deep(.meeting-disclosure-panel__reveal-inner) {
  padding: 0 10px 10px;
}

.review-close-text-list--actions li > div {
  min-width: 0;
}

.review-close-text-list span {
  color: var(--color-outline);
  font-size: var(--font-size-label-sm);
  font-weight: 800;
}

.review-close-text-list p {
  color: #30362f;
  font-family: var(--font-display);
  font-size: 0.95rem;
  line-height: 1.42;
}

.review-close-capture-actions {
  justify-content: center;
  border: 1px solid #e4ddd0;
  border: 0;
  border-radius: 18px;
  background: #f7f5ed;
  padding: 12px;
}
.review-close-capture-actions .review-close-edit {
  min-height: 40px;
  border: 1px solid #ded5c6;
  border-radius: var(--radius-pill);
  background: var(--color-surface-lowest);
  padding: 0 12px;
  box-shadow: 0 2px 4px rgb(47 42 38 / 10%);
  font-size: var(--font-size-label-lg);
  font-weight: 600;
}

.review-close-task-toggle {
  display: grid;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  min-height: 36px;
  place-items: center;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  padding: 0;
  color: color-mix(in srgb, var(--color-outline) 76%, #30362f);
  box-shadow: none;
}

.review-close-task-toggle .material-symbols-outlined {
  font-size: 1.7rem;
  font-variation-settings:
    'FILL' 0,
    'wght' 300,
    'GRAD' 0,
    'opsz' 32;
}

.review-close-task-toggle:disabled {
  opacity: 0.5;
}

.review-close-empty {
  color: var(--color-outline);
  font-size: var(--font-size-label-lg);
  font-weight: 650;
}

.review-close-edit {
  display: inline-flex;
  width: fit-content;
  min-height: 32px;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--color-primary);
  font-weight: 850;
  box-shadow: none;
}

.review-close-edit .material-symbols-outlined {
  font-size: 1.15rem;
  font-variation-settings:
    'FILL' 0,
    'wght' 600,
    'GRAD' 0,
    'opsz' 20;
}

.review-close-capture-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.review-close-card--capture {
  gap: 10px;
  border-color: #e4ddd0;
  background: #f7f5ed;
  padding: 16px 12px;
  text-align: center;
}

.review-close-card--capture .meeting-help {
  margin: 0;
  color: #536057;
  font-size: var(--font-size-body-md);
}

.review-close-stats {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.review-close-stat-card {
  display: grid;
  min-height: 132px;
  place-items: center;
  align-content: center;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 42%, white);
  border-radius: 0;
  background: var(--color-surface-lowest);
  box-shadow: 0 8px 24px rgba(47, 42, 38, 0.06);
  padding: 22px 12px;
  text-align: center;
}

.review-close-stat-card__icon {
  color: var(--color-primary);
  font-size: 2rem;
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 32;
}

.review-close-stat-card h3 {
  margin: 0;
  color: #101210;
  font-family: var(--font-display);
  font-size: var(--font-size-headline-md);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.2;
}

.review-close-stat-card p {
  color: #30362f;
  font-family: var(--font-display);
  font-size: var(--font-size-body-lg);
  line-height: 1.28;
}

.review-close-bottom-actions {
  margin: auto auto 0;
  border: 1px solid #e4ddd0;
  border-radius: 999px;
  background: #fff;
  padding: 6px;
}

.review-close-finish {
  min-height: 56px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--color-on-primary);
  border-radius: var(--radius-pill);
  background: #294d30;
  box-shadow: 0 5px 12px rgb(41 77 48 / 22%);
  font-weight: 800;
}

.review-close-finish .material-symbols-outlined {
  font-size: 1.5rem;
  font-variation-settings:
    'FILL' 0,
    'wght' 600,
    'GRAD' 0,
    'opsz' 32;
}

.review-close-back {
  min-height: 56px;
  color: var(--color-on-surface-variant);
  border-radius: var(--radius-pill);
  font-weight: 800;
}

@media (max-width: 360px) {
  .review-close-top-bar {
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    padding-inline: 18px;
  }

  .review-close-top-bar h1 {
    font-size: var(--font-size-headline-md);
  }

  .review-close-content {
    padding-inline: 18px;
  }

  .review-close-card {
    padding-inline: 18px;
  }

  .review-close-card__header h3 {
    font-size: var(--font-size-headline-md);
  }

  .review-close-action-list li {
    font-size: var(--font-size-body-lg);
  }
}
</style>
