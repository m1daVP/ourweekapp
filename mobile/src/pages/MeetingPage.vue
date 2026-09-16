<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import ActionMenuPopup from '@/shared/components/ActionMenuPopup.vue';
import type { ActionMenuItem } from '@/shared/components/ActionMenuPopup.vue';
import ConfirmationDialog from '@/shared/components/ConfirmationDialog.vue';
import MeetingCheckInStep from '@/features/meeting/components/MeetingCheckInStep.vue';
import MeetingReviewCloseStep from '@/features/meeting/components/MeetingReviewCloseStep.vue';
import MeetingSectionStep from '@/features/meeting/components/MeetingSectionStep.vue';
import MeetingItemComposer from '@/features/meeting/components/MeetingItemComposer.vue';
import { useMeetingSession } from '@/features/meeting/composables/useMeetingSession';
import { useWorkspaceStore } from '@/app/stores/workspace';
import type {
  MeetingComposerDraftScope,
  MeetingComposerDraftType,
} from '@/features/meeting/meetingComposerDrafts';
import type {
  EnrichedAgreement,
  EnrichedMeetingNote,
  EnrichedMeetingTask,
} from '@/features/meeting/composables/useMeetingSession';

type EditedMeetingItem =
  | {
      type: 'task';
      fields: {
        title: string;
        description: string;
        responsibilityChoice: string;
        dueDate: string;
      };
    }
  | { type: 'note' | 'agreement'; fields: { text: string } };

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
  editingNoteText,
  editingTaskDraft,
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
  isFinalSection,
  isFinishingMeeting,
  isFirstStep,
  isGuestDrawerOpen,
  isNoteEditorOpen,
  isTaskEditorOpen,
  isAgreementEditorOpen,
  isParticipantCheckInStep,
  isRitualMenuOpen,
  meetingDurationLabel,
  neutralHint,
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
const renderedComposerScope = ref<MeetingComposerDraftScope | null>(null);
const editingTaskComposerScope = ref<MeetingComposerDraftScope | null>(null);
const editingNoteComposerScope = ref<MeetingComposerDraftScope | null>(null);
const editingAgreementComposerScope = ref<MeetingComposerDraftScope | null>(
  null
);
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
const taskEditorComposerScope = computed<MeetingComposerDraftScope | null>(
  () =>
    editingTaskComposerScope.value ??
    (composerScope.value ? { ...composerScope.value, type: 'task' } : null)
);

watch(composerScope, (scope) => {
  if (scope) renderedComposerScope.value = scope;
});

function openComposer(type: MeetingComposerDraftType) {
  composerType.value = type;
}

function closeComposer() {
  composerType.value = null;
}

function discardRenderedComposerScope() {
  renderedComposerScope.value = null;
}

function saveEditedTaskFromComposer(fields: {
  title: string;
  description: string;
  responsibilityChoice: string;
  dueDate: string;
}) {
  editingTaskDraft.title = fields.title;
  editingTaskDraft.description = fields.description;
  editingTaskDraft.responsibilityChoice = fields.responsibilityChoice;
  editingTaskDraft.dueDate = fields.dueDate;
  saveTaskEdit();
}

function saveEditedNoteFromComposer(fields: { text: string }) {
  editingNoteText.value = fields.text;
  saveNoteEdit();
}

function saveEditedAgreementFromComposer(fields: { text: string }) {
  editingAgreementText.value = fields.text;
  saveAgreementEdit();
}

function saveEditedMeetingItem(item: EditedMeetingItem) {
  if (item.type === 'task') {
    saveEditedTaskFromComposer(item.fields);
    return;
  }

  if (item.type === 'note') {
    saveEditedNoteFromComposer(item.fields);
    return;
  }

  saveEditedAgreementFromComposer(item.fields);
}

function createItemComposerScope(
  sectionId: MeetingComposerDraftScope['sectionId'],
  itemId: string,
  type: MeetingComposerDraftType
): MeetingComposerDraftScope | null {
  const meeting = activeMeeting.value;

  return meeting
    ? {
        userId: workspaceStore.currentUserId,
        workspaceId: workspaceStore.workspace.id,
        meetingId: meeting.id,
        sectionId,
        type,
        itemId,
      }
    : null;
}

function openTaskEditorFromMeeting(task: EnrichedMeetingTask) {
  editingTaskComposerScope.value = createItemComposerScope(
    task.sectionId,
    task.id,
    'task'
  );
  openTaskEditor(task);
}

function closeTaskEditorFromMeeting() {
  closeTaskEditor();
}

function discardTaskEditorComposerScope() {
  editingTaskComposerScope.value = null;
}

function openNoteEditorFromMeeting(note: EnrichedMeetingNote) {
  editingNoteComposerScope.value = createItemComposerScope(
    note.sectionId,
    note.id,
    'note'
  );
  openNoteEditor(note);
}

function closeNoteEditorFromMeeting() {
  closeNoteEditor();
}

