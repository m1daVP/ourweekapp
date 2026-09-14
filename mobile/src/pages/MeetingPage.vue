<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ActionMenuPopup from '@/shared/components/ActionMenuPopup.vue';
import type { ActionMenuItem } from '@/shared/components/ActionMenuPopup.vue';
import ConfirmationDialog from '@/shared/components/ConfirmationDialog.vue';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';
import SelectPickerField from '@/shared/components/SelectPickerField.vue';
import MeetingCheckInStep from '@/features/meeting/components/MeetingCheckInStep.vue';
import MeetingReviewCloseStep from '@/features/meeting/components/MeetingReviewCloseStep.vue';
import MeetingSectionStep from '@/features/meeting/components/MeetingSectionStep.vue';
import MeetingItemComposer from '@/features/meeting/components/MeetingItemComposer.vue';
import { useMeetingSession } from '@/features/meeting/composables/useMeetingSession';
import { useWorkspaceStore } from '@/app/stores/workspace';
import type { MeetingComposerDraftType } from '@/features/meeting/meetingComposerDrafts';

const { t } = useI18n();
const {
  activeMeeting,
  activeMeetingParticipants,
  addAgreement,
  addNote,
  addSelectedDrawerParticipant,
  addTask,
  agreementParticipantIds,
  agreementText,
  allAgreements,
  allNotes,
  canAddAgreements,
  canAddGuestParticipant,
  canAddTasks,
  canCreateMeeting,
  canCreateTasks,
  canEditMeeting,
  canEditTasks,
  canSubmitGuestDrawer,
  checkInParticipants,
  checkedInParticipantIds,
  clearDrawerParticipantSelection,
  closeGuestDrawer,
  closeAgreementEditor,
  closeNoteEditor,
  closeTaskEditor,
  closeMeeting,
  confirmAiRecapDisclosure,
  confirmAiRecapLowContent,
  confirmDeleteRitual,
  confirmEndSessionIncomplete,
  currentAgreements,
  currentNotes,
  currentPresentation,
  currentSection,
  currentStepNumber,
  currentTasks,
  deleteNote,
  deleteAgreement,
  deferAiRecapDisclosure,
  deferAiRecapLowContent,
  drawerFamilyMembers,
  drawerSelectedParticipantId,
  editingNoteParticipantId,
  editingNoteText,
  editingTaskDraft,
  editingAgreementParticipantIds,
  editingAgreementText,
  editActions,
  exitMeeting,
  finishMeeting,
  formError,
  goBack,
  goNext,
  guestName,
  handleRitualMenuSelect,
  handleUnfinishedTasks,
  hasMeetingContent,
  isCompleted,
  isAiRecapDisclosureOpen,
  isAiRecapLowContentOpen,
  isDeleteRitualDialogOpen,
  isEndSessionDialogOpen,
  isFinalSection,
  isFinishingMeeting,
  isFirstStep,
  isGuestDrawerOpen,
  isNoteEditorOpen,
  isTaskEditorOpen,
  isAgreementEditorOpen,
  isParticipantCheckInStep,
  isPaused,
  isRitualMenuOpen,
  meetingDurationLabel,
  neutralHint,
  noteEditorError,
  taskEditorError,
  agreementEditorError,
  noteEditorNeutralHint,
  notePlaceholder,
  noteText,
  openGuestDrawer,
  openNoteEditor,
  openTaskEditor,
  openAgreementEditor,
  previousCompletedMeeting,
  previousCompletedMeetingLabel,
  previousUnfinishedTasks,
  progressPercent,
  reviewCounts,
  reviewTasks,
  saveDraft,
  saveNoteEdit,
  saveTaskEdit,
  saveAgreementEdit,
  sectionPrompt,
  sectionTitle,
  selectDrawerParticipant,
  selectedParticipantId,
  showNotes,
  showTaskReview,
  startNewMeeting,
  submitCapturedItem,
  startRitual,
  statusMessage,
  taskDraft,
  deleteTask,
  toggleCheckInParticipant,
  toggleTask,
  totalSteps,
} = useMeetingSession();

