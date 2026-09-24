# Reminder Picker Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the weekly-meeting reminder's native day select and time input with branded, accessible OurWeek controls for real Android devices.

**Architecture:** The day field is a feature-level trigger backed by the existing `BaseBottomSheet`; the time field uses a new reusable, centered `BaseDialog` for modal mechanics. Both controls stage UI state locally and emit only valid domain values to `SettingsPage`, which remains the sole owner of reminder-store persistence and notification scheduling.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, vue-i18n, Vitest, Vue Test Utils, Capacitor Android back integration, project CSS tokens.

## Global Constraints

- The trial covers only the weekly-meeting reminder day and time fields in `SettingsPage.vue`; leave every other native picker unchanged.
- Do not add a dependency; use `BaseBottomSheet`, project CSS tokens, and native Vue/DOM APIs.
- Use `<script setup lang="ts">`, typed props/emits, semantic buttons, and a 48px minimum control height.
- Android Back must close an active picker before router navigation; cancellation/backdrop dismissal must not persist a staged time.
- Keep reminder scheduling, local persistence, and Premium access behavior in the existing stores/composables.
- Do not commit or stage files unless the user explicitly requests it.

---

## File structure

- Create: `src/shared/components/BaseDialog.vue` — reusable centered-modal mechanics with focus/back behavior.
- Create: `src/shared/components/__tests__/BaseDialog.test.ts` — verifies dialog dismissal and focus restoration.
- Create: `src/features/reminders/components/ReminderDayPickerField.vue` — weekly day trigger and bottom-sheet options.
- Create: `src/features/reminders/components/ReminderTimePickerDialog.vue` — staged 24-hour, five-minute time selection dialog.
- Create: `src/features/reminders/components/__tests__/ReminderDayPickerField.test.ts` — verifies day choice/dismissal behavior.
- Create: `src/features/reminders/components/__tests__/ReminderTimePickerDialog.test.ts` — verifies valid output and staged cancellation.
- Modify: `src/pages/SettingsPage.vue` — wire only the weekly-meeting reminder to the two components.
- Modify: `src/pages/__tests__/SettingsPage.test.ts` — assert emitted values call existing reminder-store actions.
- Modify: `src/features/localization/messages.ts` — add time-grid labels in English, Ukrainian, and Spanish.
- Modify: `src/styles/main.css` — define dialog, field trigger, day list, and scroll-snap time-wheel styles using existing design tokens.

### Task 1: Create the reusable centered dialog

**Files:**

- Create: `src/shared/components/BaseDialog.vue`
- Create: `src/shared/components/__tests__/BaseDialog.test.ts`
- Modify: `src/styles/main.css:2551-2649`

**Interfaces:**

- Consumes: `registerAndroidBackHandler` from `@/app/composables/useAndroidBackButton`.
- Produces: `BaseDialog` with `open: boolean`, `title?: string`, a default slot, and a `close` event.
- Used by: `ReminderTimePickerDialog` in Task 3.

- [ ] **Step 1: Write the failing dialog test**

```ts
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import BaseDialog from '../BaseDialog.vue';

const registerAndroidBackHandler = vi.fn(() => vi.fn());
vi.mock('@/app/composables/useAndroidBackButton', () => ({
  registerAndroidBackHandler,
}));

it('closes from the scrim and restores focus to its trigger', async () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const wrapper = mount(BaseDialog, {
    attachTo: document.body,
    props: { open: true, title: 'Choose time' },
    slots: { default: '<button>Done</button>' },
  });

  await wrapper.get('.base-dialog__scrim').trigger('click');

  expect(wrapper.emitted('close')).toHaveLength(1);
  await wrapper.setProps({ open: false });
  expect(document.activeElement).toBe(trigger);
  expect(registerAndroidBackHandler).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/shared/components/__tests__/BaseDialog.test.ts`

Expected: FAIL because `BaseDialog.vue` does not exist.

- [ ] **Step 3: Implement the minimal dialog component**

Implement `BaseDialog` by adapting the focusable-element query, focus trap,
focus restoration, Escape key handling, `Teleport`, scrim, and Android-back
registration from `BaseBottomSheet.vue`. Use the exact prop/emit contract:

```ts
const props = defineProps<{ open: boolean; title?: string }>();
const emit = defineEmits<{ close: [] }>();
```

Render the following structure so styling and tests remain stable:

```vue
<Teleport to="body">
  <Transition name="base-dialog">
    <div v-if="open" class="base-dialog" role="dialog" aria-modal="true" :aria-label="title">
      <button class="base-dialog__scrim" type="button" :aria-label="t('common.close')" @click="closeDialog" />
      <section ref="panelElement" class="base-dialog__panel" tabindex="-1">
        <header v-if="title" class="base-dialog__header">
          <h2>{{ title }}</h2>
          <button type="button" @click="closeDialog">{{ t('common.close') }}</button>
        </header>
        <slot />
      </section>
    </div>
  </Transition>
</Teleport>
```

Add styles alongside `.base-bottom-sheet`: fixed full-viewport overlay and
scrim; a centered panel capped at `min(100% - 32px, 420px)`; token-based
surface, radius, shadow, and padding; transform/opacity transition; and a
reduced-motion-safe transition. Do not alter existing bottom-sheet rules.

- [ ] **Step 4: Run the component test to verify it passes**

Run: `npm test -- src/shared/components/__tests__/BaseDialog.test.ts`

Expected: PASS.

### Task 2: Add the weekly reminder day picker

**Files:**

- Create: `src/features/reminders/components/ReminderDayPickerField.vue`
- Create: `src/features/reminders/components/__tests__/ReminderDayPickerField.test.ts`
- Modify: `src/styles/main.css`

**Interfaces:**

- Consumes: `BaseBottomSheet`, `ReminderDay`, and translation function `t`.
- Produces: a `v-model` component accepting `modelValue`, `label`, `options`, and optional `disabled`.
- Used by: `SettingsPage` in Task 4.

- [ ] **Step 1: Write the failing day-picker tests**

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ReminderDayPickerField from '../ReminderDayPickerField.vue';

const options = [
  { value: 'sunday' as const, label: 'Sunday' },
  { value: 'monday' as const, label: 'Monday' },
];

it('emits the selected day and closes its sheet', async () => {
  const wrapper = mount(ReminderDayPickerField, {
    props: { modelValue: 'sunday', label: 'Day', options },
  });
  await wrapper.get('.reminder-picker-field__trigger').trigger('click');
  await wrapper.get('[data-reminder-day="monday"]').trigger('click');

  expect(wrapper.emitted('update:modelValue')).toEqual([['monday']]);
  expect(wrapper.find('.base-bottom-sheet').exists()).toBe(false);
});

