# Review Task Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make task editing from the review-and-close step use the same composer bottom sheet as adding a task.

**Architecture:** `MeetingPage` will retain a task-specific composer scope when task editing begins. The scope will resolve against the task's section rather than depending on the currently displayed meeting step, so the final review can use `MeetingItemComposer` normally. Existing validation, save, and close behavior remain unchanged.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vue Test Utils, Vitest.

## Global Constraints

- Use Vue 3 Composition API with `<script setup lang="ts">`.
- Preserve mobile-first bottom-sheet behavior and accessible button controls.
- Do not add dependencies.
- Keep task changes local-first and retain existing permissions checks.

---

### Task 1: Preserve a composer scope for task edits

**Files:**

- Modify: `src/pages/MeetingPage.vue:140-160, 429-438`
- Test: `src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

**Interfaces:**

- Consumes: `openTaskEditor(task: EnrichedMeetingTask)` from `useMeetingSession` and `MeetingComposerDraftScope` from `meetingComposerDrafts`.
- Produces: a non-null `taskEditorComposerScope` while an editable task is selected on the review-and-close step.

- [ ] **Step 1: Write the failing interaction assertion**

Extend the review task-edit test to mount the parent interaction path and assert the `MeetingItemComposer` is rendered with `open: true` and `scope.type === 'task'` after emitting `edit-task` for a review task.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm exec vitest run src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

Expected: FAIL because the review screen has no active section and `taskEditorComposerScope` is null.

- [ ] **Step 3: Store an edit-specific scope before opening the editor**

In `MeetingPage.vue`, introduce a `ref<MeetingComposerDraftScope | null>` for the task editor scope. Wrap the task editor opening action so it records an object with the active meeting, selected task's `sectionId`, workspace user/workspace IDs, and `type: 'task'`, then invokes `openTaskEditor(task)`. Reset that ref when the editor closes. Bind the task editor composer to this stored scope.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm exec vitest run src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

Expected: PASS.

- [ ] **Step 5: Run project verification**

Run: `npm run build; npm run check`

Expected: Both commands exit with status 0.
