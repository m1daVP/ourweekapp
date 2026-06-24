<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ActionMenuPopup from '@/shared/components/ActionMenuPopup.vue';
import type { ActionMenuItem } from '@/shared/components/ActionMenuPopup.vue';
import ConfirmationDialog from '@/shared/components/ConfirmationDialog.vue';
import BaseBottomSheet from '@/shared/components/BaseBottomSheet.vue';
import MeetingCheckInStep from '@/features/meeting/components/MeetingCheckInStep.vue';
import MeetingReviewCloseStep from '@/features/meeting/components/MeetingReviewCloseStep.vue';
import MeetingSectionStep from '@/features/meeting/components/MeetingSectionStep.vue';
import { useMeetingSession } from '@/features/meeting/composables/useMeetingSession';

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
  closeNoteEditor,
  closeMeeting,
  confirmDeleteRitual,
  confirmEndSessionIncomplete,
  currentAgreements,
  currentNotes,
  currentSection,
  currentStepNumber,
  currentTasks,
  drawerFamilyMembers,
  drawerSelectedParticipantId,
  editingNoteParticipantId,
  editingNoteText,
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
  isDeleteRitualDialogOpen,
  isEndSessionDialogOpen,
  isFinalSection,
  isFinishingMeeting,
  isFirstStep,
  isGuestDrawerOpen,
  isNoteEditorOpen,
  isParticipantCheckInStep,
  isPaused,
  isRitualMenuOpen,
  meetingDurationLabel,
  neutralHint,
  noteEditorError,
  noteEditorNeutralHint,
  notePlaceholder,
  noteText,
  openGuestDrawer,
  openNoteEditor,
  previousCompletedMeeting,
  previousCompletedMeetingLabel,
  previousUnfinishedTasks,
  progressPercent,
  reviewCounts,
  reviewTasks,
  saveDraft,
  saveNoteEdit,
  sectionPrompt,
  sectionTitle,
  selectDrawerParticipant,
  selectedParticipantId,
  showNotes,
  showTaskReview,
  startNewMeeting,
  startRitual,
  statusMessage,
  taskDraft,
  toggleCheckInParticipant,
  toggleTask,
  totalSteps,
} = useMeetingSession();

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
      @open-menu="isRitualMenuOpen = true"
      @start-new="startNewMeeting"
      @toggle-task="toggleTask"
    />

    <MeetingSectionStep
      v-else
      v-model:agreement-participant-ids="agreementParticipantIds"
      v-model:agreement-text="agreementText"
      v-model:note-text="noteText"
      v-model:selected-participant-id="selectedParticipantId"
      v-model:task-description="taskDraft.description"
      v-model:task-due-date="taskDraft.dueDate"
      v-model:task-responsibility-choice="taskDraft.responsibilityChoice"
      v-model:task-title="taskDraft.title"
      :active-meeting-participants="activeMeetingParticipants"
      :can-add-agreements="canAddAgreements"
      :can-add-tasks="canAddTasks"
      :can-create-meeting="canCreateMeeting"
      :can-create-tasks="canCreateTasks"
      :can-edit-meeting="canEditMeeting"
      :can-edit-tasks="canEditTasks"
      :current-agreements="currentAgreements"
      :current-notes="currentNotes"
      :current-section="currentSection"
      :current-step-number="currentStepNumber"
      :current-tasks="currentTasks"
      :form-error="formError"
      :is-completed="isCompleted"
      :is-final-section="isFinalSection"
      :is-finishing-meeting="isFinishingMeeting"
      :is-first-step="isFirstStep"
      :neutral-hint="neutralHint"
      :note-placeholder="notePlaceholder(currentSection.id)"
      :previous-completed-meeting="previousCompletedMeeting"
      :previous-completed-meeting-label="previousCompletedMeetingLabel()"
      :previous-unfinished-tasks="previousUnfinishedTasks"
      :progress-percent="progressPercent"
      :section-prompt="sectionPrompt(currentSection.id, currentSection.prompt)"
      :section-title="sectionTitle(currentSection.id, currentSection.title)"
      :show-notes="showNotes"
      :show-task-review="showTaskReview"
      :status-message="statusMessage"
      :total-steps="totalSteps"
      @add-agreement="addAgreement"
      @add-note="addNote"
      @add-task="addTask"
      @edit-note="openNoteEditor"
      @exit="closeMeeting"
      @finish="finishMeeting"
      @go-back="goBack"
      @go-next="goNext"
      @handle-unfinished-tasks="handleUnfinishedTasks"
      @open-menu="isRitualMenuOpen = true"
      @save-draft="saveDraft"
      @start-new="startNewMeeting"
      @toggle-task="toggleTask"
    />
  </section>

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
        <select
          id="edit-note-person"
          v-model="editingNoteParticipantId"
          :disabled="!canEditMeeting"
        >
          <option
            v-for="participant in activeMeetingParticipants"
            :key="participant.id"
            :value="participant.id"
          >
            {{ participant.name }}
          </option>
        </select>
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
