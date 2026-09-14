<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  EnrichedAgreement,
  EnrichedMeetingNote,
  EnrichedMeetingTask,
  MeetingReviewCounts,
} from '@/features/meeting/composables/useMeetingSession';

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
            <button
              v-if="canEditTasks && !isCompleted"
              type="button"
              class="meeting-note-item__edit material-symbols-outlined"
              :aria-label="t('meeting.editTaskAria', { title: task.title })"
              @click="emit('edit-task', task)"
            >
              edit
            </button>
            <button
              v-if="canEditTasks && !isCompleted"
              type="button"
              class="review-close-delete material-symbols-outlined"
              :aria-label="t('meeting.deleteTaskAria', { title: task.title })"
              @click="emit('delete-task', task.id)"
            >
              delete
            </button>
          </li>
        </ul>
        <button
          type="button"
          class="review-close-edit"
          :disabled="!canEditMeeting"
          @click="emit('edit-actions')"
        >
          <span>{{ t('meeting.editActions') }}</span>
          <span class="material-symbols-outlined" aria-hidden="true">
            edit
          </span>
        </button>
      </section>

      <section
        v-if="allAgreements.length"
        class="review-close-card"
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
              <span>{{ agreement.participantLabel }}</span>
              <p>{{ agreement.text }}</p>
            </div>
            <template v-if="canEditMeeting && !isCompleted">
              <button
                type="button"
                class="meeting-note-item__edit material-symbols-outlined"
                :aria-label="
                  t('meeting.editAgreementAria', { text: agreement.text })
                "
                @click="emit('edit-agreement', agreement)"
              >
                edit
              </button>
              <button
                type="button"
                class="review-close-delete material-symbols-outlined"
                :aria-label="
                  t('meeting.deleteAgreementAria', { text: agreement.text })
                "
                @click="emit('delete-agreement', agreement.id)"
              >
                delete
              </button>
            </template>
          </li>
        </ul>
      </section>

      <section
        v-if="allNotes.length"
        class="review-close-card"
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

        <button
          type="button"
          class="review-close-edit"
          :aria-expanded="areNotesExpanded"
          @click="areNotesExpanded = !areNotesExpanded"
        >
          {{ notesToggleText }}
        </button>
        <ul
          v-if="areNotesExpanded"
          class="review-close-text-list review-close-text-list--actions"
        >
          <li v-for="group in notesBySection" :key="group.sectionTitle">
            <span>{{ group.sectionTitle }}</span>
            <ul class="review-close-text-list review-close-text-list--actions">
              <li v-for="note in group.notes" :key="note.id">
                <div>
                  <span>{{ note.participantName }}</span>
                  <p>{{ note.text }}</p>
                </div>
                <button
                  v-if="canEditMeeting && !isCompleted"
                  type="button"
                  class="meeting-note-item__edit material-symbols-outlined"
                  :aria-label="
                    t('meeting.editNoteAria', { author: note.participantName })
                  "
                  @click="emit('edit-note', note)"
                >
                  edit
                </button>
                <button
                  v-if="canEditMeeting && !isCompleted"
                  type="button"
                  class="review-close-delete material-symbols-outlined"
                  :aria-label="
                    t('meeting.deleteNoteAria', {
                      author: note.participantName,
                    })
                  "
                  @click="emit('delete-note', note.id)"
                >
                  delete
                </button>
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <section v-if="!hasMeetingContent" class="review-close-card">
        <p class="review-close-empty">{{ emptyReviewText() }}</p>
      </section>
      <section v-if="!isCompleted && canEditMeeting" class="review-close-card">
        <p class="meeting-help">{{ t('meeting.reviewReadyText') }}</p>
        <div class="review-close-capture-actions">
          <button
            type="button"
            class="review-close-edit"
            @click="emit('capture', 'agreement')"
          >
            {{ t('meeting.addAgreement') }}
          </button>
          <button
            type="button"
            class="review-close-edit"
            @click="emit('capture', 'task')"
          >
            {{ t('meeting.addTask') }}
          </button>
          <button
            type="button"
            class="review-close-edit"
            @click="emit('capture', 'note')"
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
  gap: 24px;
  padding: 28px 0;
}