const workspaceStore = useWorkspaceStore();
const composerType = ref<MeetingComposerDraftType | null>(null);
const composerScope = computed(() => {
  const meeting = activeMeeting.value;
  const section = currentSection.value;
  const type = composerType.value;

  return meeting && section && type
    ? {
        userId: workspaceStore.currentUserId,
        workspaceId: workspaceStore.workspace.id,
        meetingId: meeting.id,
        sectionId: section.id,
        type,
      }
    : null;
});

function openComposer(type: MeetingComposerDraftType) {
  composerType.value = type;
}

const ritualMenuItems = computed<ActionMenuItem[]>(() => [
  {
    id: isPaused.value ? 'resume-ritual' : 'pause-ritual',
    label: isPaused.value
      ? t('meeting.menu.resumeRitual')
      : t('meeting.menu.pauseRitual'),
    icon: isPaused.value ? 'play_arrow' : 'pause',
    disabled: !canEditMeeting.value,
  },
  {
    id: 'save-draft-exit',
    label: t('meeting.menu.saveDraftExit'),
    icon: 'draft',
    disabled: !canEditMeeting.value,
  },
  {
    id: 'end-session',
    label: t('meeting.menu.endSession'),
    icon: 'logout',
    variant: 'destructive',
    dividerBefore: true,
    disabled: !canEditMeeting.value || isCompleted.value,
  },
  {
    id: 'delete-ritual',
    label: t('meeting.menu.deleteRitual'),
    icon: 'delete',
    variant: 'destructive',
    disabled: !canEditMeeting.value || isCompleted.value,
  },
]);
const meetingParticipantPickerOptions = computed(() =>
  activeMeetingParticipants.value.map((participant) => ({
    value: participant.id,
    label: participant.name,
  }))
);
const taskResponsibilityPickerOptions = computed(() => [
  { value: 'needsDiscussion', label: t('meeting.needsDiscussion') },
  { value: 'shared', label: t('meeting.shared') },
  ...meetingParticipantPickerOptions.value,
]);
</script>

