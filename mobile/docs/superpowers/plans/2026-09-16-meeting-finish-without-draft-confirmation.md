# Meeting Finish Without Draft Confirmation Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with a test-first cycle. Do not dispatch subagents unless the user explicitly requests delegation.

**Goal:** Finish an in-progress meeting without showing a temporary composer-draft confirmation, while safely removing only that meeting's unsubmitted local composer drafts.

**Architecture:** Add one account/workspace/meeting-scoped bulk cleanup operation to the local composer-draft module. Call it at the start of the existing `finishMeeting` completion path, then remove the obsolete draft-review state and dialog from the meeting session and page.

**Tech Stack:** Vue 3, TypeScript 6, Pinia, Vue Router, Vitest, Vue Test Utils

## Global Constraints

- Preserve composer auto-save during an active meeting.
- Do not change submitted meeting items.
- Do not add dependencies or backend behavior.
- Preserve unrelated working-tree changes, especially the current edits in `src/pages/MeetingPage.vue` and `src/pages/__tests__/MeetingPage.test.ts`.
- Do not stage or create a Git commit unless the user explicitly requests it.

---

### Task 1: Add scoped bulk cleanup for temporary composer drafts

**Files:**

- Modify: `src/features/meeting/meetingComposerDrafts.ts`
- Modify: `src/features/meeting/__tests__/meetingComposerDrafts.test.ts`

**Interfaces:**

- Consumes: the existing `readDrafts()`, `writeStorageSlice()`, and `MeetingComposerDraft` scope fields.
- Produces: `discardMeetingComposerDraftsForMeeting(userId: string, workspaceId: string, meetingId: string): LocalWriteResult` by inference from `writeStorageSlice`.

- [ ] **Step 1: Extend the storage mock so cleanup failures are testable**

Update the hoisted storage fixture in `meetingComposerDrafts.test.ts` to hold a configurable write result:

```ts
const storage = vi.hoisted(() => ({
  drafts: null as unknown,
  write: vi.fn(),
  writeResult: { ok: true } as
    { ok: true } | { ok: false; reason: 'write_failed' },
}));
```

Return `storage.writeResult` from the mocked `writeStorageSlice`, and reset it to `{ ok: true }` in `beforeEach`.

- [ ] **Step 2: Write failing tests for scoped bulk cleanup**

Import `discardMeetingComposerDraftsForMeeting` and add tests that save drafts for the current meeting, another meeting, another workspace, and another user. Assert that current-meeting unsubmitted drafts are removed while every out-of-scope draft remains. Add a failure test with one matching draft and `storage.writeResult = { ok: false, reason: 'write_failed' }`, asserting that the failure is returned.

Core assertions:

```ts
expect(
  discardMeetingComposerDraftsForMeeting('user-1', 'workspace-1', 'meeting-1')
).toEqual({ ok: true });

expect(
  getMeetingComposerDraftsForMeeting('user-1', 'workspace-1', 'meeting-1')
).toEqual([]);
expect(
  getMeetingComposerDraftsForMeeting('user-1', 'workspace-1', 'meeting-2')
).toHaveLength(1);
```

- [ ] **Step 3: Run the focused test and verify the missing export fails**

Run:

```bash
npx vitest run src/features/meeting/__tests__/meetingComposerDrafts.test.ts
```

Expected: FAIL because `discardMeetingComposerDraftsForMeeting` is not exported.

- [ ] **Step 4: Implement the scoped cleanup operation**

Add this function beside `discardMeetingComposerDraft`:

```ts
export function discardMeetingComposerDraftsForMeeting(
  userId: string,
  workspaceId: string,
  meetingId: string
) {
  const drafts = readDrafts();
  const hasMatchingDraft = drafts.some(
    (draft) =>
      draft.userId === userId &&
      draft.workspaceId === workspaceId &&
      draft.meetingId === meetingId &&
      !draft.submittedItemId
  );

  if (!hasMatchingDraft) return { ok: true } as const;

  return writeStorageSlice(
    draftStorageKey,
    drafts.filter(
      (draft) =>
        draft.userId !== userId ||
        draft.workspaceId !== workspaceId ||
        draft.meetingId !== meetingId ||
        Boolean(draft.submittedItemId)
    )
  );
}
```

The early success avoids making meeting completion depend on a storage write when no temporary drafts exist.

- [ ] **Step 5: Run the focused storage tests**

Run:

```bash
npx vitest run src/features/meeting/__tests__/meetingComposerDrafts.test.ts
```

Expected: PASS.

---

### Task 2: Make meeting completion clean drafts silently

**Files:**

- Create: `src/features/meeting/composables/__tests__/meetingDraftCompletion.test.ts`
- Modify: `src/features/meeting/composables/useMeetingSession.ts`

**Interfaces:**

- Consumes: `discardMeetingComposerDraftsForMeeting(userId, workspaceId, meetingId)` from Task 1.
- Produces: the existing `finishMeeting(): Promise<void>` behavior with cleanup before `meetingsStore.finishMeeting()` and without any draft-resolution state.

- [ ] **Step 1: Write a focused completion regression test**

Create `meetingDraftCompletion.test.ts` using `setupRecapTest`, the same minimal mounted setup used by `meetingRecapCompletion.test.ts`, and a hoisted mock:

