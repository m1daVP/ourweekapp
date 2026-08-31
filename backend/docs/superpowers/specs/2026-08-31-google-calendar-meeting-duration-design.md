# Google Calendar Meeting Duration Design

## Goal

Make the personal recurring `OurWeek weekly meeting` Google Calendar event last exactly 15 minutes, matching the product’s “15-minute weekly meetup” positioning.

## Problem

The server currently sends a local, offset-free start such as `2026-08-31T12:25:00` together with `Europe/Warsaw`, but creates the end by parsing that value in the server’s time zone and serializing it as UTC (`2026-08-31T13:25:00.000Z`). Google interprets the start as 12:25 in Warsaw and the end as 15:25 in Warsaw during summer time, displaying a three-hour event.

## Design

For a local, offset-free date-time paired with an IANA `timeZone`, the Google Calendar provider will construct the end as a **local wall-clock** date-time. The weekly meeting’s `start.dateTime` and `end.dateTime` will both be offset-free `YYYY-MM-DDTHH:mm:ss` values and both will use the same `timeZone` field.

For example:

```ts
start: { dateTime: '2026-08-31T12:25:00', timeZone: 'Europe/Warsaw' }
end: { dateTime: '2026-08-31T12:40:00', timeZone: 'Europe/Warsaw' }
```

The weekly-meeting service will pass `durationMinutes: 15` for its personal recurring event. Other timed calendar events retain their current one-hour duration through a provider default. The helper that adds minutes will retain the offset-free format and correctly carry into the following local day when needed. Google Calendar remains responsible for interpreting local daylight-saving transitions from the supplied IANA time-zone identifier. Timed events that already carry a `Z` or numeric UTC offset retain their absolute-timestamp representation and have their end calculated as elapsed time, preserving their current behavior.

All-day task and follow-up events are unchanged.

## Existing Events

The existing event mapping ensures a future sync calls Google Calendar’s update operation for the same provider event ID. No duplicate is created.

There is no background rewrite of users’ Google Calendar events. Existing events receive the correct 15-minute duration the next time the weekly reminder syncs, including after a weekly schedule change, toggling the weekly reminder, or another explicit weekly sync.

## Testing

Add provider-level tests that mock `google.calendar(...).events.insert` and assert:

- a weekly-meeting input with `durationMinutes: 15` and a Warsaw local start at `12:25` creates a local end at `12:40`, with no `Z` offset;
- the same date-time values and IANA time zone are supplied to Google for start and end;
- an end crossing midnight carries to the next date;
- a timed event without a duration retains its one-hour duration while using the corrected local-time format;
- a timestamped event with a `Z` offset retains an offset timestamp and an elapsed one-hour duration;
- updating an existing provider event uses the identical corrected request body.

Retain coverage that untimed events remain all-day events.

## Non-Goals

- User-selectable meeting duration
- Changes to the calendar API contract, database schema, OAuth configuration, or mobile app UI
- Retrospectively rewriting every event without a user-triggered sync