<template>
  <section
    v-if="activeMeeting && currentSection"
    :class="[
      'meeting-page',
      { 'meeting-page--check-in': isParticipantCheckInStep },
    ]"
  >
    <ActionMenuPopup
      v-model="isRitualMenuOpen"
      :items="ritualMenuItems"
      :aria-label="t('meeting.menu.label')"
      :close-label="t('common.close')"
      @select="handleRitualMenuSelect"
    />

    <MeetingCheckInStep
      v-if="isParticipantCheckInStep"
      v-model:guest-name="guestName"
      :can-add-guest-participant="canAddGuestParticipant"
      :can-edit-meeting="canEditMeeting"
      :can-submit-guest-drawer="canSubmitGuestDrawer"
      :checked-in-participant-ids="checkedInParticipantIds"
      :current-step-number="currentStepNumber"
      :drawer-family-members="drawerFamilyMembers"
      :drawer-selected-participant-id="drawerSelectedParticipantId"
      :form-error="formError"
      :is-guest-drawer-open="isGuestDrawerOpen"
      :participants="checkInParticipants"
      :progress-percent="progressPercent"
      :status-message="statusMessage"
      :total-steps="totalSteps"
      @add-selected-drawer-participant="addSelectedDrawerParticipant"
      @clear-drawer-participant-selection="clearDrawerParticipantSelection"
      @close-guest-drawer="closeGuestDrawer"
      @exit="exitMeeting"
      @open-guest-drawer="openGuestDrawer"
      @open-menu="isRitualMenuOpen = true"
      @select-drawer-participant="selectDrawerParticipant"
      @start="startRitual"
      @toggle-participant="toggleCheckInParticipant"
    />

    <MeetingReviewCloseStep
      v-else-if="isFinalSection"
      :all-agreements="allAgreements"
      :all-notes="allNotes"
      :all-tasks="reviewTasks"
      :can-create-meeting="canCreateMeeting"
      :can-edit-meeting="canEditMeeting"
      :can-edit-tasks="canEditTasks"
      :form-error="formError"
      :has-meeting-content="hasMeetingContent"
      :is-completed="isCompleted"
      :is-finishing-meeting="isFinishingMeeting"
      :meeting-duration-label="meetingDurationLabel"
      :progress-percent="progressPercent"
      :review-counts="reviewCounts"
      :status-message="statusMessage"
      @edit-actions="editActions"
      @exit="closeMeeting"
      @finish="finishMeeting"
      @go-back="goBack"
      @delete-note="deleteNote"
      @delete-task="deleteTask"
      @delete-agreement="deleteAgreement"
      @edit-agreement="openAgreementEditor"
      @edit-note="openNoteEditor"
      @edit-task="openTaskEditor"
      @open-menu="isRitualMenuOpen = true"
      @start-new="startNewMeeting"
      @toggle-task="toggleTask"
    />

    <MeetingSectionStep
      v-else
      :can-edit-meeting="canEditMeeting"
      :can-edit-tasks="canEditTasks"
      :current-agreements="currentAgreements"
      :current-notes="currentNotes"
      :current-section="currentSection"
      :current-step-number="currentStepNumber"
      :current-tasks="currentTasks"
      :form-error="formError"
      :is-first-step="isFirstStep"
      :presentation="currentPresentation!"
      :previous-completed-meeting-label="previousCompletedMeetingLabel()"
      :previous-unfinished-tasks="previousUnfinishedTasks"
      :progress-percent="progressPercent"
      :section-prompt="sectionPrompt(currentSection.id, currentSection.prompt)"
      :section-title="sectionTitle(currentSection.id, currentSection.title)"
      :show-task-review="showTaskReview"
      :status-message="statusMessage"
      :total-steps="totalSteps"
      @capture="openComposer"
      @delete-note="deleteNote"
      @delete-task="deleteTask"
      @delete-agreement="deleteAgreement"
      @edit-agreement="openAgreementEditor"
      @edit-note="openNoteEditor"
      @edit-task="openTaskEditor"
      @exit="closeMeeting"
      @go-back="goBack"
      @go-next="goNext"
      @handle-unfinished-tasks="handleUnfinishedTasks"
      @open-menu="isRitualMenuOpen = true"
      @toggle-task="toggleTask"
    />
  </section>

  <MeetingItemComposer
    v-if="composerScope"
    :open="Boolean(composerType)"
    :scope="composerScope"
    :participants="activeMeetingParticipants"
    :submit-item="({ type, fields }) => submitCapturedItem(type, fields)"
    @close="composerType = null"
    @saved="composerType = null"
  />

  <section v-else class="page-stack">
    <div>
      <p class="page-kicker">{{ t('meeting.weeklyMeeting') }}</p>
      <h1>{{ t('meeting.readOnlyTitle') }}</h1>
      <p class="page-copy">{{ t('meeting.readOnlyText') }}</p>
    </div>
    <RouterLink class="secondary-button link-button" :to="{ name: 'history' }">
      {{ t('meeting.viewHistory') }}
    </RouterLink>
  </section>

  <BaseBottomSheet
    :open="isNoteEditorOpen"
    :title="t('meeting.editNote')"
    @close="closeNoteEditor"
  >
    <form
      class="task-editor-form note-editor-form"
      @submit.prevent="saveNoteEdit"
    >
      <label for="edit-note-person">
        <span>{{ t('meeting.author') }}</span>
        <SelectPickerField
          id="edit-note-person"
          v-model="editingNoteParticipantId"
          :label="t('meeting.author')"
          :options="meetingParticipantPickerOptions"
          :disabled="!canEditMeeting"
        />
      </label>

      <label for="edit-note-text">
        <span>{{ t('meeting.note') }}</span>
        <textarea
          id="edit-note-text"
          v-model="editingNoteText"
          rows="5"
          :disabled="!canEditMeeting"
        />
      </label>

      <p v-if="noteEditorNeutralHint" class="meeting-help">
        {{ noteEditorNeutralHint }}
      </p>
      <p v-if="noteEditorError" class="meeting-error" role="alert">
        {{ noteEditorError }}
      </p>

      <button v-if="canEditMeeting" type="submit" class="meeting-primary">
        {{ t('common.save') }}
      </button>
    </form>
  </BaseBottomSheet>

  <BaseBottomSheet
    :open="isTaskEditorOpen"
    :title="t('meeting.editTask')"
    @close="closeTaskEditor"
  >
    <form class="task-editor-form" @submit.prevent="saveTaskEdit">
      <label for="edit-task-title">
        <span>{{ t('meeting.taskTitle') }}</span>
        <input
          id="edit-task-title"
          v-model="editingTaskDraft.title"
          type="text"
          :disabled="!canEditTasks"
        />
      </label>

      <label for="edit-task-description">
        <span>{{ t('meeting.optionalDetail') }}</span>
        <textarea
          id="edit-task-description"
          v-model="editingTaskDraft.description"
          rows="3"
          :disabled="!canEditTasks"
        />
      </label>

      <label for="edit-task-person">
        <span>{{ t('meeting.responsible') }}</span>
        <SelectPickerField
          id="edit-task-person"
          v-model="editingTaskDraft.responsibilityChoice"
          :label="t('meeting.responsible')"
          :options="taskResponsibilityPickerOptions"
          :disabled="!canEditTasks"
        />
      </label>

      <label for="edit-task-due-date">
        <span>{{ t('meeting.dueDate') }}</span>
        <input
          id="edit-task-due-date"
          v-model="editingTaskDraft.dueDate"
          type="date"
          :disabled="!canEditTasks"
        />
      </label>

      <p v-if="taskEditorError" class="meeting-error" role="alert">
        {{ taskEditorError }}
      </p>

      <button v-if="canEditTasks" type="submit" class="meeting-primary">
        {{ t('common.save') }}
      </button>
    </form>
  </BaseBottomSheet>

  <BaseBottomSheet
    :open="isAgreementEditorOpen"
    :title="t('meeting.editAgreement')"
    @close="closeAgreementEditor"
  >
    <form class="task-editor-form" @submit.prevent="saveAgreementEdit">
      <label for="edit-agreement-text">
        <span>{{ t('meeting.decisionOrAgreement') }}</span>
        <textarea
          id="edit-agreement-text"
          v-model="editingAgreementText"
          rows="5"
          :disabled="!canEditMeeting"
        />
      </label>

      <fieldset class="participant-selector">
        <legend>{{ t('meeting.participants') }}</legend>
        <label
          v-for="participant in activeMeetingParticipants"
          :key="participant.id"
        >
          <input
            v-model="editingAgreementParticipantIds"
            type="checkbox"
            :value="participant.id"
            :disabled="!canEditMeeting"
          />
          <span>{{ participant.name }}</span>
        </label>
      </fieldset>

      <p v-if="agreementEditorError" class="meeting-error" role="alert">
        {{ agreementEditorError }}
      </p>

      <button v-if="canEditMeeting" type="submit" class="meeting-primary">
        {{ t('common.save') }}
      </button>
    </form>
  </BaseBottomSheet>

  <ConfirmationDialog
    :open="isAiRecapLowContentOpen"
    :title="t('ai.recap.lowContent.title')"
    :message="t('ai.recap.lowContent.body')"
    :confirm-label="t('ai.recap.lowContent.generateAnyway')"
    :cancel-label="t('ai.recap.lowContent.addMore')"
    @close="deferAiRecapLowContent"
    @confirm="confirmAiRecapLowContent"
  />
  <ConfirmationDialog
    :open="isAiRecapDisclosureOpen"
    :title="t('ai.recap.disclosure.title')"
    :message="t('ai.recap.disclosure.body')"
    :confirm-label="t('ai.recap.disclosure.generate')"
    :cancel-label="t('ai.recap.disclosure.notNow')"
    @close="deferAiRecapDisclosure"
    @confirm="confirmAiRecapDisclosure"
  />
  <ConfirmationDialog
    :open="isEndSessionDialogOpen"
    :title="t('meeting.confirmEndSessionTitle')"
    :message="t('meeting.confirmEndSessionText')"
    :confirm-label="t('common.finish')"
    @close="isEndSessionDialogOpen = false"
    @confirm="confirmEndSessionIncomplete"
  />
  <ConfirmationDialog
    :open="isDeleteRitualDialogOpen"
    :title="t('meeting.confirmDeleteRitualTitle')"
    :message="t('meeting.confirmDeleteRitualText')"
    :confirm-label="t('common.delete')"
    destructive
    @close="isDeleteRitualDialogOpen = false"
    @confirm="confirmDeleteRitual"
  />
</template>