.review-close-progress {
  display: grid;
  gap: 10px;
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
  height: 8px;
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
  gap: 16px;
  padding: 16px 0 0;
  text-align: center;
}

.review-close-hero__icon {
  display: grid;
  width: 96px;
  height: 96px;
  place-items: center;
  border-radius: var(--radius-pill);
  background: var(--color-primary-fixed);
  color: var(--color-primary);
  font-size: 3rem;
  font-variation-settings:
    'FILL' 0,
    'wght' 500,
    'GRAD' 0,
    'opsz' 48;
}

.review-close-hero h2 {
  margin: 14px 0 0;
  color: #101210;
  font-family: var(--font-display);
  font-size: var(--font-size-display);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.16;
}

.review-close-hero p {
  max-width: 18.5em;
  color: #30362f;
  font-family: var(--font-display);
  font-size: var(--font-size-body-lg);
  line-height: 1.5;
}

.review-close-card {
  display: grid;
  gap: 22px;
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 42%, white);
  border-radius: var(--radius-lg);
  background: var(--color-surface-lowest);
  box-shadow: 0 8px 24px rgba(47, 42, 38, 0.06);
  padding: 26px 24px;
}

.review-close-card__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.review-close-card__title-icon {
  color: #8a5c0d;
  font-size: 2rem;
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
  font-size: var(--font-size-headline-md);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.18;
}

.review-close-badge {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  border-radius: var(--radius-pill);
  background: #ffd8af;
  padding: 0 16px;
  color: #2f251d;
  font-family: var(--font-display);
  font-size: var(--font-size-body-md);
  font-weight: 600;
  white-space: nowrap;
}

.review-close-action-list,
.review-close-text-list {
  display: grid;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.review-close-action-list li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  gap: 4px;
  align-items: start;
  color: #30362f;
  font-family: var(--font-display);
  font-size: var(--font-size-headline-md);
  line-height: 1.42;
}

.review-close-action-list li > span,
.review-close-text-list p {
  overflow-wrap: anywhere;
}

.review-close-action-list small {
  display: block;
  margin-top: 2px;
  color: var(--color-outline);
  font-family: var(--font-body);
  font-size: var(--font-size-label-sm);
  font-weight: 650;
}

.review-close-text-list li {
  display: grid;
  gap: 4px;
}

.review-close-text-list--actions li {
  grid-template-columns: minmax(0, 1fr) auto auto;
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
  font-size: var(--font-size-body-lg);
  line-height: 1.42;
}

.review-close-task-toggle {
  display: grid;
  width: 32px;
  height: 32px;
  min-height: 32px;
  place-items: center;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  padding: 0;
  color: color-mix(in srgb, var(--color-outline) 76%, #30362f);
  box-shadow: none;
}

.review-close-task-toggle .material-symbols-outlined {
  font-size: 1.95rem;
  font-variation-settings:
    'FILL' 0,
    'wght' 300,
    'GRAD' 0,
    'opsz' 32;
}

.review-close-task-toggle:disabled {
  opacity: 0.5;
}

.review-close-delete {
  align-self: start;
}

.review-close-empty {
  color: var(--color-outline);
  font-size: var(--font-size-label-lg);
  font-weight: 650;
}

.review-close-edit {
  display: inline-flex;
  width: fit-content;
  min-height: 36px;
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
  gap: 12px;
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
  margin-top: auto;
}

.review-close-finish {
  min-height: 64px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--color-on-primary);
  font-weight: 700;
}

.review-close-finish .material-symbols-outlined {
  font-size: 2rem;
  font-variation-settings:
    'FILL' 0,
    'wght' 600,
    'GRAD' 0,
    'opsz' 32;
}

.review-close-back {
  min-height: 64px;
  color: var(--color-on-surface-variant);
  font-weight: 850;
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
