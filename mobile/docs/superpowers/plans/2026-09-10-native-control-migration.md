# Native Control Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every remaining native select, date, and time control with accessible, mobile-native-feeling OurWeek pickers.

**Architecture:** Shared `SelectPickerField`, `TimePickerField`, and `DatePickerField` own only their local picker UI and emit staged values. Existing pages, components, stores, and meeting composables retain data ownership and call their current actions or typed emits after receiving a picker update.

**Tech Stack:** Vue 3 Composition API, TypeScript, vue-i18n, Pinia, Vitest, Vue Test Utils, Capacitor Android back integration, existing `BaseBottomSheet` and `BaseDialog`.

## Global Constraints

- Keep existing visible form labels above every picker trigger; triggers show only the selected value and expose the label through their accessible name.
- Do not add a dependency or change persisted task, meeting, note, participant, calendar, or reminder data shapes.
- `SelectPickerField` uses an app-styled bottom sheet; `TimePickerField` uses Samsung-inspired scroll-snap wheels; `DatePickerField` uses an app-styled calendar dialog.
- All picker overlays use the existing focus, scrim, Escape, and Android Back mechanics. Cancel/backdrop/Back must never emit a staged value.
- Optional due dates must be clearable and use date-only ISO `YYYY-MM-DD` values without timezone shifts.
- Keep existing disabled behavior, Premium locks, and handler/store boundaries intact.
- Use translation-ready copy, semantic buttons, 48px+ targets, and project CSS tokens.
- Do not stage or commit files unless the user explicitly requests it.

---

## File structure

- Create: `src/shared/components/SelectPickerField.vue` and `src/shared/components/__tests__/SelectPickerField.test.ts`.
- Create: `src/shared/components/TimePickerField.vue` and `src/shared/components/__tests__/TimePickerField.test.ts`.
- Create: `src/shared/components/DatePickerField.vue` and `src/shared/components/__tests__/DatePickerField.test.ts`.
- Delete: `src/features/reminders/components/ReminderDayPickerField.vue`, `ReminderTimePickerDialog.vue`, and their focused tests after their shared replacements are imported by Settings.
- Modify: `src/pages/SettingsPage.vue`, `CalendarSyncPage.vue`, `TasksPage.vue`, `MeetingPage.vue`, `PrivateNotesPage.vue`, `src/features/meeting/components/MeetingSectionStep.vue`, and `src/features/participants/components/HouseholdMembersSettings.vue`.
- Modify: matching page/component tests, `src/features/localization/messages.ts`, and `src/styles/main.css`.

### Task 1: Promote the select sheet into a shared picker

**Files:**

- Create: `src/shared/components/SelectPickerField.vue`
- Create: `src/shared/components/__tests__/SelectPickerField.test.ts`
- Modify: `src/styles/main.css`

**Interfaces:**

- Consumes: `BaseBottomSheet`.
- Produces:

```ts
export type PickerOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

defineProps<{
  modelValue: string;
  label: string;
  options: ReadonlyArray<PickerOption>;
  disabled?: boolean;
}>();
defineEmits<{ 'update:modelValue': [value: string] }>();
```

- Used by: every migrated select in Tasks 4–6.

- [ ] **Step 1: Write failing shared-select tests**

```ts
it('emits an enabled selected value and closes', async () => {
  const wrapper = mount(SelectPickerField, {
    props: { modelValue: 'shared', label: 'Responsible', options },
    global: bottomSheetStub,
  });
  await wrapper.get('.picker-field__trigger').trigger('click');
  await wrapper.get('[data-picker-option="rita"]').trigger('click');

  expect(wrapper.emitted('update:modelValue')).toEqual([['rita']]);
  expect(wrapper.find('.base-bottom-sheet').exists()).toBe(false);
});

it('does not emit for disabled options or a dismissed sheet', async () => {
  // Select the disabled option, then emit BaseBottomSheet close.
  expect(wrapper.emitted('update:modelValue')).toBeUndefined();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/shared/components/__tests__/SelectPickerField.test.ts`

Expected: FAIL because the shared component does not exist.

- [ ] **Step 3: Implement the shared select component**

