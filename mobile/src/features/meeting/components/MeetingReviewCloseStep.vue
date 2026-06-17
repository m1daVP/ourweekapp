<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type {
  EnrichedAgreement,
  EnrichedMeetingNote,
  EnrichedMeetingTask,
  MeetingReviewCounts,
} from '@/features/meeting/composables/useMeetingSession';

defineProps<{
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
  'edit-actions': [];
  exit: [];
  finish: [];
  'go-back': [];
  'open-menu': [];
  'start-new': [];
  'toggle-task': [taskId: string, status: EnrichedMeetingTask['status']];
}>();

const { t } = useI18n();
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
              :disabled="!canEditTasks"
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
            <span>{{ task.title }}</span>
          </li>
        </ul>
        <p v-else class="review-close-empty">
          {{ t('meeting.noAgreedActionsYet') }}
        </p>

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

        <ul v-if="allAgreements.length" class="review-close-text-list">
          <li v-for="agreement in allAgreements" :key="agreement.id">
            <span>{{ agreement.participantLabel }}</span>
            <p>{{ agreement.text }}</p>
          </li>
        </ul>
        <p v-else class="review-close-empty">
          {{ t('meeting.noAgreementsYet') }}
        </p>
      </section>

      <section
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

        <ul v-if="allNotes.length" class="review-close-text-list">
          <li v-for="note in allNotes" :key="note.id">
            <span>{{ note.participantName }}</span>
            <p>{{ note.text }}</p>
          </li>
        </ul>
        <p v-else class="review-close-empty">
          {{ t('meeting.noNotesYet') }}
        </p>
      </section>

      <p v-if="!hasMeetingContent" class="meeting-help">
        {{ t('meeting.atLeastOne') }}
      </p>
      <p v-if="formError" class="meeting-error" role="alert">
        {{ formError }}
      </p>
      <p v-if="statusMessage" class="meeting-status" role="status">
        {{ statusMessage }}
      </p>
    </main>

    <footer class="review-close-bottom-actions">
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
      <button
        class="review-close-back"
        type="button"
        :disabled="!canEditMeeting"
        @click="emit('go-back')"
      >
        {{ t('meeting.goBackEdit') }}
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
  padding: env(safe-area-inset-top) var(--edge-margin) 0;
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
  padding: 28px var(--edge-margin) 28px;
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
  border-radius: 0;
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
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
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

.review-close-text-list li {
  display: grid;
  gap: 4px;
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
  position: sticky;
  bottom: 0;
  z-index: 9;
  display: grid;
  gap: 18px;
  margin-top: auto;
  border-top: 1px solid
    color-mix(in srgb, var(--color-outline-variant) 28%, transparent);
  background: color-mix(in srgb, #faf9f5 94%, transparent);
  padding: 28px var(--edge-margin) calc(28px + env(safe-area-inset-bottom));
}

.review-close-finish {
  display: inline-flex;
  min-height: 72px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-family: var(--font-display);
  font-size: var(--font-size-body-lg);
  font-weight: 700;
  box-shadow: 0 12px 24px rgba(69, 99, 73, 0.18);
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
  min-height: 48px;
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font-weight: 850;
  box-shadow: none;
}

@media (max-width: 360px) {
  .review-close-top-bar {
    grid-template-columns: 44px minmax(0, 1fr) 44px;
    padding-inline: 18px;
  }

  .review-close-top-bar h1 {
    font-size: var(--font-size-headline-md);
  }

  .review-close-content,
  .review-close-bottom-actions {
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
