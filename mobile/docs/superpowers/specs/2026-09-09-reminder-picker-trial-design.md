# Reminder picker trial design

## Goal

Replace the Android-owned day select and time input for the weekly-meeting
reminder with two OurWeek-styled controls, so the first frequently used
settings fields feel deliberate on a real device without changing reminder
data or scheduling behavior.

## Scope

This trial is limited to the **Weekly meeting reminder** fields in
`SettingsPage.vue`:

- Day of the week;
- Reminder time.

The unfinished-task reminder, task editor, meeting flow, calendar sync,
private notes, and participant settings retain their current native controls.
They will be migrated only after the trial is reviewed on a real Android
device.

## Approaches considered

1. A custom bottom sheet for both fields would be the smallest change, but a
   time picker presented as a long option list risks feeling like a menu rather
   than a picker.
2. A themed native Android picker would preserve familiar platform behavior,
   but could not match the app consistently and would require a Capacitor
   native bridge.
3. **Selected approach:** use an OurWeek bottom sheet for the seven-day choice
   and a compact centered time dialog for choosing time. This deliberately
   tests both patterns before the project standardizes on either.

No package will be added for this trial. The app already has `BaseBottomSheet`
with focus, scrim, and Android-back behavior. A tiny custom time dialog is
smaller, more themeable, and less risky in a Capacitor WebView than a general
date/time library.

## Components and responsibilities

### `ReminderDayPickerField`

Create a feature component under `src/features/reminders/components`. It
renders the current translated day as a field-like button and opens a
`BaseBottomSheet` on activation. The sheet lists the seven translated reminder
days as full-width buttons; the selected option is visibly marked and exposed
with `aria-pressed="true"`.

Its public interface is:

```ts
defineProps<{
  modelValue: ReminderDay;
  label: string;
  options: ReadonlyArray<{ value: ReminderDay; label: string }>;
  disabled?: boolean;
}>();

defineEmits<{
  'update:modelValue': [value: ReminderDay];
}>();
```

Selecting a day emits the value and closes the sheet. Backdrop dismissal,
Close, Escape, and Android back leave the existing value unchanged.

### `ReminderTimePickerDialog`

Create a feature component under `src/features/reminders/components`. It
renders the current time as a field-like button and opens a centered dialog.
The dialog stages the value locally, displays a large `HH:MM` preview, and has
two vertical scroll-snap wheels: hours `00`–`23` and minutes at the existing
five-minute interval `00`–`55`. Each wheel presents a centered selected row
and faded neighboring values, echoing Samsung's familiar time-wheel pattern.
The user may scroll or tap either wheel, then taps Done to emit a zero-padded
`HH:MM` string. Cancel, backdrop dismissal, Escape, and Android back discard
the staged value.

The component must use a new, reusable `BaseDialog` in
`src/shared/components`, rather than bending the bottom sheet into a centered
dialog. `BaseDialog` owns only modal mechanics: Teleport, scrim, focus trap,
focus restoration, Escape handling, and registration with the Android back
priority system. It has `open`, `title`, and `close` API parity with
`BaseBottomSheet`; layout and actions remain slots.

Its public interface is:

```ts
defineProps<{
  modelValue: string;
  label: string;
  stepMinutes: number;
  disabled?: boolean;
}>();

defineEmits<{
  'update:modelValue': [value: string];
}>();
```

The picker accepts only valid `HH:MM` values. If a malformed persisted value is
encountered, it initializes the staged picker to `09:00` without overwriting
the stored value until Done is selected.

## Page integration and data flow

`SettingsPage.vue` remains the owner of reminder persistence.

1. It maps `reminderDayOptions` to localized labels as it does today.
2. It passes the weekly-meeting reminder day and time to the new components
   using `v-model`.
3. Component updates call the existing
   `remindersStore.updateWeeklyMeetingReminder({ day })` and
   `remindersStore.updateWeeklyMeetingReminder({ time })` actions through
   small typed handlers.
4. The store continues to schedule reminders and report status exactly as it
   does today; the UI components never call notification APIs.

The controls reuse the existing translated `settings.day`, `settings.time`,
`common.cancel`, and `common.done` copy. Add translated `settings.hours` and
`settings.minutes` labels for the time-picker grids in every supported locale.

## Interaction, accessibility, and visual rules

- The existing form label remains above each trigger; the trigger is a semantic
  `button`, exposes that label to assistive technology, and is at least 48px
  high.
- The day picker uses short rows, a selected check indicator, and a visible
  sheet title.
- The time dialog is visually compact, not full-screen, with a clearly
  labelled preview and explicit Cancel and Done actions.
- Both modal primitives trap focus and restore focus to their trigger after
  closing.
- Android Back closes the currently open sheet or dialog before any router
  navigation, consistent with the app-wide back priority.
- Disabled state prevents opening and communicates the unavailable state
  through the native button semantics.
- All styling uses existing tokens and calm, neutral language; no Material or
  browser UI package is introduced.

## Error handling

No asynchronous work is added. Invalid incoming time values never throw or
appear in the controls as broken data; the picker uses `09:00` as its temporary
selection and only writes a valid value after Done. Closing either overlay has
no persistence side effect.

## Tests and verification

- Unit-test `BaseDialog` for focus restoration, scrim/close handling, and
  Android-back registration behavior matching the existing bottom sheet.
- Unit-test the day picker to ensure it emits the selected value, closes, and
  emits nothing on dismissal.
- Unit-test the time picker for parsing, five-minute choices, zero-padded
  output, staged Cancel behavior, and fallback from malformed input.
- Update the Settings page test to assert that the weekly reminder uses the new
  controls and persists emitted day/time values through the existing store
  actions.
- Run `npm run build`, `npm run check`, and the focused Vitest suite.
- Manually test on a real Android device: open/close, backdrop, Android back,
  keyboard focus, 24-hour selection, saving, app restart, and actual reminder
  scheduling. Compare the two patterns before expanding the migration.
