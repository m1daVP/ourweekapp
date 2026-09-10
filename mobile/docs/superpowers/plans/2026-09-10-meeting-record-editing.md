# Meeting Record Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a permitted user edit or delete notes, tasks, and agreements from an unfinished meeting through focused mobile bottom sheets.

**Architecture:** The meetings store remains the canonical meeting-record source and validates all mutations; the tasks store maintains its mirrored task and agreement records. `useMeetingSession` owns editor state and invokes those store operations. Meeting list components emit edit/delete events, while `MeetingPage` hosts the bottom sheets and binds their forms.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, vue-i18n, Vitest, Vue Test Utils.

## Global Constraints

- Use `<script setup lang="ts">`, typed emits, and Vue Composition API.
- Keep the app mobile-first; use existing `BaseBottomSheet` and large labelled buttons.
- Preserve the calm, non-judgmental copy style and use the i18n catalogue for new user-facing text.
- Do not add dependencies.
- Only unfinished meetings are editable; completed meetings stay read-only.
- Delete actions must offer the established undo toast pattern.
- Do not create Git commits unless the user explicitly requests them.

---

## File structure

- `src/app/stores/meetings.ts` — validates and persists meeting task/agreement updates and reversible agreement deletes, while synchronizing the tasks store.
- `src/app/stores/tasks.ts` — updates, soft-deletes, and restores the mirrored standalone agreement record.
- `src/features/meeting/composables/useMeetingSession.ts` — owns task/agreement editor drafts, mutations, permission feedback, and undo snapshots.
- `src/features/meeting/components/MeetingSectionStep.vue` — exposes Edit/Delete controls and typed events for all three record types in a current meeting section.
- `src/features/meeting/components/MeetingReviewCloseStep.vue` — exposes the same controls for all records on the final review step.
- `src/pages/MeetingPage.vue` — wires events and renders task and agreement `BaseBottomSheet` forms alongside the existing note editor.
- `src/features/localization/messages.ts` — adds English, Ukrainian, and Spanish labels, errors, and accessible action text.
- Related store, composable, component, and page tests — verify the mutation contracts and controls.

### Task 1: Add canonical agreement lifecycle operations

**Files:**

- Modify: `src/app/stores/meetings.ts`
- Modify: `src/app/stores/tasks.ts`
- Test: `src/app/stores/__tests__/meetings.test.ts`
- Test: `src/app/stores/__tests__/tasks.test.ts`

**Interfaces:**

- Consumes: existing `Agreement`, `MeetingTask`, `UpdateTaskPayload`, and `uniqueStrings`.
- Produces: `meetingsStore.updateTaskDetails(taskId, payload): string | null`, `meetingsStore.updateAgreement(agreementId, text, participantIds): string | null`, `meetingsStore.deleteAgreement(agreementId): DeletedMeetingAgreementSnapshot | null`, `meetingsStore.restoreAgreement(snapshot): boolean`, plus tasks-store mirror methods `updateAgreement` and `restoreAgreement`.

- [ ] **Step 1: Write failing meetings-store tests**

```ts
it('updates a draft meeting task and its linked task record', () => {
  const error = store.updateTaskDetails('task-1', {
    title: 'Call the school',
    responsibilityType: 'participant',
    responsibleParticipantIds: ['participant-2'],
    dueDate: '2026-09-14',
  });

  expect(error).toBeNull();
  expect(store.activeMeeting?.sections[0].tasks[0]).toMatchObject({
    title: 'Call the school',
    responsibleParticipantIds: ['participant-2'],
    dueDate: '2026-09-14',
  });
  expect(tasksStore.tasks[0]).toMatchObject({ title: 'Call the school' });
});

it('updates and restores a deleted draft agreement with its mirror', () => {
  expect(
    store.updateAgreement('agreement-1', 'Prepare bags Sunday', [
      'participant-1',
    ])
  ).toBeNull();
  const snapshot = store.deleteAgreement('agreement-1');

  expect(snapshot?.agreement.text).toBe('Prepare bags Sunday');
  expect(tasksStore.agreements[0].deletedAt).toBeTruthy();
  expect(store.restoreAgreement(snapshot!)).toBe(true);
  expect(tasksStore.agreements[0].deletedAt).toBeUndefined();
});
```

- [ ] **Step 2: Run the focused store tests to verify they fail**

Run: `npm test -- src/app/stores/__tests__/meetings.test.ts src/app/stores/__tests__/tasks.test.ts`

Expected: FAIL because the agreement lifecycle methods and task-mirror synchronization do not yet exist.

- [ ] **Step 3: Define the reversible agreement snapshot and validate store mutations**

