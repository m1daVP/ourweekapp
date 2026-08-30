# Calendar Weekly Schedule Design

## Goal

Let a connected Premium user choose the weekday and local time for their personal recurring Google Calendar weekly-meeting reminder.

## Scope

This change adds schedule controls to the existing Calendar Sync page in the mobile app. It uses the existing calendar preferences contract and does not require a backend, database, or OAuth change.

## User Experience

The “Add weekly meeting reminder to calendar” option gains two controls immediately below it:

- **Day:** a native select control containing Monday through Sunday.
- **Time:** a native time input.

The controls are visible with the existing calendar options and are disabled until the user has connected Google Calendar. The controls remain available when the weekly-meeting reminder toggle is off, allowing the user to prepare their preferred schedule before enabling sync.

When a user changes the weekday or time, the app immediately saves the complete schedule. It sends the selected weekday, selected time, and the device’s resolved IANA time zone. If the weekly-meeting reminder is enabled, the existing server-side calendar sync updates the single `OurWeek weekly meeting` event and its weekly recurrence rather than creating a second event.

The app keeps the existing error-message and status-message behavior: failed saves show the existing error surface, and a successful save refreshes the server-backed preferences shown on the page.

## Data Flow

`CalendarSyncPage.vue` reads the current `weeklyMeetingDay`, `weeklyMeetingTime`, and `timeZone` from `calendarSyncStore.connectionStatus.preferences`.

On a schedule change it calls the existing `calendarSyncStore.updateSettings` action with:

```ts
{
  weeklyMeetingDay: selectedDay,
  weeklyMeetingTime: selectedTime,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
}
```

The existing `PUT /v1/calendar/google/settings` contract requires the day, time, and time zone together when any schedule field changes. The API already persists those fields and, if the weekly reminder is enabled, upserts the Google event with the corresponding weekly recurrence.

## Localization

All new interface text is defined explicitly in every supported locale:

- English (`en`)
- Ukrainian (`uk`)
- Spanish (`es`)

The calendar message structure receives labels for **Day** and **Time**, and a weekday-label group for every selectable weekday. The dropdown stores the existing stable values (`monday` through `sunday`) and displays these locale-specific labels. No newly displayed calendar-schedule text may rely on the English fallback locale.

## Accessibility and Mobile Behavior

The controls use native `<select>` and `<input type="time">` elements with visible labels. Native Android controls provide platform-appropriate touch targets and accessibility semantics. Disabled controls are not interactive until Google Calendar is connected.

## Testing

Add focused coverage for the schedule-save payload and localization contract:

- changing the weekday sends the new weekday together with the currently selected time and resolved time zone;
- changing the time sends the new time together with the currently selected weekday and resolved time zone;
- the schedule controls are disabled without a Google Calendar connection;
- each supported locale provides the new day, time, and seven weekday-label keys.

Existing API and backend calendar tests remain authoritative for request validation and Google recurrence updates; no API contract change is planned.

## Non-Goals

- Multiple weekly meeting days
- Arbitrary one-off meeting dates
- A manual save button or a separate scheduling dialog
- A time-zone picker
- Backend/database/OAuth changes