Move the behavior of `ReminderDayPickerField` into `SelectPickerField` and
replace its reminder-specific class names with `picker-field` /
`select-picker`. Render the trigger as:

```vue
<button
  class="picker-field__trigger"
  type="button"
  :aria-label="label"
  :aria-expanded="isOpen"
  :disabled="disabled"
  @click="openPicker"
>
  <span class="picker-field__value">{{ selectedLabel }}</span>
  <span class="material-symbols-outlined" aria-hidden="true">expand_more</span>
</button>
```

The sheet option button receives `data-picker-option`, `aria-pressed`, and
`disabled="option.disabled"`. Only an enabled choice emits and closes. Keep
all labels external in consuming templates. Rename shared CSS selectors
without changing the proven trigger/row spacing.

- [ ] **Step 4: Run the select test to verify it passes**

Run: `npm test -- src/shared/components/__tests__/SelectPickerField.test.ts`

Expected: PASS.

### Task 2: Promote the Samsung-style time wheel

**Files:**

- Create: `src/shared/components/TimePickerField.vue`
- Create: `src/shared/components/__tests__/TimePickerField.test.ts`
- Modify: `src/styles/main.css`

**Interfaces:**

- Consumes: `BaseDialog`, `common.cancel`, `common.done`, `settings.hours`, and `settings.minutes`.
- Produces:

```ts
defineProps<{
  modelValue: string;
  label: string;
  stepMinutes: number;
  disabled?: boolean;
}>();
defineEmits<{ 'update:modelValue': [value: string] }>();
```

- Used by: reminder and calendar time fields in Task 4.

- [ ] **Step 1: Write failing time-wheel tests**

```ts
it('emits only on Done after a wheel scroll', async () => {
  const wrapper = mount(TimePickerField, {
    props: { modelValue: '18:00', label: 'Time', stepMinutes: 5 },
    global: dialogStub,
  });
  await wrapper.get('.picker-field__trigger').trigger('click');
  await setWheelScroll(wrapper.findAll('.time-picker__wheel')[0], 7 * 56);
  await wrapper.get('[data-testid="time-picker-done"]').trigger('click');

  expect(wrapper.emitted('update:modelValue')).toEqual([['07:00']]);
});

it('falls back safely from malformed time and emits nothing on Cancel', async () => {
  // Open modelValue "bad", assert 09:00 preview, then cancel.
  expect(wrapper.emitted('update:modelValue')).toBeUndefined();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/shared/components/__tests__/TimePickerField.test.ts`

Expected: FAIL because the shared component does not exist.

- [ ] **Step 3: Implement and rename the wheel component**

Move `ReminderTimePickerDialog` logic to `TimePickerField`. Preserve
`parseTime`, nearest valid minute resolution, 56px scroll-snap rows, wheel
ref scrolling, tap support, selected center window, and staged Done behavior.
Rename test IDs to `time-picker-cancel` and `time-picker-done`; rename CSS to
`time-picker__*`. The external `<label>` remains responsible for visual label
placement. Do not alter the wheel's values, opacity treatment, or dialog
mechanics.

- [ ] **Step 4: Run the time-wheel test to verify it passes**

Run: `npm test -- src/shared/components/__tests__/TimePickerField.test.ts`

Expected: PASS.

### Task 3: Create a staged ISO-date calendar field

**Files:**

- Create: `src/shared/components/DatePickerField.vue`
- Create: `src/shared/components/__tests__/DatePickerField.test.ts`
- Modify: `src/features/localization/messages.ts`
- Modify: `src/styles/main.css`

**Interfaces:**

- Consumes: `BaseDialog`, active vue-i18n locale, and `common.clear` / `common.noDate`.
- Produces:

```ts
defineProps<{
  modelValue: string;
  label: string;
  disabled?: boolean;
}>();
defineEmits<{ 'update:modelValue': [value: string] }>();
```

- Used by: task due-date fields in Tasks 5–6.

- [ ] **Step 1: Write failing date-picker tests**

