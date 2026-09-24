# Calendar Weekly Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let connected Premium users choose the weekday and local time for their recurring Google Calendar weekly-meeting reminder.

**Architecture:** Keep the existing `PUT /calendar/google/settings` contract and Calendar Sync Pinia store unchanged. `CalendarSyncPage.vue` will render native weekday and time controls from server-backed preferences and send the three required schedule values whenever either control changes. New localization keys in the existing message object supply every visible schedule label in English, Ukrainian, and Spanish.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, vue-i18n, Vitest, Vue Test Utils, happy-dom.

## Global Constraints

- The backend accepts a schedule update only when `weeklyMeetingDay`, `weeklyMeetingTime`, and `timeZone` are supplied together.
- Preserve the stable API weekday values: `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`, and `sunday`.
- Use native `<select>` and `<input type="time">` controls; do not add a dependency.
- Write every new calendar schedule string in `en`, `uk`, and `es`; do not rely on English fallback text.
- Keep the schedule controls disabled until Google Calendar is connected.
- Do not change API, database, OAuth, or Google Calendar provider code.
- Do not stage or commit changes without explicit user approval.

---

## File Structure

| File                                                                   | Responsibility                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/pages/CalendarSyncPage.vue`                                       | Render and save the weekly weekday/time choices using the existing calendar store action. |
| `src/features/localization/messages.ts`                                | Provide the schedule control and weekday display strings for every supported locale.      |
| `src/pages/__tests__/CalendarSyncPage.test.ts`                         | Verify disabled-state and schedule-save payload behavior against a mocked calendar store. |
| `src/features/localization/__tests__/calendarScheduleMessages.test.ts` | Verify every supported locale defines the new schedule labels and all weekday labels.     |

### Task 1: Add localized schedule labels

**Files:**

- Modify: `src/features/localization/messages.ts:411-460,1879-1930,3383-3435`
- Create: `src/features/localization/__tests__/calendarScheduleMessages.test.ts`

**Interfaces:**

- Consumes: `messages` and `SupportedLocale` from `src/features/localization/messages.ts` and `src/features/localization/types.ts`.
- Produces: `calendar.schedule.day`, `calendar.schedule.time`, and `calendar.schedule.weekdays.<weekday>` translation keys for all supported locales.

- [ ] **Step 1: Write failing localization-contract test**

Create `src/features/localization/__tests__/calendarScheduleMessages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { messages } from '../messages';

const weekdays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

