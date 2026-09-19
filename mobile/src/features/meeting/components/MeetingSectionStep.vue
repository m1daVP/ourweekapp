<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import MeetingItemCard from './MeetingItemCard.vue';
import MeetingDisclosurePanel from './MeetingDisclosurePanel.vue';
import type {
  EnrichedAgreement,
  EnrichedMeetingNote,
  EnrichedMeetingTask,
  EnrichedTaskReviewItem,
  TaskReviewAction,
} from '@/features/meeting/composables/useMeetingSession';
import type { SectionPresentation } from '@/features/meeting/meetingPresentation';
import type { MeetingSection } from '@/features/meeting/types';
import type { MeetingComposerDraftType } from '@/features/meeting/meetingComposerDrafts';

const props = defineProps<{
  activeCaptureType: MeetingComposerDraftType | null;
  canEditMeeting: boolean;
  canEditTasks: boolean;
  currentAgreements: EnrichedAgreement[];
  currentNotes: EnrichedMeetingNote[];
  currentSection: MeetingSection;
  currentStepNumber: number;
  currentTasks: EnrichedMeetingTask[];
  formError: string;
  isFirstStep: boolean;
  presentation: SectionPresentation;
  previousCompletedMeetingLabel: string;
  previousUnfinishedTasks: EnrichedTaskReviewItem[];
  progressPercent: string;
  sectionPrompt: string;
  sectionTitle: string;
  showTaskReview: boolean;
  statusMessage: string;
  totalSteps: number;
}>();
const emit = defineEmits<{
  capture: [type: MeetingComposerDraftType];
  'delete-note': [id: string];
  'delete-task': [id: string];
  'delete-agreement': [id: string];
  'edit-note': [item: EnrichedMeetingNote];
  'edit-task': [item: EnrichedMeetingTask];
  'edit-agreement': [item: EnrichedAgreement];
  exit: [];
  'go-back': [];
  'go-next': [];
  'handle-unfinished-tasks': [action: TaskReviewAction];
  'open-menu': [];
  'toggle-task': [id: string, status: EnrichedMeetingTask['status']];
}>();
const { t } = useI18n();
const examplesOpen = ref(false);
const alternativeCaptureOpen = ref(false);
const primaryLabel = computed(() =>
  props.presentation.addActionLabelKey
    ? t(props.presentation.addActionLabelKey)
    : t('common.add')
);
const alternativeTypes = computed(() =>
  props.presentation.allowedItemTypes.filter(
    (type) => type !== props.presentation.primaryCaptureType
  )
);
const captureLabel = (type: MeetingComposerDraftType) =>
  t(`meeting.presentation.add${type[0].toUpperCase()}${type.slice(1)}`);
const alternativeIcon = (type: MeetingComposerDraftType) =>
  type === 'agreement' ? 'task_alt' : 'edit_note';
</script>

