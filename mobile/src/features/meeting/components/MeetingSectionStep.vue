<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type {
  EnrichedAgreement,
  EnrichedMeetingNote,
  EnrichedMeetingTask,
  EnrichedTaskReviewItem,
  TaskReviewAction,
} from '@/features/meeting/composables/useMeetingSession';
import type { Meeting, MeetingSection } from '@/features/meeting/types';
import type { Participant } from '@/features/participants/types';
import ParticipantAvatar from '@/features/participants/components/ParticipantAvatar.vue';
import DatePickerField from '@/shared/components/DatePickerField.vue';
import SelectPickerField from '@/shared/components/SelectPickerField.vue';

const props = defineProps<{
  activeMeetingParticipants: Participant[];
  agreementParticipantIds: string[];
  agreementText: string;
  canAddAgreements: boolean;
  canAddTasks: boolean;
  canCreateMeeting: boolean;
  canCreateTasks: boolean;
  canEditMeeting: boolean;
  canEditTasks: boolean;
  currentAgreements: EnrichedAgreement[];
  currentNotes: EnrichedMeetingNote[];
  currentSection: MeetingSection;
  currentStepNumber: number;
  currentTasks: EnrichedMeetingTask[];
  formError: string;
  isCompleted: boolean;
  isFinalSection: boolean;
  isFinishingMeeting: boolean;
  isFirstStep: boolean;
  neutralHint: string;
  notePlaceholder: string;
  noteText: string;
  previousCompletedMeeting: Meeting | null;
  previousCompletedMeetingLabel: string;
  previousUnfinishedTasks: EnrichedTaskReviewItem[];
  progressPercent: string;
  sectionPrompt: string;
  sectionTitle: string;
  selectedParticipantId: string;
  showNotes: boolean;
  showTaskReview: boolean;
  statusMessage: string;
  taskDescription: string;
  taskDueDate: string;
  taskResponsibilityChoice: string;
  taskTitle: string;
  totalSteps: number;
}>();

const emit = defineEmits<{
  'add-agreement': [];
  'add-note': [];
  'add-task': [];
  'delete-note': [noteId: string];
  'delete-task': [taskId: string];
  'delete-agreement': [agreementId: string];
  'edit-agreement': [agreement: EnrichedAgreement];
  'edit-note': [note: EnrichedMeetingNote];
  'edit-task': [task: EnrichedMeetingTask];
  exit: [];
  finish: [];
  'go-back': [];
  'go-next': [];
  'handle-unfinished-tasks': [action: TaskReviewAction];
  'open-menu': [];
  'save-draft': [];
  'start-new': [];
  'toggle-task': [taskId: string, status: EnrichedMeetingTask['status']];
  'update:agreementParticipantIds': [participantIds: string[]];
  'update:agreementText': [value: string];
  'update:noteText': [value: string];
  'update:selectedParticipantId': [participantId: string];
  'update:taskDescription': [value: string];
  'update:taskDueDate': [value: string];
  'update:taskResponsibilityChoice': [value: string];
  'update:taskTitle': [value: string];
}>();

const { t } = useI18n();
const participantPickerOptions = computed(() =>
  props.activeMeetingParticipants.map((participant) => ({
    value: participant.id,
    label: participant.name,
  }))
);
const taskResponsibilityPickerOptions = computed(() => [
  { value: 'needsDiscussion', label: t('meeting.needsDiscussion') },
  { value: 'shared', label: t('meeting.shared') },
  ...participantPickerOptions.value,
]);

function updateText(event: Event) {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
}

