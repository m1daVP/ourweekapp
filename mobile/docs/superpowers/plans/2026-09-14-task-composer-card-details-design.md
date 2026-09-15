# Task Composer Card Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an approved, mobile-first task creation bottom sheet with a smooth details disclosure, card-based responsibility selection, and calendar summary field.

**Architecture:** Keep `MeetingItemComposer` as the owner of task draft state and submission. Extend `DatePickerField` with an opt-in summary presentation so the existing staged calendar dialog stays reusable, and use `ParticipantAvatar` for the composer-only horizontal responsibility cards.

**Tech Stack:** Vue 3 Composition API, TypeScript, vue-i18n, Vue Test Utils, Vitest, scoped CSS.

## Global Constraints

- Use Vue 3 `<script setup lang="ts">` and semantic buttons.
- Preserve existing local-first task persistence, validation, and responsibility values.
- Keep the app mobile-only, with 44 px minimum touch targets and safe mobile overflow behaviour.
- Use transform and opacity for motion and respect the existing reduced-motion override.
- Add no dependencies and use npm scripts for validation.

---

### Task 1: Add the reusable calendar-summary presentation

**Files:**

- Modify: `src/shared/components/DatePickerField.vue`
- Modify: `src/shared/components/__tests__/DatePickerField.test.ts`

**Interfaces:**

- Consumes: `modelValue: string`, `label: string`, `disabled?: boolean`.
- Produces: optional `presentation?: 'default' | 'summary'` and `actionLabel?: string`; both presentations open the same staged picker and emit `update:modelValue` only on confirmation.

- [ ] **Step 1: Write the failing summary-presentation test**

```ts
it('renders a calendar summary trigger and still confirms dates', async () => {
  const wrapper = mount(DatePickerField, {
    props: {
      modelValue: '2026-10-28',
      label: 'Due date',
      presentation: 'summary',
      actionLabel: 'Change',
    },
    global,
  });

  expect(wrapper.get('.reminder-picker-field--summary').text()).toContain(
    'Change'
  );
  await wrapper.get('.reminder-picker-field__trigger').trigger('click');
  await wrapper.get('[data-testid="date-picker-done"]').trigger('click');
  expect(wrapper.emitted('update:modelValue')).toEqual([['2026-10-28']]);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run src/shared/components/__tests__/DatePickerField.test.ts`

Expected: FAIL because the summary class and action label are absent.

- [ ] **Step 3: Implement the summary trigger branch**

```ts
const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    disabled?: boolean;
    presentation?: 'default' | 'summary';
    actionLabel?: string;
  }>(),
  { disabled: false, presentation: 'default', actionLabel: '' }
);
```

Render the current trigger for `default`; render an icon, localized `triggerValue`, and the supplied action label for `summary`. Keep `openPicker`, staging, clear, cancel, and confirmation unchanged.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npx vitest run src/shared/components/__tests__/DatePickerField.test.ts`

Expected: PASS.

### Task 2: Rebuild task-only composer details and selectors

**Files:**

- Modify: `src/features/meeting/components/MeetingItemComposer.vue`
- Modify: `src/features/meeting/components/__tests__/MeetingItemComposer.test.ts`

**Interfaces:**

- Consumes: composer `task` draft fields (`title`, `description`, `responsibilityChoice`, `dueDate`) and `participants: Participant[]`.
- Consumes: `DatePickerField` `presentation="summary"` with `v-model`.
- Produces: direct responsibility-card buttons that call `composer.updateTaskField('responsibilityChoice', value)` and an `aria-expanded` disclosure without unmounting its inner controls.

- [ ] **Step 1: Write failing task-composer interaction tests**

```ts
it('keeps task detail controls mounted while the disclosure is collapsed', () => {
  const wrapper = mountTaskComposer();
  expect(wrapper.get('.meeting-item-composer__task-details')).toBeTruthy();
  expect(
    wrapper.get('.meeting-item-composer__task-details').attributes('inert')
  ).toBeDefined();
});

it('selects a participant responsibility card', async () => {
  const wrapper = mountTaskComposer();
  await wrapper.get('[data-responsibility="rita"]').trigger('click');
  expect(wrapper.get('[data-responsibility="rita"]').classes()).toContain(
    'is-selected'
  );
});

it('uses the summary date picker instead of native date input', async () => {
  const wrapper = mountTaskComposer();
  await wrapper.get('.meeting-item-composer__details-toggle').trigger('click');
  expect(wrapper.findComponent(DatePickerField).props('presentation')).toBe(
    'summary'
  );
  expect(wrapper.find('input[type="date"]').exists()).toBe(false);
});
```

- [ ] **Step 2: Run the focused composer test to verify it fails**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingItemComposer.test.ts`

Expected: FAIL because the disclosure, card selectors, and summary picker do not exist.

- [ ] **Step 3: Implement the task-sheet markup and state**

Replace the plain optional button and conditional task-field block with a task-only disclosure button and a permanently rendered `.meeting-item-composer__task-details` wrapper. Bind `aria-expanded` and `inert` to `hasOptionalTaskFields`. Derive responsibility cards from unassigned, shared, and active participants; use `ParticipantAvatar` for participant cards. Use `DatePickerField presentation="summary"` for `taskDueDate`.

- [ ] **Step 4: Implement scoped mobile styling**

```css
.meeting-item-composer__task-details {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transform: translateY(-0.5rem);
  transition:
    grid-template-rows 420ms cubic-bezier(0.22, 0.78, 0.24, 1),
    opacity 260ms ease,
    transform 420ms cubic-bezier(0.22, 0.78, 0.24, 1);
}
.meeting-item-composer__task-details.is-open {
  grid-template-rows: 1fr;
  opacity: 1;
  transform: none;
}
.meeting-item-composer__task-details-inner {
  overflow: hidden;
}
```

Style the disclosure, inner group, text area, horizontal card rail, selected state, summary calendar row, sheet heading, and action pills to the approved warm/green visual system. Retain distinct focus-visible styles.

- [ ] **Step 5: Run focused composer tests to verify they pass**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingItemComposer.test.ts`

Expected: PASS.

### Task 3: Validate the completed interaction

**Files:**

- Modify only if validation exposes an issue: `src/features/meeting/components/MeetingItemComposer.vue`, `src/shared/components/DatePickerField.vue`, or their tests.

**Interfaces:**

- Consumes: completed Task 1 and Task 2 components.
- Produces: a task composer that animates details without content popping, retains draft updates, and passes project quality checks.

- [ ] **Step 1: Run the relevant component tests together**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingItemComposer.test.ts src/shared/components/__tests__/DatePickerField.test.ts`

Expected: PASS.

- [ ] **Step 2: Run production type/build validation**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Run formatting and lint validation**

Run: `npm run check`

Expected: PASS, or report only pre-existing unrelated failures with their paths.

## Self-review

- Scope coverage: Task 2 covers the redesigned disclosure, visually grouped expanded fields, horizontal avatar cards, and task-sheet action/header styling. Task 1 supplies the calendar summary without duplicating picker logic. Task 3 validates motion and quality gates.
- Placeholder scan: no implementation placeholders or undefined interfaces remain.
- Type consistency: `presentation` and `actionLabel` are defined in Task 1 and consumed with the same names in Task 2.
