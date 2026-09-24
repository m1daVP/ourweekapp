# Meeting Review-and-Finish Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the in-progress meeting review-and-finish step to match the supplied mobile references without changing its behavior or the completed-summary page.

**Architecture:** Keep `MeetingReviewCloseStep.vue` as the single state and event boundary. Its template retains the existing emitted events and reuses `MeetingDisclosurePanel` for the notes visibility control; scoped CSS gives the hero, review cards, inset rows, quick-add panel, and footer controls the new visual treatment.

**Tech Stack:** Vue 3 Composition API, TypeScript, vue-i18n, Vue Test Utils, Vitest, scoped CSS.

## Global Constraints

- Change only the final, in-progress review step; do not modify `src/pages/MeetingSummaryPage.vue`.
- Preserve the header styling and the existing horizontal page padding; content must not bleed full-width.
- Retain all existing meeting data, translations, permission conditions, emitted events, disabled states, and finish flow.
- Reuse `src/features/meeting/components/MeetingDisclosurePanel.vue` for the notes dropdown and preserve its accessible inline show/hide behavior.
- Keep interactive controls reachable with a 44px minimum touch target and retain semantic buttons and focus behavior.
- Do not add dependencies or commit changes unless the user explicitly requests a commit.

---

## File structure

- `src/features/meeting/components/MeetingReviewCloseStep.vue` — owns the review UI, notes visibility binding, existing event surface, and scoped mobile styles.
- `src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts` — verifies the redesigned component still emits its existing actions and exposes the notes picker behavior.

### Task 1: Protect the review step's behavior with a focused component test

**Files:**

- Create: `src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`
- Reference: `src/features/meeting/components/MeetingReviewCloseStep.vue`

**Interfaces:**

- Consumes: `MeetingReviewCloseStep` props `allTasks`, `allAgreements`, `allNotes`, `reviewCounts`, permission booleans, and status strings.
- Produces: Coverage for `toggle-task`, `edit-task`, `delete-task`, `capture`, `finish`, and notes-picker visibility changes.

- [ ] **Step 1: Write the failing test for the existing interaction contract**

```ts
it('keeps task actions, quick capture, finish, and notes visibility interactive', async () => {
  const wrapper = mount(MeetingReviewCloseStep, {
    props: createProps(),
    global: { plugins: [i18n], stubs: { BaseBottomSheet: bottomSheetStub } },
  });

  await wrapper
    .get('[data-testid="review-task-toggle-task-1"]')
    .trigger('click');
  await wrapper.get('[data-testid="review-task-edit-task-1"]').trigger('click');
  await wrapper
    .get('[data-testid="review-task-delete-task-1"]')
    .trigger('click');
  await wrapper.get('[data-testid="review-capture-note"]').trigger('click');
  await wrapper.get('[data-testid="review-notes-picker"]').trigger('click');
  await wrapper.get('[data-picker-option="shown"]').trigger('click');
  await wrapper.get('[data-testid="review-finish"]').trigger('click');

  expect(wrapper.emitted('toggle-task')).toEqual([['task-1', 'open']]);
  expect(wrapper.emitted('edit-task')).toHaveLength(1);
  expect(wrapper.emitted('delete-task')).toEqual([['task-1']]);
  expect(wrapper.emitted('capture')).toEqual([['note']]);
  expect(wrapper.find('#review-close-notes-list').isVisible()).toBe(true);
  expect(wrapper.emitted('finish')).toEqual([[]]);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

Expected: FAIL because the stable review-step test IDs and picker binding do not exist yet.

- [ ] **Step 3: Add test fixtures that match the component's public prop types**

```ts
function createProps() {
  return {
    allTasks: [createTask('task-1')],
    allAgreements: [createAgreement('agreement-1')],
    allNotes: [createNote('note-1')],
    canCreateMeeting: true,
    canEditMeeting: true,
    canEditTasks: true,
    formError: '',
    hasMeetingContent: true,
    isCompleted: false,
    isFinishingMeeting: false,
    meetingDurationLabel: '15 min',
    progressPercent: '100%',
    reviewCounts: { tasks: 1, agreements: 1, notes: 1 },
    statusMessage: '',
  };
}
```

- [ ] **Step 4: Run the focused test again**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

Expected: It remains red until Task 2 supplies the deliberate test hooks and notes picker behavior.

### Task 2: Implement the visual redesign and notes picker in the review step

**Files:**

- Modify: `src/features/meeting/components/MeetingReviewCloseStep.vue:1-961`
- Test: `src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