describe('calendar schedule translations', () => {
  it.each(['en', 'uk', 'es'] as const)(
    'defines complete schedule labels for %s',
    (locale) => {
      const schedule = messages[locale].calendar.schedule;

      expect(schedule.day.length).toBeGreaterThan(0);
      expect(schedule.time.length).toBeGreaterThan(0);
      weekdays.forEach((weekday) => {
        expect(schedule.weekdays[weekday].length).toBeGreaterThan(0);
      });
    }
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/features/localization/__tests__/calendarScheduleMessages.test.ts`

Expected: FAIL because `calendar.schedule` is absent.

- [ ] **Step 3: Add the message keys in all locales**

Add this shape inside each locale’s `calendar` object. Use the locale-specific text below.

```ts
schedule: {
  day: 'Day',
  time: 'Time',
  weekdays: {
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    sunday: 'Sunday',
  },
},
```

Use these Ukrainian values: `День`, `Час`, `Понеділок`, `Вівторок`, `Середа`, `Четвер`, `П’ятниця`, `Субота`, `Неділя`.

Use these Spanish values: `Día`, `Hora`, `Lunes`, `Martes`, `Miércoles`, `Jueves`, `Viernes`, `Sábado`, `Domingo`.

- [ ] **Step 4: Run the localization-contract test**

Run: `npm test -- src/features/localization/__tests__/calendarScheduleMessages.test.ts`

Expected: PASS.

### Task 2: Render and save the weekly schedule

**Files:**

- Modify: `src/pages/CalendarSyncPage.vue:1-170`
- Test: `src/pages/__tests__/CalendarSyncPage.test.ts`

**Interfaces:**

- Consumes: `calendarSyncStore.connectionStatus.preferences`, `calendarSyncStore.isConnected`, and `calendarSyncStore.updateSettings(payload)`.
- Produces: `UpdateCalendarPreferences` calls of `{ weeklyMeetingDay, weeklyMeetingTime, timeZone }` from each schedule-control change.

- [ ] **Step 1: Write failing Calendar Sync page tests**

Create a happy-dom page test that mocks `vue-i18n`, `vue-router`, `useToast`, `PremiumLock`, `ConfirmationDialog`, and `useCalendarSyncStore`. Give the mock store a connected status with:

```ts
preferences: {
  weeklyMeetingSyncEnabled: true,
  assignedTaskSyncEnabled: false,
  weeklyMeetingDay: 'sunday',
  weeklyMeetingTime: '18:00',
  timeZone: 'UTC',
}
```

Add these tests:

```ts
it('disables weekday and time controls before Google Calendar is connected', () => {
  state.isConnected = false;
  const wrapper = mountCalendarSyncPage();

  expect(
    wrapper.get('[data-testid="calendar-weekday"]').attributes('disabled')
  ).toBeDefined();
  expect(
    wrapper.get('[data-testid="calendar-time"]').attributes('disabled')
  ).toBeDefined();
});

it('saves a weekday change with the stored time and device time zone', async () => {
  const wrapper = mountCalendarSyncPage();

  await wrapper.get('[data-testid="calendar-weekday"]').setValue('wednesday');

  expect(state.updateSettings).toHaveBeenCalledWith({
    weeklyMeetingDay: 'wednesday',
    weeklyMeetingTime: '18:00',
    timeZone: 'Europe/Warsaw',
  });
});

it('saves a time change with the stored weekday and device time zone', async () => {
  const wrapper = mountCalendarSyncPage();

  await wrapper.get('[data-testid="calendar-time"]').setValue('19:30');

  expect(state.updateSettings).toHaveBeenCalledWith({
    weeklyMeetingDay: 'sunday',
    weeklyMeetingTime: '19:30',
    timeZone: 'Europe/Warsaw',
  });
});
```

Stub `Intl.DateTimeFormat` in the test setup so `resolvedOptions()` returns `{ timeZone: 'Europe/Warsaw' }`, and restore the original implementation after each test.

- [ ] **Step 2: Run the page test to verify it fails**

Run: `npm test -- src/pages/__tests__/CalendarSyncPage.test.ts`

Expected: FAIL because the schedule controls and save handlers do not exist.

- [ ] **Step 3: Add schedule options and a complete-schedule saver**

In `CalendarSyncPage.vue`, define the ordered weekday values and a computed display list that calls `t('calendar.schedule.weekdays.<weekday>')`. Add a `resolvedTimeZone()` helper using `Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'`.

Add one handler per control. Each derives the other field from the current server-backed preferences and supplies the required complete payload:

```ts
function updateWeeklyMeetingSchedule(input: {
  weeklyMeetingDay?: CalendarWeekday;
  weeklyMeetingTime?: string;
}) {
  const preferences = calendarSyncStore.connectionStatus?.preferences;

  void calendarSyncStore.updateSettings({
    weeklyMeetingDay:
      input.weeklyMeetingDay ?? preferences?.weeklyMeetingDay ?? 'sunday',
    weeklyMeetingTime:
      input.weeklyMeetingTime ?? preferences?.weeklyMeetingTime ?? '18:00',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
  });
}
```

Use the existing `CalendarWeekday` type from `@/features/calendar/types` for the weekday handler input rather than a duplicate union.

- [ ] **Step 4: Add labelled native controls under the weekly-meeting option**

Within the weekly-meeting option card, render a schedule field group after the option description:

```vue
<div class="calendar-weekly-schedule">
  <label>
    <span>{{ t('calendar.schedule.day') }}</span>
    <select
      data-testid="calendar-weekday"
      :value="calendarSyncStore.connectionStatus?.preferences.weeklyMeetingDay ?? 'sunday'"
      :disabled="!calendarSyncStore.isConnected"
      @change="updateWeeklyMeetingSchedule({ weeklyMeetingDay: ($event.target as HTMLSelectElement).value as CalendarWeekday })"
    >
      <option v-for="weekday in weekdayOptions" :key="weekday.value" :value="weekday.value">
        {{ weekday.label }}
      </option>
    </select>
  </label>
  <label>
    <span>{{ t('calendar.schedule.time') }}</span>
    <input
      data-testid="calendar-time"
      type="time"
      :value="calendarSyncStore.connectionStatus?.preferences.weeklyMeetingTime ?? '18:00'"
      :disabled="!calendarSyncStore.isConnected"
      @change="updateWeeklyMeetingSchedule({ weeklyMeetingTime: ($event.target as HTMLInputElement).value })"
    />
  </label>
</div>
```

Apply focused styling in the existing Calendar Sync page style block so the two inputs are readable and stacked on narrow Android screens. Preserve the project’s existing form-control colors, border radius, font inheritance, and focus style; do not reformat unrelated styles.

- [ ] **Step 5: Run the page test to verify it passes**

Run: `npm test -- src/pages/__tests__/CalendarSyncPage.test.ts`

Expected: PASS.

### Task 3: Run regression checks

**Files:**

- Verify: `src/pages/CalendarSyncPage.vue`
- Verify: `src/features/localization/messages.ts`
- Verify: `src/pages/__tests__/CalendarSyncPage.test.ts`
- Verify: `src/features/localization/__tests__/calendarScheduleMessages.test.ts`

**Interfaces:**

- Consumes: the completed UI and translation tasks.
- Produces: verified TypeScript, localized page behavior, and production build output.

- [ ] **Step 1: Run focused tests together**

Run: `npm test -- src/pages/__tests__/CalendarSyncPage.test.ts src/features/localization/__tests__/calendarScheduleMessages.test.ts`

Expected: PASS.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run the production-safe build check**

Run: `npm run build`

Expected: PASS with Vue type checking and Vite build completion.

- [ ] **Step 4: Review the final diff**

Run: `git -c safe.directory=D:/Projects/myself/weekly-us -C D:/Projects/myself/weekly-us diff --check` and `git -c safe.directory=D:/Projects/myself/weekly-us -C D:/Projects/myself/weekly-us diff -- src/pages/CalendarSyncPage.vue src/features/localization/messages.ts src/pages/__tests__/CalendarSyncPage.test.ts src/features/localization/__tests__/calendarScheduleMessages.test.ts`

Expected: no whitespace errors; the diff contains only the schedule UI, translations, and focused tests.

## Self-Review

- **Spec coverage:** Task 1 implements explicit English/Ukrainian/Spanish strings; Task 2 implements native accessible weekday/time controls, immediate complete-payload saves, device timezone handling, connected-state disablement, and single-event update through the existing API; Task 3 verifies the behavior and build. No backend/database/OAuth work is planned.
- **Placeholder scan:** no unresolved placeholders or deferred requirements remain.
- **Type consistency:** the page uses the existing `CalendarWeekday` and `UpdateCalendarPreferences` contract; both handlers always provide the required day, time, and time zone fields.
