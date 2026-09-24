# Task Detail Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give task descriptions a clearly labelled, readable Details block that matches the task edit sheet's form language.

**Architecture:** `TasksPage` will keep its semantic read-only Details block. Global task-editor styles will make its label identical to other form labels and preserve the improved description typography without a background or accent treatment; the linked-meeting metadata remains separate.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vitest, Vue Test Utils, CSS.

## Global Constraints

- Keep the description read-only and do not add dependencies or persistence changes.
- Render the Details block only when `selectedTask.description` has content.
- Use the existing `tasksPage.optionalDetail` localized label.
- Preserve mobile-friendly spacing, readable contrast, and natural form reading order.
- Do not commit unless the user explicitly requests a commit.

---

### Task 1: Refine the task Details block styling

**Files:**

- Modify: `src/pages/TasksPage.vue:829-838`
- Modify: `src/styles/main.css:4378-4395`
- Modify: `src/pages/__tests__/TasksPage.test.ts`

**Interfaces:**

- Consumes: `selectedTask.description` and `t('tasksPage.optionalDetail')`.
- Produces: `.task-editor-form__details` containing a form-label-equivalent `.task-editor-form__details-label` and readable `.task-editor-form__details-copy` when a selected task has a description.

- [x] **Step 1: Update the focused Tasks-page test**

Keep the existing description-presence tests. Add an assertion that the block exposes the existing localized Details label.

```ts
expect(wrapper.get('.task-editor-form__details').text()).toContain(
  'A short task detail.'
);
expect(wrapper.get('.task-editor-form__details').attributes('aria-label')).toBe(
  'tasksPage.optionalDetail'
);
expect(wrapper.find('.task-editor-form__details').exists()).toBe(false);
```

- [x] **Step 2: Run the focused test to protect the existing markup**

Run: `npx vitest run src/pages/__tests__/TasksPage.test.ts`

Expected: PASS; this visual-only change must preserve the existing Details content and its conditional rendering.

- [x] **Step 3: Remove the card treatment from the Details block**

Keep the existing semantic Details markup and source-meeting note. Remove the background, border, rounded-card spacing, and uppercase label treatment from the Details styles.

- [x] **Step 4: Match the existing form-label styles**

```css
.task-editor-form__details {
  display: grid;
  gap: 6px;
}

.task-editor-form__details-label {
  color: var(--color-on-surface);
  font-size: var(--font-size-label-lg);
  font-weight: 800;
}
```

Keep the existing Details copy font size and line height.

- [x] **Step 5: Run verification**

Run: `npx vitest run src/pages/__tests__/TasksPage.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `npx eslint src/pages/TasksPage.vue src/pages/__tests__/TasksPage.test.ts`

Expected: PASS.

Manually verify the task edit sheet: Details uses the same label treatment as Task, Responsible, and Still relevant; it has no background or left border; the description retains its improved text size and line height.