```ts
export interface DeletedMeetingAgreementSnapshot {
  meetingId: string;
  sectionId: MeetingSectionId;
  sectionIndex: number;
  agreement: Agreement;
}

updateAgreement(agreementId: string, text: string, participantIds: string[]) {
  const meeting = this.activeMeeting;
  const trimmedText = text.trim();
  const selectedParticipantIds = uniqueStrings(participantIds);
  if (!meeting || meeting.status === 'completed') return translate('meetingStore.agreementNotEditable');
  if (!trimmedText) return translate('meetingStore.addAgreementFirst');
  if (!selectedParticipantIds.length) return translate('meetingStore.chooseAgreementPeople');
  if (selectedParticipantIds.some((id) => !meeting.participantIds.includes(id))) return translate('meetingStore.choosePeopleFromMeeting');
  // Locate the agreement, update its text and attendees, update the linked
  // tasks-store agreement with the same id and timestamp, then persist.
}
```

Implement `deleteAgreement` by removing the agreement from its section, storing its original index, soft-deleting the mirrored agreement, and persisting. Implement `restoreAgreement` by verifying the active unfinished meeting and reinserting the snapshot only when no duplicate id exists. Make `updateTaskDetails` reject missing/completed records and return a localized error, then call the tasks-store update method with the finalized values.

- [ ] **Step 4: Implement the tasks-store agreement and task mirror methods**

```ts
updateAgreement(agreementId: string, payload: Pick<Agreement, 'title' | 'participantIds' | 'updatedAt'>) {
  const agreement = this.agreements.find((item) => item.id === agreementId && !item.deletedAt);
  if (!agreement) return false;
  agreement.title = payload.title;
  agreement.participantIds = uniqueStrings(payload.participantIds);
  agreement.updatedAt = payload.updatedAt;
  this.persist();
  return true;
}
```

Add parallel task update/restore behavior using the existing task id and `updatedAt`. For agreement restore, remove `deletedAt`, set `updatedAt`, and persist; never recreate a second record with the same id.

- [ ] **Step 5: Run the focused store tests to verify they pass**

Run: `npm test -- src/app/stores/__tests__/meetings.test.ts src/app/stores/__tests__/tasks.test.ts`

Expected: PASS, including rejected empty text, invalid participants, and completed-meeting mutations.

### Task 2: Add session-level editors and undo behavior

**Files:**

- Modify: `src/features/meeting/composables/useMeetingSession.ts`
- Test: `src/features/meeting/composables/__tests__/useMeetingSession.test.ts`

**Interfaces:**

- Consumes: Task 1 store methods, `BaseBottomSheet` form fields, `resolveTaskResponsibility`, `useToast`.
- Produces: `openTaskEditor`, `closeTaskEditor`, `saveTaskEdit`, `openAgreementEditor`, `closeAgreementEditor`, `saveAgreementEdit`, `deleteAgreement`, task/agreement draft refs, editor-open refs, and editor error refs.

- [ ] **Step 1: Write failing composable tests**

```ts
it('opens a task editor with the task values and saves the edited task', () => {
  session.openTaskEditor(task);
  expect(session.isTaskEditorOpen.value).toBe(true);
  expect(session.editingTaskDraft.title).toBe('Buy shoes');

  session.editingTaskDraft.title = 'Buy winter shoes';
  session.saveTaskEdit();

  expect(meetingsStore.updateTaskDetails).toHaveBeenCalledWith(
    'task-1',
    expect.objectContaining({
      title: 'Buy winter shoes',
    })
  );
});

it('deletes an agreement and supplies an undo action', () => {
  session.deleteAgreement('agreement-1');
  expect(meetingsStore.deleteAgreement).toHaveBeenCalledWith('agreement-1');
  expect(showToast).toHaveBeenCalledWith(
    'meeting.agreementDeleted',
    expect.objectContaining({ action: expect.any(Object) })
  );
});
```

- [ ] **Step 2: Run the focused composable test to verify it fails**

Run: `npm test -- src/features/meeting/composables/__tests__/useMeetingSession.test.ts`

Expected: FAIL because the task/agreement editor state and actions are unavailable.

- [ ] **Step 3: Add task editor state and save flow**

```ts
const editingTaskId = ref('');
const editingTaskDraft = reactive<TaskDraftState>(createEmptyTaskDraft());
const isTaskEditorOpen = computed(() => Boolean(editingTaskId.value));

function openTaskEditor(task: EnrichedMeetingTask) {
  if (!canEditTasks.value || isCompleted.value) return;
  editingTaskId.value = task.id;
  Object.assign(editingTaskDraft, task);
}
```

Use `resolveTaskResponsibility` when saving, call `meetingsStore.updateTaskDetails`, surface returned errors in the task editor, and clear the editor only after a successful save. Keep task delete and undo behavior unchanged.

- [ ] **Step 4: Add agreement editor, deletion, and undo flow**