```ts
it('stages a selected day as a date-only ISO string until Done', async () => {
  const wrapper = mount(DatePickerField, {
    props: { modelValue: '', label: 'Due date' },
    global: dialogStub,
  });
  await wrapper.get('.picker-field__trigger').trigger('click');
  await wrapper.get('[data-picker-date="2026-09-15"]').trigger('click');
  expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  await wrapper.get('[data-testid="date-picker-done"]').trigger('click');
  expect(wrapper.emitted('update:modelValue')).toEqual([['2026-09-15']]);
});

it('stages Clear and discards it on Cancel', async () => {
  // Clear a populated date, cancel, and assert no emitted value.
});
```

- [ ] **Step 2: Run the date test to verify it fails**

Run: `npm test -- src/shared/components/__tests__/DatePickerField.test.ts`

Expected: FAIL because the date field does not exist.

- [ ] **Step 3: Implement calendar helpers and UI**

Inside `DatePickerField`, parse only strict ISO dates using numeric parts and
construct UTC dates with `Date.UTC(year, monthIndex, day)`. Generate the month
grid from UTC weekday/date APIs, including inert leading/trailing cells. Track
`displayedYear`, `displayedMonthIndex`, and staged ISO date locally. Render
previous/next month buttons, localized month-year heading, weekday headers,
and 48px+ date buttons. Use `data-picker-date` with zero-padded ISO values.

The trigger displays `Intl.DateTimeFormat(locale, { dateStyle: 'medium' })`
for a valid value and `t('common.noDate')` for empty/invalid values. Clear
stages `''`; Cancel and dialog close only close; Done emits the staged string.
Add `common.clear` and `common.noDate` in English, Ukrainian, and Spanish.
Add token-based calendar styles for selected, current-month, disabled filler,
and focused cells.

- [ ] **Step 4: Run date-picker tests to verify they pass**

Run: `npm test -- src/shared/components/__tests__/DatePickerField.test.ts src/features/localization/__tests__/messages.test.ts`

Expected: PASS.

### Task 4: Migrate settings and calendar schedule fields

**Files:**

- Modify: `src/pages/SettingsPage.vue`
- Modify: `src/pages/CalendarSyncPage.vue`
- Modify: `src/pages/__tests__/SettingsPage.test.ts`
- Modify: `src/pages/__tests__/CalendarSyncPage.test.ts`

**Interfaces:**

- Consumes: Tasks 1–2 shared select/time components.
- Produces: the existing `update*Reminder` and `updateWeeklyMeetingSchedule` actions with unchanged payloads.

- [ ] **Step 1: Extend page tests first**

Add stubs that emit `update:modelValue` and assert:

```ts
expect(state.updateUnfinishedTaskReminder).toHaveBeenCalledWith({
  day: 'monday',
});
expect(state.updateUnfinishedTaskReminder).toHaveBeenCalledWith({
  time: '07:05',
});
expect(state.updateWeeklyMeetingSchedule).toHaveBeenCalledWith({
  weeklyMeetingDay: 'monday',
});
expect(state.updateWeeklyMeetingSchedule).toHaveBeenCalledWith({
  weeklyMeetingTime: '07:05',
});
```

Also assert the targeted native `select` / `input[type="time"]` controls no
longer exist.

- [ ] **Step 2: Run the two page tests to verify they fail**

Run: `npm test -- src/pages/__tests__/SettingsPage.test.ts src/pages/__tests__/CalendarSyncPage.test.ts`

Expected: FAIL because the remaining fields still render native controls.

- [ ] **Step 3: Replace native fields with shared components**

Replace the unfinished-task Settings controls using the existing external
labels, day options, handlers, and five-minute time step. Convert Calendar
schedule event handlers to typed `CalendarWeekday` / `string` parameters and
retain the existing connection-based disabled binding. Map its existing
localized weekday options to `PickerOption` values.

- [ ] **Step 4: Run migrated page tests**

Run: `npm test -- src/pages/__tests__/SettingsPage.test.ts src/pages/__tests__/CalendarSyncPage.test.ts`

Expected: PASS.

### Task 5: Migrate task editor and meeting-flow task fields

**Files:**