function updateAgreementParticipant(
  participantId: string,
  isSelected: boolean
) {
  const nextParticipantIds = isSelected
    ? [...props.agreementParticipantIds, participantId]
    : props.agreementParticipantIds.filter((id) => id !== participantId);

  emit('update:agreementParticipantIds', nextParticipantIds);
}
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
        t('meeting.stepOf', {
          current: currentStepNumber,
          total: totalSteps,
        })
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

  <header class="meeting-header">
    <div v-if="activeMeetingParticipants.length" class="meeting-avatar-stack">
      <ParticipantAvatar
        v-for="participant in activeMeetingParticipants.slice(0, 3)"
        :key="participant.id"
        :participant="participant"
        decorative
      />
    </div>
    <div class="meeting-header__row">
      <div>
        <h1>{{ sectionTitle }}</h1>
        <p class="meeting-prompt">{{ sectionPrompt }}</p>
      </div>
    </div>
  </header>

  <section
    v-if="showTaskReview"
    class="meeting-panel meeting-review"
    aria-labelledby="task-review-title"
  >
    <div>
      <p class="meeting-review__eyebrow">
        {{ previousCompletedMeetingLabel }}
      </p>
      <h2 id="task-review-title">{{ t('meeting.unfinishedTitle') }}</h2>
    </div>

    <ul class="meeting-list meeting-review__list">
      <li v-for="task in previousUnfinishedTasks" :key="task.id">
        <div>
          <span>{{ task.responsibilityLabel }}</span>
          <p>{{ task.title }}</p>
          <small v-if="task.dueDate">
            {{ t('meeting.stillRelevant', { date: task.dueDate }) }}
          </small>
        </div>
      </li>
    </ul>

    <div
      v-if="canEditTasks"
      class="meeting-review__actions"
      :aria-label="t('meeting.unfinishedChoices')"
    >
      <button type="button" @click="emit('handle-unfinished-tasks', 'keep')">
        {{ t('meeting.keep') }}
      </button>
      <button type="button" @click="emit('handle-unfinished-tasks', 'done')">
        {{ t('meeting.markDone') }}
      </button>
      <button type="button" @click="emit('handle-unfinished-tasks', 'skipped')">
        {{ t('meeting.skip') }}
      </button>
      <button
        type="button"
        class="meeting-primary"
        @click="emit('handle-unfinished-tasks', 'move')"
      >
        {{ t('meeting.moveToThisWeek') }}
      </button>
    </div>
  </section>

  <section
    v-if="canAddTasks"
    class="meeting-panel"
    aria-labelledby="meeting-tasks-title"
  >
    <h2 id="meeting-tasks-title" class="meeting-panel-title">
      <span
        class="meeting-panel-title__icon meeting-panel-title__icon--tasks material-symbols-outlined"
        aria-hidden="true"
      >
        task_alt
      </span>
      <span>{{ t('meeting.tasks') }}</span>
    </h2>
    <template v-if="canCreateTasks">
      <label class="meeting-label" for="task-title">
        {{ t('meeting.taskTitle') }}
      </label>
      <input
        id="task-title"
        :value="taskTitle"
        type="text"
        :placeholder="t('meeting.taskTitlePlaceholder')"
        @input="emit('update:taskTitle', updateText($event))"
      />

      <label class="meeting-label" for="task-description">
        {{ t('meeting.optionalDetail') }}
      </label>
      <textarea
        id="task-description"
        :value="taskDescription"
        rows="3"
        :placeholder="t('meeting.taskDetailPlaceholder')"
        @input="emit('update:taskDescription', updateText($event))"
      />

      <label class="meeting-label" for="task-person">
        {{ t('meeting.responsible') }}
      </label>
      <SelectPickerField
        id="task-person"
        :model-value="taskResponsibilityChoice"
        :label="t('meeting.responsible')"
        :options="taskResponsibilityPickerOptions"
        @update:model-value="emit('update:taskResponsibilityChoice', $event)"
      />

      <label class="meeting-label" for="task-due-date">
        {{ t('meeting.dueDate') }}
      </label>
      <DatePickerField
        id="task-due-date"
        :model-value="taskDueDate"
        :label="t('meeting.dueDate')"
        @update:model-value="emit('update:taskDueDate', $event)"
      />
      <button class="meeting-primary" type="button" @click="emit('add-task')">
        {{ t('meeting.addTask') }}
      </button>
    </template>

    <ul v-if="currentTasks.length" class="meeting-list meeting-task-list">
      <li v-for="task in currentTasks" :key="task.id">
        <div>
          <span>{{ task.responsibilityLabel }}</span>
          <p>{{ task.title }}</p>
          <small v-if="task.description">{{ task.description }}</small>
          <small v-if="task.dueDate">
            {{ t('common.due') }} {{ task.dueDate }}
          </small>
        </div>
        <div v-if="canEditTasks && !isCompleted" class="meeting-task-actions">
          <button
            type="button"
            class="meeting-note-item__edit material-symbols-outlined"
            :aria-label="t('meeting.editTaskAria', { title: task.title })"
            @click="emit('edit-task', task)"
          >
            edit
          </button>
          <button
            type="button"
            class="meeting-task-actions__delete material-symbols-outlined"
            :aria-label="t('meeting.deleteTaskAria', { title: task.title })"
            @click="emit('delete-task', task.id)"
          >
            delete
          </button>
        </div>
      </li>
    </ul>
    <p v-else class="meeting-empty">{{ t('meeting.noTasksYet') }}</p>
  </section>

  <section
    v-if="canAddAgreements"
    class="meeting-panel"
    aria-labelledby="meeting-agreements-title"
  >
    <h2 id="meeting-agreements-title" class="meeting-panel-title">
      <span
        class="meeting-panel-title__icon meeting-panel-title__icon--agreements material-symbols-outlined"
        aria-hidden="true"
      >
        handshake
      </span>
      <span>{{ t('meeting.agreements') }}</span>
    </h2>
    <label class="meeting-label" for="agreement-text">
      {{ t('meeting.decisionOrAgreement') }}
    </label>
    <textarea
      id="agreement-text"
      :value="agreementText"
      rows="3"
      :placeholder="t('meeting.agreementPlaceholder')"
      :disabled="!canEditMeeting"
      @input="emit('update:agreementText', updateText($event))"
    />
    <fieldset class="participant-selector">
      <legend>{{ t('meeting.participants') }}</legend>
      <label
        v-for="participant in activeMeetingParticipants"
        :key="participant.id"
      >
        <input
          type="checkbox"
          :checked="agreementParticipantIds.includes(participant.id)"
          :value="participant.id"
          :disabled="!canEditMeeting"
          @change="
            updateAgreementParticipant(
              participant.id,
              ($event.target as HTMLInputElement).checked
            )
          "
        />
        <span>{{ participant.name }}</span>
      </label>
    </fieldset>
    <button
      v-if="canEditMeeting"
      class="meeting-primary"
      type="button"
      @click="emit('add-agreement')"
    >
      {{ t('meeting.addAgreement') }}
    </button>

    <ul v-if="currentAgreements.length" class="meeting-list">
      <li
        v-for="agreement in currentAgreements"
        :key="agreement.id"
        class="meeting-note-item"
      >
        <div class="meeting-note-item__content">
          <span>{{ agreement.participantLabel }}</span>
          <p>{{ agreement.text }}</p>
        </div>
        <div
          v-if="canEditMeeting && !isCompleted"
          class="meeting-note-item__actions"
        >
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
            class="meeting-note-item__delete material-symbols-outlined"
            :aria-label="
              t('meeting.deleteAgreementAria', { text: agreement.text })
            "
            @click="emit('delete-agreement', agreement.id)"
          >
            delete
          </button>
        </div>
      </li>
    </ul>
    <p v-else class="meeting-empty">{{ t('meeting.noAgreementsYet') }}</p>
  </section>

  <section
    v-if="showNotes"
    class="meeting-panel"
    aria-labelledby="meeting-notes-title"
  >
    <h2 id="meeting-notes-title" class="meeting-panel-title">
      <span
        class="meeting-panel-title__icon meeting-panel-title__icon--notes material-symbols-outlined"
        aria-hidden="true"
      >
        edit_note
      </span>
      <span>{{ t('meeting.notes') }}</span>
    </h2>
    <label class="meeting-label" for="note-person">
      {{ t('meeting.author') }}
    </label>
    <SelectPickerField
      id="note-person"
      :model-value="selectedParticipantId"
      :label="t('meeting.author')"
      :options="participantPickerOptions"
      :disabled="!canEditMeeting"
      @update:model-value="emit('update:selectedParticipantId', $event)"
    />

    <label class="meeting-label" for="meeting-note">
      {{ t('meeting.note') }}
    </label>
    <textarea
      id="meeting-note"
      :value="noteText"
      rows="4"
      :placeholder="notePlaceholder"
      :disabled="!canEditMeeting"
      @input="emit('update:noteText', updateText($event))"
    />
    <p v-if="neutralHint" class="meeting-help">{{ neutralHint }}</p>
    <button
      v-if="canEditMeeting"
      class="meeting-primary"
      type="button"
      @click="emit('add-note')"
    >
      {{ t('meeting.addNote') }}
    </button>

    <ul v-if="currentNotes.length" class="meeting-list">
      <li v-for="note in currentNotes" :key="note.id" class="meeting-note-item">
        <div class="meeting-note-item__content">
          <span>{{ note.participantName }}</span>
          <p>{{ note.text }}</p>
        </div>
        <div
          v-if="canEditMeeting && !isCompleted"
          class="meeting-note-item__actions"
        >
          <button
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
            type="button"
            class="meeting-note-item__delete material-symbols-outlined"
            :aria-label="
              t('meeting.deleteNoteAria', { author: note.participantName })
            "
            @click="emit('delete-note', note.id)"
          >
            delete
          </button>
        </div>
      </li>
    </ul>
    <p v-else class="meeting-empty">{{ t('meeting.noNotesYet') }}</p>
  </section>

  <p v-if="formError" class="meeting-error" role="alert">
    {{ formError }}
  </p>
  <p v-if="statusMessage" class="meeting-status" role="status">
    {{ statusMessage }}
  </p>

  <footer
    class="meeting-actions floating-bottom-block meeting-step-actions meeting-step-actions--section"
  >
    <button
      type="button"
      :disabled="!isFirstStep && !canEditMeeting"
      @click="isFirstStep ? emit('exit') : emit('go-back')"
    >
      {{ isFirstStep ? t('common.exit') : t('common.back') }}
    </button>
    <!-- <button
      v-if="!isCompleted && canEditMeeting"
      type="button"
      @click="emit('save-draft')"
    >
      {{ t('meeting.saveDraft') }}
    </button> -->
    <button
      v-if="!isFinalSection && !isCompleted && canEditMeeting"
      class="meeting-primary"
      type="button"
      @click="emit('go-next')"
    >
      {{ t('common.next') }}
    </button>
    <button
      v-else-if="!isCompleted && canEditMeeting"
      class="meeting-primary"
      type="button"
      :disabled="isFinishingMeeting"
      @click="emit('finish')"
    >
      {{
        isFinishingMeeting ? t('meeting.finishingMeeting') : t('common.finish')
      }}
    </button>
    <button
      v-else-if="canCreateMeeting"
      class="meeting-primary"
      type="button"
      @click="emit('start-new')"
    >
      {{ t('meeting.newMeeting') }}
    </button>
  </footer>
</template>