```ts
const editingAgreementId = ref('');
const editingAgreementText = ref('');
const editingAgreementParticipantIds = ref<string[]>([]);

function openAgreementEditor(agreement: EnrichedAgreement) {
  if (!canEditMeeting.value || isCompleted.value) return;
  editingAgreementId.value = agreement.id;
  editingAgreementText.value = agreement.text;
  editingAgreementParticipantIds.value = [...agreement.participantIds];
}
```

Save through `meetingsStore.updateAgreement`; on deletion, retain the returned snapshot and present `meeting.agreementDeleted` with `common.undo`, calling `meetingsStore.restoreAgreement` from the toast action. Clear draft/error refs whenever either sheet closes.

- [ ] **Step 5: Run the focused composable test to verify it passes**

Run: `npm test -- src/features/meeting/composables/__tests__/useMeetingSession.test.ts`

Expected: PASS for editor initialization, validation errors, save, deletion, and undo.

### Task 3: Expose consistent record controls in section and review lists

**Files:**

- Modify: `src/features/meeting/components/MeetingSectionStep.vue`
- Modify: `src/features/meeting/components/MeetingReviewCloseStep.vue`
- Test: `src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`
- Test: `src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

**Interfaces:**

- Consumes: the event names from Task 2 and existing permission/completed props.
- Produces: `edit-task`, `edit-agreement`, and `delete-agreement` typed emits from both display components.

- [ ] **Step 1: Write failing component tests for available controls**

```ts
it('emits edit and delete for an editable agreement', async () => {
  await wrapper
    .get('[aria-label="meeting.editAgreementAria"]')
    .trigger('click');
  await wrapper
    .get('[aria-label="meeting.deleteAgreementAria"]')
    .trigger('click');

  expect(wrapper.emitted('edit-agreement')?.[0]).toEqual([currentAgreement]);
  expect(wrapper.emitted('delete-agreement')?.[0]).toEqual(['agreement-1']);
});

it('hides every record mutation control for completed meetings', () => {
  expect(
    completedWrapper.findAll('.meeting-record-actions button')
  ).toHaveLength(0);
});
```

- [ ] **Step 2: Run the focused component tests to verify they fail**

Run: `npm test -- src/features/meeting/components/__tests__/MeetingSectionStep.test.ts src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

Expected: FAIL because task edits and agreement controls are not rendered or emitted.

- [ ] **Step 3: Add mobile-sized edit/delete action groups to `MeetingSectionStep`**

```vue
<div v-if="canEditMeeting && !isCompleted" class="meeting-record-actions">
  <button type="button" @click="emit('edit-agreement', agreement)">
    <span class="material-symbols-outlined" aria-hidden="true">edit</span>
    {{ t('common.edit') }}
  </button>
  <button type="button" :aria-label="t('meeting.deleteAgreementAria', { text: agreement.text })" @click="emit('delete-agreement', agreement.id)">
    <span class="material-symbols-outlined" aria-hidden="true">delete</span>
    {{ t('common.delete') }}
  </button>
</div>
```

Use `canEditTasks` for task controls and `canEditMeeting` for note/agreement controls. Add the task Edit control beside its existing status/delete actions. Preserve notes’ existing actions and apply shared action-group styling without shrinking touch targets.

- [ ] **Step 4: Add the same controls to `MeetingReviewCloseStep`**

```ts
const emit = defineEmits<{
  'edit-task': [task: EnrichedMeetingTask];
  'edit-agreement': [agreement: EnrichedAgreement];
  'delete-agreement': [agreementId: string];
  // retain existing events
}>();
```

Render edit/delete actions for review tasks, notes, and agreements when their respective permission is granted and the meeting is unfinished.

- [ ] **Step 5: Run the focused component tests to verify they pass**

Run: `npm test -- src/features/meeting/components/__tests__/MeetingSectionStep.test.ts src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

Expected: PASS for event payloads, accessible labels, permissions, and completed-state hiding.

### Task 4: Host task and agreement bottom sheets and localize copy

**Files:**

- Modify: `src/pages/MeetingPage.vue`
- Modify: `src/features/localization/messages.ts`
- Test: `src/pages/__tests__/MeetingPage.test.ts`
- Test: `src/features/localization/__tests__/messages.test.ts`

**Interfaces:**

- Consumes: Task 2 session refs/actions and Task 3 events.
- Produces: bottom-sheet form bindings for task and agreement mutation; complete translations for every new `meeting.*` key.

- [ ] **Step 1: Write failing page and localization tests**

```ts
it('passes agreement edits from the section list into the agreement sheet', async () => {
  await sectionStep.vm.$emit('edit-agreement', agreement);
  expect(wrapper.findComponent({ name: 'BaseBottomSheet' }).props('open')).toBe(
    true
  );
  expect(wrapper.get('#edit-agreement-text').element.value).toBe(
    agreement.text
  );
});