- Modify: `src/pages/TasksPage.vue`
- Modify: `src/pages/__tests__/TasksPage.test.ts`
- Modify: `src/features/meeting/components/MeetingSectionStep.vue`
- Modify: `src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

**Interfaces:**

- Consumes: `SelectPickerField` and `DatePickerField` from Tasks 1 and 3.
- Produces: existing draft assignments and `update:taskResponsibilityChoice` / `update:taskDueDate` emits.

- [ ] **Step 1: Write failing migration assertions**

Test the add-task and edit-task sheets emit responsibility and optional due
date through their existing drafts; test the meeting step emits the same typed
payloads. For example:

```ts
await wrapper
  .getComponent(SelectPickerField)
  .vm.$emit('update:modelValue', 'shared');
expect(wrapper.emitted('update:taskResponsibilityChoice')).toEqual([
  ['shared'],
]);
await wrapper
  .getComponent(DatePickerField)
  .vm.$emit('update:modelValue', '2026-09-15');
expect(wrapper.emitted('update:taskDueDate')).toEqual([['2026-09-15']]);
```

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm test -- src/pages/__tests__/TasksPage.test.ts src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

Expected: FAIL until the two pages render shared fields.

- [ ] **Step 3: Migrate responsibilities and due dates**

Create computed option arrays that preserve the current display labels,
including inactive-participant suffixes. Replace task add/edit selects with
`SelectPickerField`; bind component updates directly to the relevant draft
property. Replace all three due-date inputs with `DatePickerField`; bind
updates to their draft/ref or existing emit. Preserve `canEditTasks` /
`canEditMeeting` disabled flags and retain every external `<label>`.

- [ ] **Step 4: Run focused tests to verify pass**

Run: `npm test -- src/pages/__tests__/TasksPage.test.ts src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

Expected: PASS.

### Task 6: Migrate participant and meeting-related selects

**Files:**

- Modify: `src/pages/MeetingPage.vue`
- Modify: `src/pages/PrivateNotesPage.vue`
- Modify: `src/features/participants/components/HouseholdMembersSettings.vue`
- Modify: their existing component/page tests.

**Interfaces:**

- Consumes: `SelectPickerField`.
- Produces: existing `editingNoteParticipantId`, `noteDraft.relatedMeetingId`, and `participantDraft.type` bindings.

- [ ] **Step 1: Add failing emit/binding tests**

For each consumer, emit `update:modelValue` from a shared-component stub and
assert its original reactive property changes. Include a test that the meeting
author control remains disabled when `canEditMeeting` is false.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/pages/__tests__/MeetingRecapPages.test.ts src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts`

Expected: FAIL before the three native selects are replaced.

- [ ] **Step 3: Replace all three selects**

Map active meeting participants to `{ value: id, label: name }`; map related
meetings with `{ value: '', label: t('privateNotes.noMeetingLink') }` followed
by meeting IDs and labels; pass the participant-type option list unchanged.
Replace each native select with `SelectPickerField` within its existing
external label and bind `v-model` or `@update:model-value` to the current
draft/ref. Do not alter note save, participant save, or meeting recap logic.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm test -- src/pages/__tests__/MeetingRecapPages.test.ts src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts`

Expected: PASS.

### Task 7: Remove trial components and verify the whole migration

**Files:**

- Delete: the four reminder-trial component/test files listed in File structure.
- Modify: `src/pages/SettingsPage.vue` imports and corresponding styles/tests.

**Interfaces:**

- Consumes: shared components from Tasks 1–3.
- Produces: no native select, date, or time controls under `src/pages` or `src/features`.

- [ ] **Step 1: Remove trial duplicates and add a native-control audit**

Delete the obsolete reminder-only components/tests after Settings imports the
shared replacements. Run:

```powershell
rg -n -e '<select' -e 'type="date"' -e 'type="time"' src/pages src/features
```

Expected: no results.

- [ ] **Step 2: Run complete automated verification**

Run: `npm test && npm run build && npm run check`

Expected: all tests, typecheck, build, formatting, and lint pass. If the known
unrelated `.superpowers/brainstorm` formatting file still blocks the repository
formatter, run Prettier and ESLint against every changed migration file and
report the unrelated blocker exactly.

- [ ] **Step 3: Sync Android and perform a physical-device review**

Run: `npm run cap:sync`

Expected: Android web assets synchronize successfully.

On a real Android device verify each migrated select, wheel, and calendar:
external labels, options/dates, Clear, disabled fields, Cancel/backdrop/Back,
app restart persistence, and no clipped content on a small screen.