<template>
  <header class="meeting-focus-bar">
    <button
      class="meeting-focus-bar__icon material-symbols-outlined"
      type="button"
      :aria-label="t('meeting.closeMeeting')"
      @click="emit('exit')"
    >
      close
    </button>
    <div class="meeting-focus-bar__progress">
      <span>{{
        t('meeting.stepOf', { current: currentStepNumber, total: totalSteps })
      }}</span>
      <div class="meeting-progress__track">
        <div
          class="meeting-progress__bar"
          :style="{ width: progressPercent }"
        />
      </div>
    </div>
    <button
      class="meeting-focus-bar__icon material-symbols-outlined"
      type="button"
      :aria-label="t('meeting.menu.open')"
      @click="emit('open-menu')"
    >
      more_vert
    </button>
  </header>
  <main class="meeting-conversation">
    <header class="meeting-conversation__prompt">
      <p class="meeting-conversation__phase">{{ presentation.phase }}</p>
      <h1>{{ sectionTitle }}</h1>
      <p>{{ sectionPrompt }}</p>
      <p v-if="presentation.helperKey" class="meeting-help">
        {{ t(presentation.helperKey) }}
      </p>
    </header>
    <section
      v-if="showTaskReview"
      class="meeting-panel meeting-review"
      aria-labelledby="task-review-title"
    >
      <p class="meeting-review__eyebrow">{{ previousCompletedMeetingLabel }}</p>
      <h2 id="task-review-title">{{ t('meeting.unfinishedTitle') }}</h2>
      <ul class="meeting-list">
        <li v-for="task in previousUnfinishedTasks" :key="task.id">
          {{ task.title }}
        </li>
      </ul>
      <div v-if="canEditTasks" class="meeting-review__actions">
        <button type="button" @click="emit('handle-unfinished-tasks', 'keep')">
          {{ t('meeting.keep') }}</button
        ><button type="button" @click="emit('handle-unfinished-tasks', 'done')">
          {{ t('meeting.markDone') }}</button
        ><button
          type="button"
          @click="emit('handle-unfinished-tasks', 'skipped')"
        >
          {{ t('meeting.skip') }}</button
        ><button
          type="button"
          class="meeting-primary"
          @click="emit('handle-unfinished-tasks', 'move')"
        >
          {{ t('meeting.moveToThisWeek') }}
        </button>
      </div>
    </section>
    <section
      v-if="
        currentNotes.length || currentTasks.length || currentAgreements.length
      "
      class="meeting-conversation__cards"
      :aria-label="sectionTitle"
    >
      <MeetingItemCard
        v-for="item in currentNotes"
        :key="item.id"
        :item="item"
        type="note"
        :editable="canEditMeeting"
        @edit="emit('edit-note', item)"
        @delete="emit('delete-note', item.id)"
      />
      <MeetingItemCard
        v-for="item in currentTasks"
        :key="item.id"
        :item="item"
        type="task"
        :editable="canEditTasks"
        @edit="emit('edit-task', item)"
        @delete="emit('delete-task', item.id)"
        @toggle-task="emit('toggle-task', item.id, item.status)"
      />
      <MeetingItemCard
        v-for="item in currentAgreements"
        :key="item.id"
        :item="item"
        type="agreement"
        :editable="canEditMeeting"
        @edit="emit('edit-agreement', item)"
        @delete="emit('delete-agreement', item.id)"
      />
    </section>
    <div
      v-if="canEditMeeting && presentation.primaryCaptureType"
      class="meeting-conversation__capture"
    >
      <button
        type="button"
        class="meeting-primary"
        @click="emit('capture', presentation.primaryCaptureType)"
      >
        {{ primaryLabel }}
      </button>
      <MeetingDisclosurePanel
        v-if="presentation.exampleKeys?.length"
        :open="examplesOpen"
        :label="t('meeting.needExample')"
        controls="meeting-examples-panel"
        @toggle="examplesOpen = !examplesOpen"
      >
        <template #leading
          ><span class="material-symbols-outlined">auto_awesome</span></template
        >
        <div class="meeting-conversation__example-panel">
          <p v-for="key in presentation.exampleKeys" :key="key">{{ t(key) }}</p>
        </div>
      </MeetingDisclosurePanel>
      <template v-if="alternativeTypes.length">
        <section class="meeting-conversation__optional-panel">
          <button
            class="meeting-conversation__optional-toggle"
            type="button"
            :aria-expanded="alternativeCaptureOpen"
            aria-controls="meeting-alternative-capture-actions"
            @click="alternativeCaptureOpen = !alternativeCaptureOpen"
          >
            <span
              class="meeting-conversation__optional-icon material-symbols-outlined"
              aria-hidden="true"
              >auto_awesome</span
            >
            <span class="meeting-conversation__optional-label">{{
              t('meeting.moreWaysToAdd')
            }}</span>
            <span class="material-symbols-outlined" aria-hidden="true">{{
              alternativeCaptureOpen ? 'expand_less' : 'expand_more'
            }}</span>
          </button>
          <div
            id="meeting-alternative-capture-actions"
            class="meeting-conversation__panel-reveal"
            :class="{ 'is-open': alternativeCaptureOpen }"
            :aria-hidden="!alternativeCaptureOpen"
            :inert="!alternativeCaptureOpen"
          >
            <div class="meeting-conversation__panel-reveal-inner">
              <div class="meeting-conversation__alternative-actions">
                <button
                  v-for="type in alternativeTypes"
                  :key="type"
                  class="meeting-conversation__alternative-card"
                  :class="{ 'is-active': activeCaptureType === type }"
                  type="button"
                  @click="emit('capture', type)"
                >
                  <span
                    class="meeting-conversation__alternative-card-icon material-symbols-outlined"
                    aria-hidden="true"
                    >{{ alternativeIcon(type) }}</span
                  >
                  <span>{{ captureLabel(type) }}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>
    <p v-if="formError" class="meeting-error" role="alert">{{ formError }}</p>
    <p v-if="statusMessage" class="meeting-status" role="status">
      {{ statusMessage }}
    </p>
  </main>
  <footer
    class="meeting-actions floating-bottom-block meeting-step-actions meeting-step-actions--section"
  >
    <button type="button" @click="isFirstStep ? emit('exit') : emit('go-back')">
      {{ isFirstStep ? t('common.exit') : t('common.back') }}</button
    ><button
      v-if="canEditMeeting"
      type="button"
      class="meeting-primary"
      @click="emit('go-next')"
    >
      {{ t('common.next') }}
    </button>
  </footer>
