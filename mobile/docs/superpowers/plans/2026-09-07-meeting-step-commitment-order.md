# Meeting Step Commitment Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a meeting step's task and agreement panels before its note panel without changing meeting content or controls.

**Architecture:** `MeetingSectionStep.vue` already receives independent current task, agreement, and note collections and controls their panels locally. Reorder those existing template sections so tasks precede agreements and notes; no composable, store, data model, or parent-page interface changes are needed. A component test will assert the DOM order for all three populated collections.

**Tech Stack:** Vue 3 Composition API, TypeScript, vue-i18n, Vitest, Vue Test Utils.

## Global Constraints

- Use the existing Vue 3 Composition API and TypeScript patterns.
- Preserve existing props, emits, permissions, controls, and local meeting data.
- Keep the mobile-first, calm meeting flow and semantic section headings.
- Do not add dependencies.
- Run `npm run build` and `npm run check` before handoff.

---

### Task 1: Verify and implement the meeting-panel order

**Files:**

- Modify: `src/features/meeting/components/MeetingSectionStep.vue`
- Create: `src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

**Interfaces:**

- Consumes: Existing `MeetingSectionStep` props `currentTasks: EnrichedMeetingTask[]`, `currentAgreements: EnrichedAgreement[]`, `currentNotes: EnrichedMeetingNote[]`, `canAddTasks`, `canAddAgreements`, and `showNotes`.
- Produces: The same component public interface, with DOM panels ordered by their existing heading IDs: `meeting-tasks-title`, `meeting-agreements-title`, `meeting-notes-title`.

- [ ] **Step 1: Write the failing component test**

Create `src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`. Mount `MeetingSectionStep` with the required props and one task, agreement, and note whose text values are `Task first`, `Agreement second`, and `Note last`. Stub `ParticipantAvatar` and provide i18n messages that return each requested key. Assert that the index of the task panel heading in `wrapper.text()` is less than the agreement heading index, and the agreement heading index is less than the notes heading index.

```ts
const headings = wrapper
  .findAll('.meeting-panel-title')
  .map((node) => node.text());

expect(headings).toEqual([
  'meeting.tasks',
  'meeting.agreements',
  'meeting.notes',
]);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

Expected: FAIL because the component currently renders the note panel before task and agreement panels.

- [ ] **Step 3: Reorder the existing panel markup**

In `src/features/meeting/components/MeetingSectionStep.vue`, move the complete task panel block (`v-if="canAddTasks"`) above the agreement panel block (`v-if="canAddAgreements"`), and move both above the notes panel block (`v-if="showNotes"`). Do not change the panel internals, props, emit handlers, conditions, IDs, or user-facing copy.

```vue
<section v-if="canAddTasks" ...>...</section>
<section v-if="canAddAgreements" ...>...</section>
<section v-if="showNotes" ...>...</section>
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

Expected: PASS; the rendered panel order is tasks, agreements, then notes.

- [ ] **Step 5: Run the required project validation**

Run: `npm run build`

Expected: PASS; Vue type checking and Vite production build complete.

Run: `npm run check`

Expected: PASS; formatting and ESLint checks complete.

- [ ] **Step 6: Review the final diff**

Run: `git diff -- src/features/meeting/components/MeetingSectionStep.vue src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

Expected: Only the template order changes and the focused regression test are present.