```ts
const draftCleanup = vi.hoisted(() => ({
  discardForMeeting: vi.fn(() => ({ ok: true }) as const),
}));

vi.mock('@/features/meeting/meetingComposerDrafts', () => ({
  discardMeetingComposerDraftsForMeeting: draftCleanup.discardForMeeting,
}));
```

Set the fixture meeting to `in_progress`, make it active, call `session.finishMeeting()`, and assert:

```ts
expect(draftCleanup.discardForMeeting).toHaveBeenCalledWith(
  'local-owner',
  context.workspace.workspace.id,
  'meeting-1'
);
expect(context.meetings.meetings[0]!.status).toBe('completed');
expect(push).toHaveBeenCalledWith(
  expect.objectContaining({ name: 'meeting-summary' })
);
```

Add a second test where cleanup returns `{ ok: false, reason: 'write_failed' }`. Assert the meeting remains `in_progress`, navigation is not called, and `session.formError.value` equals the localized `meeting.presentation.saveFailed` message.

- [ ] **Step 2: Run the focused completion test and verify it fails**

Run:

```bash
npx vitest run src/features/meeting/composables/__tests__/meetingDraftCompletion.test.ts
```

Expected: FAIL because `finishMeeting` does not call the new bulk cleanup function.

- [ ] **Step 3: Replace draft blocking with silent cleanup**

In `useMeetingSession.ts`:

1. Replace the imports of `discardMeetingComposerDraft`, `getMeetingComposerDraftsForMeeting`, and `MeetingComposerDraftScope` with `discardMeetingComposerDraftsForMeeting`.
2. Remove `isDraftResolutionOpen`.
3. Remove `getOutstandingDrafts`, `reviewOutstandingDraft`, `returnToFinalReview`, and `discardOutstandingDraftsAndFinish`.
4. Remove those values from the composable return object.
5. Insert this guard in `finishMeeting` after `meetingId` is validated and before `isFinishingMeeting` is set:

```ts
const draftCleanup = discardMeetingComposerDraftsForMeeting(
  workspaceStore.currentUserId,
  workspaceStore.workspace.id,
  meetingId
);

if (!draftCleanup.ok) {
  formError.value = t('meeting.presentation.saveFailed');
  return;
}
```

Do not change the existing meeting-store completion, haptics, or summary navigation sequence.

- [ ] **Step 4: Run completion and existing recap tests**

Run:

```bash
npx vitest run src/features/meeting/composables/__tests__/meetingDraftCompletion.test.ts src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts
```

Expected: PASS.

---

### Task 3: Remove the obsolete confirmation UI

**Files:**

- Modify: `src/pages/MeetingPage.vue`
- Modify: `src/pages/__tests__/MeetingPage.test.ts`

**Interfaces:**

- Consumes: the simplified `useMeetingSession()` return shape from Task 2.
- Produces: a meeting page with AI and deletion confirmations unchanged, but no temporary-draft resolution confirmation.

- [ ] **Step 1: Add a page regression assertion**

Import `ConfirmationDialog` in `MeetingPage.test.ts`, mount the existing final-review fixture, and assert that no dialog receives the removed title:

```ts
const draftDialog = wrapper
  .findAllComponents(ConfirmationDialog)
  .find((dialog) => dialog.props('title') === 'meeting.resolveDraftsTitle');

expect(draftDialog).toBeUndefined();
```

Keep the existing safe-area test intact.

- [ ] **Step 2: Remove draft-review wiring from the page**

In `MeetingPage.vue`:

1. Remove `isDraftResolutionOpen`, `reviewOutstandingDraft`, `returnToFinalReview`, and `discardOutstandingDraftsAndFinish` from the session destructuring.
2. Remove `isReviewingDraft` and `handleReviewOutstandingDraft`.
3. Simplify `closeComposer()` to only set `composerType.value = null`.
4. Remove the `ConfirmationDialog` whose title is `meeting.resolveDraftsTitle`.

In the test fixture, remove the same obsolete actions from `actionNames` and remove `isDraftResolutionOpen` from `createMeetingSession()`.

- [ ] **Step 3: Run the page test**

Run:

```bash
npx vitest run src/pages/__tests__/MeetingPage.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run all focused meeting tests**

Run:

```bash
npx vitest run src/features/meeting/__tests__/meetingComposerDrafts.test.ts src/features/meeting/composables/__tests__/meetingDraftCompletion.test.ts src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts src/pages/__tests__/MeetingPage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run project verification**

Run:

```bash
npm run build
npm run check
```

Expected: both commands exit successfully. If `npm run check` reports formatting in a touched file, format only the touched files with Prettier and rerun the focused tests plus `npm run check`.

- [ ] **Step 6: Review the final diff without staging**

Run:

```bash
git -c safe.directory=D:/Projects/myself/weekly-us diff -- src/features/meeting/meetingComposerDrafts.ts src/features/meeting/__tests__/meetingComposerDrafts.test.ts src/features/meeting/composables/useMeetingSession.ts src/features/meeting/composables/__tests__/meetingDraftCompletion.test.ts src/pages/MeetingPage.vue src/pages/__tests__/MeetingPage.test.ts
```

Confirm that the diff contains only scoped draft cleanup, completion-flow simplification, dialog removal, and regression tests. Do not stage or commit.