</template>

<style scoped>
.meeting-conversation {
  display: grid;
  gap: 16px;
  padding: 20px 0 112px;
}
.meeting-conversation__prompt h1,
.meeting-conversation__prompt p {
  margin: 0 0 8px;
}
.meeting-conversation__phase {
  color: var(--color-primary);
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
}
.meeting-conversation__cards,
.meeting-conversation__capture {
  display: grid;
  gap: 10px;
}
.meeting-conversation__optional-panel {
  overflow: hidden;
  border: 1px solid var(--color-outline-variant);
  border-radius: 32px;
  background: #f8f7f2;
}
.meeting-conversation__optional-toggle {
  display: flex;
  width: 100%;
  min-height: 56px;
  align-items: center;
  border: 0;
  background: transparent;
  padding: 10px 14px 10px 18px;
  color: var(--color-primary);
  font-size: var(--font-size-body-md);
  font-weight: 800;
  text-align: left;
}
.meeting-conversation__optional-label {
  flex: 1;
  margin-left: 10px;
  font-weight: 600;
}
.meeting-conversation__optional-icon,
.meeting-conversation__alternative-card-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: var(--radius-pill);
  background: #e9ece5;
  color: var(--color-primary);
  font-size: 1.15rem;
}
.meeting-conversation__optional-toggle > .material-symbols-outlined:last-child {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: var(--radius-pill);
  background: var(--color-surface-lowest);
  color: var(--color-primary);
  font-size: 1.5rem;
}
.meeting-conversation__example-panel {
  display: grid;
  gap: 8px;
  padding: 0 16px 16px;
}
.meeting-conversation__example-panel p {
  margin: 0;
  border-radius: var(--radius-md);
  background: var(--color-surface-lowest);
  padding: 14px;
  color: var(--color-on-surface-variant);
}
.meeting-conversation__alternative-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 12px 16px 16px;
}
.meeting-conversation__alternative-card {
  display: grid;
  min-height: 132px;
  align-content: space-between;
  justify-items: start;
  gap: 20px;
  border: 1px solid color-mix(in srgb, var(--color-outline-variant) 58%, white);
  border-radius: var(--radius-lg);
  background: var(--color-surface-lowest);
  padding: 16px;
  color: var(--color-on-surface);
  font-size: var(--font-size-body-lg);
  font-weight: 600;
  line-height: 1.2;
  text-align: left;
  box-shadow: var(--shadow-card);
}
.meeting-conversation__alternative-card:active,
.meeting-conversation__alternative-card.is-active {
  border-color: var(--color-primary);
  transform: translateY(1px);
}
.meeting-conversation__alternative-card:active
  .meeting-conversation__alternative-card-icon,
.meeting-conversation__alternative-card.is-active
  .meeting-conversation__alternative-card-icon,
.meeting-conversation__alternative-card:focus-visible
  .meeting-conversation__alternative-card-icon {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
.meeting-conversation__panel-reveal {
  display: grid;
  grid-template-rows: 0fr;
  overflow: hidden;
  transition:
    grid-template-rows 340ms cubic-bezier(0.22, 0.8, 0.3, 1),
    opacity 220ms ease,
    transform 340ms cubic-bezier(0.22, 0.8, 0.3, 1);
}
.meeting-conversation__panel-reveal:not(.is-open) {
  opacity: 0;
  transform: translateY(-8px);
}
.meeting-conversation__panel-reveal.is-open {
  grid-template-rows: 1fr;
  opacity: 1;
  transform: translateY(0);
}
.meeting-conversation__panel-reveal-inner {
  min-height: 0;
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .meeting-conversation__panel-reveal {
    transition-duration: 0.01ms;
  }
}
@media (max-width: 340px) {
  .meeting-conversation__alternative-actions {
    grid-template-columns: 1fr;
  }
}
</style>
