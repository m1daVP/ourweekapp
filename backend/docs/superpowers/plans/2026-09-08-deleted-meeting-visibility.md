# Deleted Meeting Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure deleting an unfinished meeting hides it immediately and permanently from the meeting-template continuation prompt and history after sync.

**Architecture:** Preserve the existing local `deletedAt` tombstone until the API acknowledges the soft deletion. Correct the template-page active-draft selector so it has the same visibility rule as the store, route decision, and history selectors: unfinished meetings must not have `deletedAt`. The backend contract remains unchanged.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, Vue Test Utils, Fastify API sync contract.

## Global Constraints

- Preserve offline tombstones until meeting synchronization acknowledges the deletion.
- Do not change backend soft-delete behavior, API DTOs, migrations, or meeting-derived task/agreement deletion behavior.
- Treat `deletedAt` as invisible in every unfinished/resumable meeting UI selection.
- Do not stage or commit changes unless the user explicitly requests it.

---

### Task 1: Prevent deleted drafts from becoming template-page continuation prompts

**Files:**
- Create: `D:\Projects\myself\weekly-us\src\pages\__tests__\MeetingTemplatesPage.test.ts`
- Modify: `D:\Projects\myself\weekly-us\src\pages\MeetingTemplatesPage.vue:29-36`
- Verify: `D:\Projects\myself\weekly-us\src\app\stores\__tests__\meetings.test.ts`

**Interfaces:**
- Consumes: `Meeting` records from `useMeetingsStore()`, where `deletedAt?: string` is a local/server deletion tombstone.
- Produces: `activeDraft: ComputedRef<Meeting | null>` that contains only an unfinished, non-deleted meeting.
- Preserves: `deleteDraftMeeting(meetingId): boolean`, which sets `deletedAt`, clears stale draft metadata when needed, and persists the tombstone for sync.

- [ ] **Step 1: Write the failing template-page regression test**

Create `src/pages/__tests__/MeetingTemplatesPage.test.ts` using the page-test mock style already used in `TasksPage.test.ts`. Mock the meeting store with a reactive object that contains a deleted draft and no active meeting. Mock `useI18n`, `useRouter`, `useTasksStore`, `useFeatureAccess`, `useWorkspacePermissions`, `haptics`, and `TemplateCard` so the test mounts only the page behavior.

```ts
it('does not offer a deleted draft as a meeting to continue', () => {
  state.meetings = [
    {
      id: 'meeting-deleted',
      templateId: 'weekly-family-check-in',
      title: 'Saved draft',
      status: 'draft',
      participantIds: [],
      checkInCompleted: false,
      sections: [],
      currentSectionIndex: 0,
      createdAt: '2026-09-08T10:00:00.000Z',
      updatedAt: '2026-09-08T10:05:00.000Z',
      deletedAt: '2026-09-08T10:06:00.000Z',
    },
  ];
  state.activeMeetingId = null;

  const wrapper = mount(MeetingTemplatesPage);

  expect(wrapper.find('.template-draft-panel').exists()).toBe(false);
  expect(wrapper.text()).not.toContain('templatePage.continueDraft');
});
```

- [ ] **Step 2: Run the new test and verify the regression fails**

Run:

```powershell
npm test -- src/pages/__tests__/MeetingTemplatesPage.test.ts
```

Expected: the test fails because the page currently finds any meeting whose status is not `completed`, including the deleted draft.

- [ ] **Step 3: Make the active-draft selector obey the deletion visibility rule**

In `MeetingTemplatesPage.vue`, change the fallback finder to require `!meeting.deletedAt`. Also explicitly reject a deleted `activeMeeting` even though the store getter currently excludes it, so the page rule remains correct if its source changes.

```ts
const activeDraft = computed(
  () =>
    (meetingsStore.activeMeeting &&
    meetingsStore.activeMeeting.status !== 'completed' &&
    !meetingsStore.activeMeeting.deletedAt
      ? meetingsStore.activeMeeting
      : null) ??
    meetingsStore.meetings.find(
      (meeting) => meeting.status !== 'completed' && !meeting.deletedAt
    ) ??
    null
);
```

- [ ] **Step 4: Run focused regressions and type validation**

Run:

```powershell
npm test -- src/pages/__tests__/MeetingTemplatesPage.test.ts src/app/stores/__tests__/meetings.test.ts src/shared/services/__tests__/syncService.test.ts
npm run build
```

Expected: the new page regression passes; existing deletion and sync tests stay green; Vue typechecking and the production frontend build succeed.

- [ ] **Step 5: Review the behavioral boundary manually**

Verify in the application that deleting a saved draft:

1. removes it from History immediately;
2. does not render the template-page “continue draft” panel;
3. remains absent after an online sync and a page reload; and
4. stays hidden while offline, then remains absent after reconnect and sync.

- [ ] **Step 6: Leave changes unstaged**

Do not stage or commit. The repository instructions prohibit commits unless the user explicitly authorizes them.
