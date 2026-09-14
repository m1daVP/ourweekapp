<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import MeetingItemCard from './MeetingItemCard.vue';
import type { EnrichedAgreement, EnrichedMeetingNote, EnrichedMeetingTask, EnrichedTaskReviewItem, TaskReviewAction } from '@/features/meeting/composables/useMeetingSession';
import type { SectionPresentation } from '@/features/meeting/meetingPresentation';
import type { MeetingSection } from '@/features/meeting/types';
import type { MeetingComposerDraftType } from '@/features/meeting/meetingComposerDrafts';

const props = defineProps<{
  canEditMeeting: boolean; canEditTasks: boolean; currentAgreements: EnrichedAgreement[];
  currentNotes: EnrichedMeetingNote[]; currentSection: MeetingSection; currentStepNumber: number;
  currentTasks: EnrichedMeetingTask[]; formError: string; isFirstStep: boolean;
  presentation: SectionPresentation; previousCompletedMeetingLabel: string;
  previousUnfinishedTasks: EnrichedTaskReviewItem[]; progressPercent: string;
  sectionPrompt: string; sectionTitle: string; showTaskReview: boolean;
  statusMessage: string; totalSteps: number;
}>();
const emit = defineEmits<{
  capture: [type: MeetingComposerDraftType]; 'delete-note': [id: string]; 'delete-task': [id: string];
  'delete-agreement': [id: string]; 'edit-note': [item: EnrichedMeetingNote];
  'edit-task': [item: EnrichedMeetingTask]; 'edit-agreement': [item: EnrichedAgreement]; exit: [];
  'go-back': []; 'go-next': []; 'handle-unfinished-tasks': [action: TaskReviewAction];
  'open-menu': []; 'toggle-task': [id: string, status: EnrichedMeetingTask['status']];
}>();
const { t } = useI18n();
const examplesOpen = ref(false);
const primaryLabel = computed(() => props.presentation.addActionLabelKey ? t(props.presentation.addActionLabelKey) : t('common.add'));
const alternativeTypes = computed(() => props.presentation.allowedItemTypes.filter((type) => type !== props.presentation.primaryCaptureType));
const captureLabel = (type: MeetingComposerDraftType) => t(`meeting.presentation.add${type[0].toUpperCase()}${type.slice(1)}`);
</script>

<template>
  <header class="meeting-focus-bar">
    <button class="meeting-focus-bar__icon material-symbols-outlined" type="button" :aria-label="t('meeting.closeMeeting')" @click="emit('exit')">close</button>
    <div class="meeting-focus-bar__progress"><span>{{ t('meeting.stepOf', { current: currentStepNumber, total: totalSteps }) }}</span><div class="meeting-progress__track"><div class="meeting-progress__bar" :style="{ width: progressPercent }" /></div></div>
    <button class="meeting-focus-bar__icon material-symbols-outlined" type="button" :aria-label="t('meeting.menu.open')" @click="emit('open-menu')">more_vert</button>
  </header>
  <main class="meeting-conversation">
    <header class="meeting-conversation__prompt">
      <p class="meeting-conversation__phase">{{ presentation.phase }}</p><h1>{{ sectionTitle }}</h1><p>{{ sectionPrompt }}</p>
      <p v-if="presentation.helperKey" class="meeting-help">{{ t(presentation.helperKey) }}</p>
      <button v-if="presentation.exampleKeys?.length" type="button" class="meeting-conversation__example-toggle" :aria-expanded="examplesOpen" @click="examplesOpen = !examplesOpen">{{ t('meeting.needExample') }}</button>
      <ul v-if="examplesOpen" class="meeting-conversation__examples"><li v-for="key in presentation.exampleKeys" :key="key">{{ t(key) }}</li></ul>
    </header>
    <section v-if="showTaskReview" class="meeting-panel meeting-review" aria-labelledby="task-review-title">
      <p class="meeting-review__eyebrow">{{ previousCompletedMeetingLabel }}</p><h2 id="task-review-title">{{ t('meeting.unfinishedTitle') }}</h2>
      <ul class="meeting-list"><li v-for="task in previousUnfinishedTasks" :key="task.id">{{ task.title }}</li></ul>
      <div v-if="canEditTasks" class="meeting-review__actions"><button type="button" @click="emit('handle-unfinished-tasks', 'keep')">{{ t('meeting.keep') }}</button><button type="button" @click="emit('handle-unfinished-tasks', 'done')">{{ t('meeting.markDone') }}</button><button type="button" @click="emit('handle-unfinished-tasks', 'skipped')">{{ t('meeting.skip') }}</button><button type="button" class="meeting-primary" @click="emit('handle-unfinished-tasks', 'move')">{{ t('meeting.moveToThisWeek') }}</button></div>
    </section>
    <section v-if="currentNotes.length || currentTasks.length || currentAgreements.length" class="meeting-conversation__cards" :aria-label="sectionTitle">
      <MeetingItemCard v-for="item in currentNotes" :key="item.id" :item="item" type="note" :editable="canEditMeeting" @edit="emit('edit-note', item)" @delete="emit('delete-note', item.id)" />
      <MeetingItemCard v-for="item in currentTasks" :key="item.id" :item="item" type="task" :editable="canEditTasks" @edit="emit('edit-task', item)" @delete="emit('delete-task', item.id)" @toggle-task="emit('toggle-task', item.id, item.status)" />
      <MeetingItemCard v-for="item in currentAgreements" :key="item.id" :item="item" type="agreement" :editable="canEditMeeting" @edit="emit('edit-agreement', item)" @delete="emit('delete-agreement', item.id)" />
    </section>
    <div v-if="canEditMeeting && presentation.primaryCaptureType" class="meeting-conversation__capture"><button type="button" class="meeting-primary" @click="emit('capture', presentation.primaryCaptureType)">{{ primaryLabel }}</button><details v-if="alternativeTypes.length"><summary>{{ t('meeting.moreWaysToAdd') }}</summary><button v-for="type in alternativeTypes" :key="type" type="button" @click="emit('capture', type)">{{ captureLabel(type) }}</button></details></div>
    <p v-if="formError" class="meeting-error" role="alert">{{ formError }}</p><p v-if="statusMessage" class="meeting-status" role="status">{{ statusMessage }}</p>
  </main>
  <footer class="meeting-actions floating-bottom-block meeting-step-actions meeting-step-actions--section"><button type="button" @click="isFirstStep ? emit('exit') : emit('go-back')">{{ isFirstStep ? t('common.exit') : t('common.back') }}</button><button v-if="canEditMeeting" type="button" class="meeting-primary" @click="emit('go-next')">{{ t('common.next') }}</button></footer>
</template>

<style scoped>
.meeting-conversation { display: grid; gap: 16px; padding: 20px 16px 112px; }
.meeting-conversation__prompt h1, .meeting-conversation__prompt p { margin: 0 0 8px; }
.meeting-conversation__phase { color: var(--color-primary); font-size: .8rem; font-weight: 700; text-transform: uppercase; }
.meeting-conversation__cards, .meeting-conversation__capture, .meeting-conversation__examples { display: grid; gap: 10px; }
.meeting-conversation__example-toggle { justify-self: start; }
.meeting-conversation__capture details { display: grid; gap: 8px; }
</style>