**Interfaces:**

- Consumes: Existing props and emits unchanged; `MeetingDisclosurePanel` accepts `{ controls: string; label: string; open: boolean }` and emits `toggle`.
- Produces: Stable test IDs from Task 1 and the existing review-step emits with unchanged payloads.

- [ ] **Step 1: Reuse the inline notes dropdown without changing the stored notes state**

```ts
<MeetingDisclosurePanel
  class="review-close-notes-picker"
  :open="areNotesExpanded"
  :label="notesToggleText"
  controls="review-close-notes-list"
  @toggle="areNotesExpanded = !areNotesExpanded"
>
  <!-- Existing note groups remain here. -->
</MeetingDisclosurePanel>
```

Keep `MeetingDisclosurePanel`, expose `data-testid="review-notes-picker"`, and restyle its trigger as the wide dropdown shown in the references. Keep the existing note row edit/delete event handlers unchanged.

- [ ] **Step 2: Apply stable test IDs to existing interactive controls**

```vue
<button :data-testid="`review-task-toggle-${task.id}`" ...>
<button :data-testid="`review-task-edit-${task.id}`" ...>
<button :data-testid="`review-task-delete-${task.id}`" ...>
<button data-testid="review-capture-note" ...>
<button data-testid="review-finish" ...>
```

Do not use test IDs as CSS selectors. They are test-only attributes and must not alter user-visible behavior.

- [ ] **Step 3: Rework the scoped CSS to match the supplied references**

Implement these exact visual relationships in the existing scoped style block:

```css
.review-close-card {
  border: 1px solid #e8e0d3;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 8px 24px rgb(47 42 38 / 6%);
}

.review-close-badge {
  border: 1px solid #eadbc8;
  border-radius: var(--radius-pill);
  background: #f7efe3;
  color: #81571f;
}

.review-close-action-list > li,
.review-close-text-list--actions > li {
  border: 1px solid #ebe2d5;
  border-radius: 18px;
  background: #fcfbf8;
}
```

Make the task card title/icon/count sit on a border-separated card header; use serif titles and note/agreement text, muted small assignment/author metadata, green edit icons, and restrained red delete icons. Give the quick-add section its own soft sand panel with white pill buttons. Make the floating footer a rounded white container with a quiet back action and a forest-green finish action. Keep all visual widths inside `var(--edge-margin)`.

- [ ] **Step 4: Preserve narrow-screen responsiveness**

At `max-width: 360px`, reduce only in-card gaps, title sizes, and pill padding as necessary. Do not reduce icon/button hit areas below 44px and do not alter the top header's typography.

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

Expected: PASS. The test confirms old event payloads still emit and opening “show notes” reveals the note list.

- [ ] **Step 6: Run regression checks**

Run:

```powershell
npm run build
npm run check
```

Expected: Both commands exit with code 0.

- [ ] **Step 7: Perform mobile visual QA**

Open a meeting's final review step at 360px and 412px widths. Confirm the header is unchanged; all cards retain page padding; the task, agreement, note, quick-add, and footer sections match the references; note picker selections work; and task/note/agreement edit/delete, task completion, capture, back, and finish controls remain usable.

## Plan self-review

- **Spec coverage:** Task 2 covers the hero, separate cards, typography, inset task/agreement/note rows, inline notes dropdown, quick-add panel, footer actions, padding, and mobile responsiveness. Task 1 protects the event contract and notes visibility behavior.
- **Placeholder scan:** No placeholders or deferred work markers are present.
- **Type consistency:** `MeetingDisclosurePanel` receives the existing boolean `areNotesExpanded` state and emits a parameterless toggle; all meeting action payloads match the component's declared emit signatures.