function discardNoteEditorComposerScope() {
  editingNoteComposerScope.value = null;
}

function openAgreementEditorFromMeeting(agreement: EnrichedAgreement) {
  editingAgreementComposerScope.value = createItemComposerScope(
    agreement.sectionId,
    agreement.id,
    'agreement'
  );
  openAgreementEditor(agreement);
}

function closeAgreementEditorFromMeeting() {
  closeAgreementEditor();
}

function discardAgreementEditorComposerScope() {
  editingAgreementComposerScope.value = null;
}

const ritualMenuItems = computed<ActionMenuItem[]>(() => [
  {
    id: 'save-draft-exit',
    label: t('meeting.menu.saveDraftExit'),
    icon: 'draft',
    disabled: !canEditMeeting.value,
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
</script>

<template>
  <section
    v-if="activeMeeting && currentSection"
    :class="[
      'meeting-page',
      {
        'meeting-page--check-in': isParticipantCheckInStep,
        'meeting-page--review-close': isFinalSection,
      },
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
      @capture="openComposer"
      @exit="closeMeeting"
      @finish="finishMeeting"
      @go-back="goBack"
      @delete-note="deleteNote"
      @delete-task="deleteTask"
      @delete-agreement="deleteAgreement"
      @edit-agreement="openAgreementEditorFromMeeting"
      @edit-note="openNoteEditorFromMeeting"
      @edit-task="openTaskEditorFromMeeting"
      @open-menu="isRitualMenuOpen = true"
      @start-new="startNewMeeting"
      @toggle-task="toggleTask"
    />

    <MeetingSectionStep
      v-else
      :active-capture-type="composerType"
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
      @edit-agreement="openAgreementEditorFromMeeting"
      @edit-note="openNoteEditorFromMeeting"
      @edit-task="openTaskEditorFromMeeting"
      @exit="closeMeeting"
      @go-back="goBack"
      @go-next="goNext"
      @handle-unfinished-tasks="handleUnfinishedTasks"
      @open-menu="isRitualMenuOpen = true"
      @toggle-task="toggleTask"
    />
  </section>

  <MeetingItemComposer
    v-if="renderedComposerScope"
    :open="Boolean(composerType)"
    :scope="renderedComposerScope"
    :participants="activeMeetingParticipants"
    :submit-item="({ type, fields }) => submitCapturedItem(type, fields)"
    @after-close="discardRenderedComposerScope"
    @close="closeComposer"
    @saved="closeComposer"
  />

  <section
    v-else-if="workspaceStore.currentUserRole === 'viewer'"
    class="page-stack"
  >
    <div>
      <p class="page-kicker">{{ t('meeting.weeklyMeeting') }}</p>
      <h1>{{ t('meeting.readOnlyTitle') }}</h1>
      <p class="page-copy">{{ t('meeting.readOnlyText') }}</p>
    </div>
    <RouterLink class="secondary-button link-button" :to="{ name: 'history' }">
      {{ t('meeting.viewHistory') }}
    </RouterLink>
  </section>

  <MeetingItemComposer
    v-if="editingNoteComposerScope"
    :open="isNoteEditorOpen"
    :scope="editingNoteComposerScope"
    :participants="activeMeetingParticipants"
    :edit-item="{ type: 'note', fields: { text: editingNoteText } }"
    :submit-edited-item="saveEditedMeetingItem"
    :submit-item="({ type, fields }) => submitCapturedItem(type, fields)"
    @after-close="discardNoteEditorComposerScope"
    @close="closeNoteEditorFromMeeting"
  />

  <MeetingItemComposer
    v-if="taskEditorComposerScope"
    :open="isTaskEditorOpen"
    :scope="taskEditorComposerScope"
    :participants="activeMeetingParticipants"
    :edit-item="{ type: 'task', fields: editingTaskDraft }"
    :submit-edited-item="saveEditedMeetingItem"
    :submit-item="({ type, fields }) => submitCapturedItem(type, fields)"
    @after-close="discardTaskEditorComposerScope"
    @close="closeTaskEditorFromMeeting"
  />
  <MeetingItemComposer
    v-if="editingAgreementComposerScope"
    :open="isAgreementEditorOpen"
    :scope="editingAgreementComposerScope"
    :participants="activeMeetingParticipants"
    :edit-item="{ type: 'agreement', fields: { text: editingAgreementText } }"
    :submit-edited-item="saveEditedMeetingItem"
    :submit-item="({ type, fields }) => submitCapturedItem(type, fields)"
    @after-close="discardAgreementEditorComposerScope"
    @close="closeAgreementEditorFromMeeting"
  />

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
    :open="isDeleteRitualDialogOpen"
    :title="t('meeting.confirmDeleteRitualTitle')"
    :message="t('meeting.confirmDeleteRitualText')"
    :confirm-label="t('common.delete')"
    destructive
    @close="isDeleteRitualDialogOpen = false"
    @confirm="confirmDeleteRitual"
  />
</template>
