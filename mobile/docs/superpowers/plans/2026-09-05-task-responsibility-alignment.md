# Task Responsibility Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Tasks page's separate adult-assignment field while preserving the meeting-flow responsibility choice.

**Architecture:** The Tasks page's local create/edit drafts and save payloads will retain only the responsibility choice that maps to `responsibilityType` and `responsibleParticipantIds`. The task and meeting stores preserve persisted `responsibleUserIds` when an update omits that optional field.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, vue-i18n, Vitest, Vue Test Utils.

## Global Constraints

- Use Vue 3 Composition API with `<script setup lang="ts">`.
- Keep the mobile UI short, calm, and consistent with the meeting flow.
- Do not add dependencies or modify task persistence, API DTOs, or stored historical data.
- Do not commit unless the user explicitly requests a commit.

---

### Task 1: Remove the Tasks-page adult-assignment UI and write path

**Files:**

- Create: `src/pages/__tests__/TasksPage.test.ts`
- Modify: `src/pages/TasksPage.vue:15-75, 87-95, 164-175, 403-465, 825-936`
- Modify: `src/app/stores/tasks.ts:379-403`
- Modify: `src/app/stores/meetings.ts:797-821`
- Modify: `src/app/stores/__tests__/tasks.test.ts`
- Modify: `src/app/stores/__tests__/meetings.test.ts`

**Interfaces:**

- Consumes: `Task.responsibilityType`, `Task.responsibleParticipantIds`, and the existing `resolveDraftResponsibility(choice)` helper.
- Produces: Tasks-page create and edit payloads containing title, due date, `responsibilityType`, and `responsibleParticipantIds`, without `responsibleUserIds`.

- [ ] **Step 1: Write the failing page test**

Create `src/pages/__tests__/TasksPage.test.ts` with the happy-dom directive and mocks for i18n, the meetings/tasks/participants/workspace stores, startup loading, and workspace permissions. Mount `TasksPage` with `BaseBottomSheet` rendered as its slot. Open the add sheet, then assert that its text does not include `tasksPage.responsibleAdults`. Seed one task, open its editor, and assert the same.

```ts
// @vitest-environment happy-dom
it('does not render adult assignment controls in either task sheet', async () => {
  const wrapper = mountTasksPage();

  await wrapper.get('.tasks-fab').trigger('click');
  expect(wrapper.text()).not.toContain('tasksPage.responsibleAdults');

  await wrapper.get('[data-testid="task-card-task-1"]').trigger('click');
  expect(wrapper.text()).not.toContain('tasksPage.responsibleAdults');
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/pages/__tests__/TasksPage.test.ts`

Expected: FAIL because the add and edit sheets still render `tasksPage.responsibleAdults`.

- [ ] **Step 3: Remove the unused adult-assignment state and UI**

In `TasksPage.vue`, remove the workspace store import, `activeAdultMembers` computed value, and `responsibleUserIds` from both local draft shapes. Remove the adult-assignment `<label>` and multi-select from the add and edit sheets. Remove `responsibleUserIds` from both `tasksStore` and `meetingsStore` calls in `saveTask`, and from `tasksStore.addTask` in `addTask`. In the task and meeting stores, preserve the current `responsibleUserIds` when their update payload does not supply that field; add a store test for that compatibility behavior.

```ts
tasksStore.updateTask(task.id, {
  title: draft.title,
  dueDate: draft.dueDate,
  ...responsibility,
});

meetingsStore.updateTaskDetails(task.id, {
  title: draft.title,
  dueDate: draft.dueDate,
  ...responsibility,
});
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/pages/__tests__/TasksPage.test.ts`

Expected: PASS; neither sheet exposes the adult-assignment label or multi-select.

- [ ] **Step 5: Verify the project checks**

Run: `npm run build`

Expected: PASS with Vue and TypeScript checks succeeding.

Run: `npm run check`

Expected: PASS with Prettier and ESLint checks succeeding.