it('contains every agreement editor key in each locale', () => {
  expect(
    getMissingLocaleKeys([
      'meeting.editAgreement',
      'meeting.agreementUpdated',
      'meeting.deleteAgreementAria',
    ])
  ).toEqual([]);
});
```

- [ ] **Step 2: Run the focused page and locale tests to verify they fail**

Run: `npm test -- src/pages/__tests__/MeetingPage.test.ts src/features/localization/__tests__/messages.test.ts`

Expected: FAIL because the task/agreement sheets and new locale keys are missing.

- [ ] **Step 3: Wire section and review events to session actions**

```vue
@edit-task="openTaskEditor" @edit-agreement="openAgreementEditor"
@delete-agreement="deleteAgreement"
```

Destructure each matching action and ref from `useMeetingSession`, then add those listeners to both `MeetingSectionStep` and `MeetingReviewCloseStep`.

- [ ] **Step 4: Render the two accessible bottom-sheet forms**

```vue
<BaseBottomSheet
  :open="isAgreementEditorOpen"
  :title="t('meeting.editAgreement')"
  @close="closeAgreementEditor"
>
  <form class="task-editor-form" @submit.prevent="saveAgreementEdit">
    <label for="edit-agreement-text"><span>{{ t('meeting.decisionOrAgreement') }}</span></label>
    <textarea id="edit-agreement-text" v-model="editingAgreementText" rows="5" :disabled="!canEditMeeting" />
    <fieldset class="participant-selector">
      <legend>{{ t('meeting.participants') }}</legend>
      <label v-for="participant in activeMeetingParticipants" :key="participant.id">
        <input v-model="editingAgreementParticipantIds" type="checkbox" :value="participant.id" :disabled="!canEditMeeting" />
        <span>{{ participant.name }}</span>
      </label>
    </fieldset>
    <p v-if="agreementEditorError" class="meeting-error" role="alert">{{ agreementEditorError }}</p>
    <button v-if="canEditMeeting" class="meeting-primary" type="submit">{{ t('common.save') }}</button>
  </form>
</BaseBottomSheet>
```

Build the task form from the existing task creation controls: title, detail, responsibility `SelectPickerField`, and `DatePickerField`. Keep labels, disabled states, and validation errors in the sheet; do not duplicate business logic in the template.

- [ ] **Step 5: Add every required message in English, Ukrainian, and Spanish**

Add `meeting.editTask`, `meeting.editAgreement`, `meeting.taskUpdated`, `meeting.agreementUpdated`, `meeting.taskDeleted`, `meeting.agreementDeleted`, `meeting.editTaskAria`, `meeting.editAgreementAria`, and `meeting.deleteAgreementAria` (reusing an existing task-delete key when present). Keep all locale objects structurally identical.

- [ ] **Step 6: Run focused page and locale tests to verify they pass**

Run: `npm test -- src/pages/__tests__/MeetingPage.test.ts src/features/localization/__tests__/messages.test.ts`

Expected: PASS with sheets rendering from both list locations and no missing translation keys.

### Task 5: Run full verification and inspect the mobile flow

**Files:**

- Modify: formatting-only changes in files from Tasks 1-4, if Prettier reports them.

**Interfaces:**

- Consumes: all completed implementation tasks.
- Produces: a validated build and quality-check result.

- [ ] **Step 1: Run all affected automated tests**

Run: `npm test -- src/app/stores/__tests__/meetings.test.ts src/app/stores/__tests__/tasks.test.ts src/features/meeting/composables/__tests__/useMeetingSession.test.ts src/features/meeting/components/__tests__/MeetingSectionStep.test.ts src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts src/pages/__tests__/MeetingPage.test.ts src/features/localization/__tests__/messages.test.ts`

Expected: PASS.

- [ ] **Step 2: Format modified files**

Run: `npm run format`

Expected: Prettier writes only formatting changes.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: PASS with TypeScript and Vite completing successfully.

- [ ] **Step 4: Run quality checks**

Run: `npm run check`

Expected: PASS with formatting and ESLint clean.

- [ ] **Step 5: Manually check the Android-sized interaction**

Run: `npm run dev`

Expected: In a narrow viewport, adding then editing/deleting a note, task, and agreement works from both a section and the review step; the Undo action restores deleted records; completed meetings expose no record mutation actions.

## Plan self-review

- Spec coverage: Task 1 implements validated canonical updates/deletes and mirror synchronization; Task 2 handles sessions and undo; Task 3 adds consistent controls; Task 4 supplies sheets and translated copy; Task 5 verifies automated and mobile behavior.
- Placeholder scan: no incomplete requirements or deferred work are included.
- Type consistency: the plan consistently uses `updateTaskDetails`, `updateAgreement`, `deleteAgreement`, `restoreAgreement`, `openTaskEditor`, and `openAgreementEditor`.
