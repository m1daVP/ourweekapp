# Native control migration design

## Goal

Replace every remaining HTML select, date, and time control with consistent,
touch-friendly OurWeek controls, so Android system dialogs no longer interrupt
the app's visual language.

## Scope

The migration includes every remaining native control in these flows:

- the unfinished-task reminder's day and time in Settings;
- weekly meeting schedule day and time in Calendar sync;
- task responsibility and optional due date in both task editor sheets;
- task responsibility, optional due date, and note author in the meeting flow;
- note author in the meeting-note editor;
- related meeting in Private notes; and
- participant type in household-member editing.

Text fields, checkboxes, radio controls, and any future controls outside this
list remain native. This change must not alter persistence shapes, store
actions, feature locks, or scheduling behavior.

## Architecture

Promote the successful reminder-trial controls into reusable shared components
under `src/shared/components`:

### `SelectPickerField`

Replaces `ReminderDayPickerField`. It accepts a string `modelValue`, a visible
external-field `label` for its sheet title and accessible name, an array of
`{ value, label, disabled? }` options, and a `disabled` flag. It renders only
the selected value inside an input-like button; page-owned `<label>` elements
remain above it. Activating the button opens `BaseBottomSheet` with large option
rows. Selecting an enabled row emits the value and closes; close, backdrop,
Escape, and Android Back emit nothing.

### `TimePickerField`

Promote `ReminderTimePickerDialog` unchanged in behavior: it accepts a valid
or malformed `HH:MM` string, a minute step, and a disabled flag. It uses two
scroll-snap wheels with a centered selected row, faded neighbors, tap support,
and staged Cancel/Done behavior in `BaseDialog`. The value reaches the parent
only after Done.

### `DatePickerField`

Create a reusable centered-dialog calendar for ISO `YYYY-MM-DD` values. It
keeps all state locally until Done and supports an empty value for optional due
dates. The trigger displays the localized selected date or a translated
“No date” value. The dialog contains month navigation, weekday headers, a
touch-friendly calendar grid, Clear, Cancel, and Done actions.

Calendar computations use date-only ISO parsing and formatting, never local
date-string parsing, to avoid timezone shifts. Selecting a day stages a
zero-padded ISO date; Clear stages `''`; only Done emits either result.

## Page and feature migration

Each consumer preserves its current typed state and calls the same handler or
store action after a picker emits.

- `SettingsPage.vue`: migrate the unfinished-task reminder to shared select
  and time fields. Keep the weekly-meeting reminder on the same promoted
  components.
- `CalendarSyncPage.vue`: map weekly day options into `SelectPickerField` and
  pass the existing schedule-time update handler to `TimePickerField`.
- `TasksPage.vue`: map responsibility choices into select options in add and
  edit sheets; use date fields for their optional due dates. Keep disabled
  editing behavior intact.
- `MeetingSectionStep.vue` and `MeetingPage.vue`: map participant choices to
  select options and route emitted values through the existing typed emits.
- `PrivateNotesPage.vue`: map the no-meeting and meeting-label choices to the
  shared select field.
- `HouseholdMembersSettings.vue`: map participant-type choices to the shared
  select field.

## Interaction and accessibility

- Existing form labels stay visibly above controls throughout the migration.
- Triggers are semantic buttons, have matching accessible names, retain 48px+
  targets, and correctly expose disabled state.
- Select options use selected-state semantics and disabled options cannot emit.
- Calendar cells use semantic buttons, communicate the selected date without
  relying on color, and the user can navigate months with labelled controls.
- All dialogs/sheets preserve the existing focus, scrim, Escape, and Android
  Back behavior supplied by `BaseBottomSheet` / `BaseDialog`.

## Localization

Reuse field labels and common Cancel/Done copy. Add `common.clear` and
`common.noDate` in English, Ukrainian, and Spanish. Add date-picker month
navigation labels and weekday labels only if the existing catalog cannot
express them clearly.

## Tests and verification

- Replace the reminder-specific day and time component tests with shared
  component tests covering selection, dismissal, disabled behavior, scrolling,
  malformed times, and staged cancellation.
- Add date-picker tests for ISO parsing, month navigation, selection, Clear,
  Cancel, and zero-padded output.
- Update each affected page/component test to check values are passed through
  the existing handlers and that native select/date/time controls are absent.
- Run `npm run build`, focused test suites, changed-file lint/format checks,
  and `npm run cap:sync`.
- Manually verify all migrated screens on a real Android device, including
  small-screen layout, Android Back, disabled states, optional-date clearing,
  and persisted reminder/calendar settings after restart.