it('does not emit when the sheet is dismissed', async () => {
  const wrapper = mount(ReminderDayPickerField, {
    props: { modelValue: 'sunday', label: 'Day', options },
  });
  await wrapper.get('.reminder-picker-field__trigger').trigger('click');
  await wrapper.getComponent({ name: 'BaseBottomSheet' }).vm.$emit('close');

  expect(wrapper.emitted('update:modelValue')).toBeUndefined();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/features/reminders/components/__tests__/ReminderDayPickerField.test.ts`

Expected: FAIL because `ReminderDayPickerField.vue` does not exist.

- [ ] **Step 3: Implement the day picker**

Use this typed public interface:

```ts
type ReminderDayOption = { value: ReminderDay; label: string };
const props = withDefaults(
  defineProps<{
    modelValue: ReminderDay;
    label: string;
    options: ReadonlyArray<ReminderDayOption>;
    disabled?: boolean;
  }>(),
  { disabled: false }
);
const emit = defineEmits<{ 'update:modelValue': [value: ReminderDay] }>();
```

The trigger carries `class="reminder-picker-field__trigger"`, includes its
visible label and selected label, is disabled when requested, and opens only
local `isOpen` state. The `BaseBottomSheet` title is the field label. Each
option is a `type="button"` row with `data-reminder-day`, `aria-pressed`, and
an `is-selected` class. Its click handler emits the option value and then
closes the sheet. The sheet close event only closes it and emits no change.

Style the trigger and options in `main.css`: 48px minimum target, input-like
surface, chevron/check icon treatment, 12px+ spacing, and high-contrast
selected state; the option list must be a single-column list with no tiny
targets.

- [ ] **Step 4: Run the day-picker test to verify it passes**

Run: `npm test -- src/features/reminders/components/__tests__/ReminderDayPickerField.test.ts`

Expected: PASS.

### Task 3: Add the staged centered time picker

**Files:**

- Create: `src/features/reminders/components/ReminderTimePickerDialog.vue`
- Create: `src/features/reminders/components/__tests__/ReminderTimePickerDialog.test.ts`
- Modify: `src/styles/main.css`

**Interfaces:**

- Consumes: `BaseDialog`, `common.cancel`, and `common.done` translations.
- Produces: a `v-model` component accepting `modelValue`, `label`, `stepMinutes`, and optional `disabled`.
- Used by: `SettingsPage` in Task 4.

- [ ] **Step 1: Write the failing time-picker tests**

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ReminderTimePickerDialog from '../ReminderTimePickerDialog.vue';

it('emits a zero-padded staged time only after Done', async () => {
  const wrapper = mount(ReminderTimePickerDialog, {
    props: { modelValue: '18:00', label: 'Time', stepMinutes: 5 },
  });
  await wrapper.get('.reminder-picker-field__trigger').trigger('click');
  await wrapper.get('[data-reminder-hour="7"]').trigger('click');
  await wrapper.get('[data-reminder-minute="5"]').trigger('click');
  await wrapper.get('[data-testid="reminder-time-done"]').trigger('click');

  expect(wrapper.emitted('update:modelValue')).toEqual([['07:05']]);
});

it('discards a staged selection when Cancel is pressed', async () => {
  const wrapper = mount(ReminderTimePickerDialog, {
    props: { modelValue: '18:00', label: 'Time', stepMinutes: 5 },
  });
  await wrapper.get('.reminder-picker-field__trigger').trigger('click');
  await wrapper.get('[data-reminder-hour="7"]').trigger('click');
  await wrapper.get('[data-testid="reminder-time-cancel"]').trigger('click');

  expect(wrapper.emitted('update:modelValue')).toBeUndefined();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/features/reminders/components/__tests__/ReminderTimePickerDialog.test.ts`

Expected: FAIL because `ReminderTimePickerDialog.vue` does not exist.

- [ ] **Step 3: Implement the time picker**

Use this typed public interface and validate the runtime `stepMinutes` value
before generating minute options:

```ts
const props = withDefaults(
  defineProps<{
    modelValue: string;
    label: string;
    stepMinutes: number;
    disabled?: boolean;
  }>(),
  { disabled: false }
);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
```

Create a `parseTime(value: string): { hour: number; minute: number } | null`
helper that accepts exactly `HH:MM`, rejects hours outside `00`–`23` and
minutes outside `00`–`59`, and returns `null` otherwise. When opening, clone
the valid parsed time into local `selectedHour` and `selectedMinute`; otherwise
initialize those refs to `9` and `0`. Build hour options from `0` through `23`
and minute options from `0` through `59` using a positive divisor step, with
`5` as a defensive fallback. Use a local `padTimePart` helper to produce
`HH:MM`.

Render the same field trigger class used by the day picker, retaining the
existing external form label. Open `BaseDialog` with the translated field
label. Inside it render a `role="status"` preview and two labelled
`role="listbox"` scroll-snap wheels of hour buttons (`data-reminder-hour`) and
minute buttons (`data-reminder-minute`). Each wheel keeps the selected option
centered in a 56px selection window and fades neighboring values. Buttons use
`aria-selected` and an `is-selected` class.
Cancel and the dialog `close` event only set `isOpen` false. Done emits the
formatted time then closes.

Add CSS for a large numeric preview, two 280px-high scroll-snap wheels with a
56px center selection window, faded neighboring values, 48px+ tap targets, and
an always-visible action row. It must fit inside the centered panel without
horizontal scrolling.

- [ ] **Step 4: Run the time-picker test to verify it passes**

Run: `npm test -- src/features/reminders/components/__tests__/ReminderTimePickerDialog.test.ts`

Expected: PASS.

### Task 4: Integrate only the weekly-meeting reminder and its grid labels

**Files:**

- Modify: `src/pages/SettingsPage.vue:1-180, 480-550`
- Modify: `src/pages/__tests__/SettingsPage.test.ts`
- Modify: `src/features/localization/messages.ts:587-660, 2133-2205, 3710-3782`

**Interfaces:**

- Consumes: `ReminderDayPickerField` and `ReminderTimePickerDialog` from Tasks 2–3.
- Produces: weekly reminder updates through existing `updateWeeklyMeetingReminder` store action.
- Preserves: unfinished-task reminder native controls and existing notification permission flows.

- [ ] **Step 1: Extend the Settings page test first**

Update the reminder-store mock so it exposes a full weekly reminder and a spy:

```ts
reminderSettings: {
  enabled: false,
  weeklyMeetingReminder: { day: 'sunday', time: '18:00' },
  unfinishedTaskReminder: { day: 'wednesday', time: '18:00' },
},
updateWeeklyMeetingReminder: vi.fn(),
```

Add component stubs that emit `update:modelValue`, then verify both values use
the existing store action:

```ts
it('persists weekly reminder picker values through the existing store action', async () => {
  const wrapper = mountSettingsPage();
  await wrapper
    .getComponent({ name: 'ReminderDayPickerField' })
    .vm.$emit('update:modelValue', 'monday');
  await wrapper
    .getComponent({ name: 'ReminderTimePickerDialog' })
    .vm.$emit('update:modelValue', '07:05');

  expect(state.updateWeeklyMeetingReminder).toHaveBeenNthCalledWith(1, {
    day: 'monday',
  });
  expect(state.updateWeeklyMeetingReminder).toHaveBeenNthCalledWith(2, {
    time: '07:05',
  });
});
```

- [ ] **Step 2: Run the Settings page test to verify it fails**

Run: `npm test -- src/pages/__tests__/SettingsPage.test.ts`

Expected: FAIL because Settings does not yet render or handle the two picker components.

- [ ] **Step 3: Wire the components and grid labels**

Import both components. Replace only the `<select>` and `<input type="time">`
inside the weekly-meeting fieldset with the new components. Keep the
unfinished-task `<select>` and `<input type="time">` exactly as they are.
Replace event-based weekly handlers with typed handlers:

```ts
function updateWeeklyMeetingReminderDay(day: ReminderDay) {
  remindersStore.updateWeeklyMeetingReminder({ day });
}

function updateWeeklyMeetingReminderTime(time: string) {
  remindersStore.updateWeeklyMeetingReminder({ time });
}
```

Pass the current `localizedReminderDayOptions`, translated `settings.day` /
`settings.time` labels, and `timeInputStep / 60` (five minutes) to the
controls. Use the field label as each overlay title and reuse `common.cancel`
and `common.done` for the dialog actions. Add `settings.hours` and
`settings.minutes` in English, Ukrainian, and Spanish for the picker grids.
Preserve `timeInputStep` for the untouched native unfinished-task time field.

- [ ] **Step 4: Run the Settings test to verify it passes**

Run: `npm test -- src/pages/__tests__/SettingsPage.test.ts`

Expected: PASS.

### Task 5: Run the complete quality gate and manual Android trial

**Files:**

- Verify only; no new files.

**Interfaces:**

- Consumes: completed components, Settings integration, and existing reminder scheduling.
- Produces: evidence that the small trial is safe to review on a physical Android device.

- [ ] **Step 1: Run focused picker tests**

Run: `npm test -- src/shared/components/__tests__/BaseDialog.test.ts src/features/reminders/components/__tests__/ReminderDayPickerField.test.ts src/features/reminders/components/__tests__/ReminderTimePickerDialog.test.ts src/pages/__tests__/SettingsPage.test.ts`

Expected: PASS.

- [ ] **Step 2: Run project quality checks**

Run: `npm run build && npm run check`

Expected: TypeScript build, Prettier check, and ESLint all pass.

- [ ] **Step 3: Prepare Android and inspect the physical-device behavior**

Run: `npm run cap:sync`

Expected: production web assets build and synchronize to Android successfully.

On a real Android device, open Settings → Reminder details and verify:

1. The weekly reminder day trigger opens the branded sheet and selection is
   persisted after restart.
2. The weekly reminder time trigger opens the centered dialog; selecting
   `07` and `05` shows `07:05` and persists only after Done.
3. Cancel, backdrop tap, and Android Back do not change the staged time.
4. Android Back closes the sheet/dialog before changing route or minimizing.
5. The unfinished-task reminder remains unchanged and still schedules
   normally.
6. The dialog has no clipped content on a small Android screen and respects
   device safe areas.

- [ ] **Step 4: Record review outcome before widening the migration**

Capture whether the day sheet and time dialog feel native enough, visually
consistent, and comfortable to use. Do not migrate additional fields until the
user reviews this physical-device trial.
