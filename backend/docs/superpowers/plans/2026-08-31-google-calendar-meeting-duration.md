# Google Calendar Meeting Duration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the recurring `OurWeek weekly meeting` Google Calendar event exactly 15 minutes long without changing the duration of other timed calendar events.

**Architecture:** Extend the internal `GoogleCalendarEventInput` with an optional `durationMinutes` field. The weekly-meeting service supplies `15`; the provider defaults other timed events to 60 minutes. The provider preserves local wall-clock strings when they are paired with an IANA time zone, preventing Google from combining a local start with a UTC end; offset-bearing timestamps retain elapsed-time arithmetic.

**Tech Stack:** Node.js, TypeScript, Fastify, googleapis, Vitest.

## Global Constraints

- `OurWeek weekly meeting` duration is exactly 15 minutes.
- Other timed events retain a 60-minute default duration.
- Local `YYYY-MM-DDTHH:mm:ss` values with an IANA `timeZone` must remain local for both start and end.
- Offset-bearing values (`Z` or `+/-HH:mm`) retain absolute elapsed-time semantics.
- All-day task and follow-up events remain unchanged.
- Do not alter public API DTOs, database migrations, OAuth configuration, or mobile app code.
- Do not stage or commit changes without explicit user approval.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/modules/calendar/google-oauth.client.ts` | Defines the duration input and serializes correct Google Calendar timed-event start/end values. |
| `src/modules/calendar/calendar.service.ts` | Marks only the recurring weekly-meeting event as 15 minutes. |
| `tests/google-calendar.client.test.ts` | Mocks Google Calendar requests and locks the provider’s time-zone and duration behavior. |

### Task 1: Lock the Google Calendar provider behavior with tests

**Files:**
- Create: `tests/google-calendar.client.test.ts`
- Modify: `src/modules/calendar/google-oauth.client.ts:19-145`

**Interfaces:**
- Consumes: `googleCalendarProvider.upsertEvent({ tokens, providerEventId?, event })`.
- Produces: assertions against `calendar.events.insert` and `calendar.events.update` request bodies.

- [ ] **Step 1: Create a Google API mock and failing provider tests**

Create `tests/google-calendar.client.test.ts`. Hoist `insert`, `update`, `setCredentials`, and `calendar` spies, then mock `googleapis` before dynamically importing the provider:

```ts
const insert = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const setCredentials = vi.hoisted(() => vi.fn());

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn(function OAuth2() {
        return { setCredentials };
      }),
    },
    calendar: vi.fn(() => ({ events: { insert, update } })),
  },
}));
```

In `beforeAll`, populate the required environment variables and dynamically import `googleCalendarProvider`. Before each test, reset the spies and make both Google event calls resolve to `{ data: { id: 'google-event-1' } }`.

Add these failing tests:

```ts
it('creates a 15-minute weekly meeting in the supplied local time zone', async () => {
  await googleCalendarProvider.upsertEvent({
    tokens: { accessToken: 'access', refreshToken: 'refresh', expiresAt: null },
    event: {
      title: 'OurWeek weekly meeting',
      dateTime: '2026-08-31T12:25:00',
      timeZone: 'Europe/Warsaw',
      durationMinutes: 15,
      recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
    },
  });

  expect(insert).toHaveBeenCalledWith(expect.objectContaining({
    requestBody: expect.objectContaining({
      start: { dateTime: '2026-08-31T12:25:00', timeZone: 'Europe/Warsaw' },
      end: { dateTime: '2026-08-31T12:40:00', timeZone: 'Europe/Warsaw' },
    }),
  }));
});

it('carries a local 15-minute end into the following day', async () => {
  await googleCalendarProvider.upsertEvent({
    tokens: { accessToken: 'access', refreshToken: 'refresh', expiresAt: null },
    event: {
      title: 'OurWeek weekly meeting',
      dateTime: '2026-08-31T23:55:00',
      timeZone: 'Europe/Warsaw',
      durationMinutes: 15,
    },
  });

  expect(insert.mock.calls[0][0].requestBody.end).toEqual({
    dateTime: '2026-09-01T00:10:00',
    timeZone: 'Europe/Warsaw',
  });
});

it('keeps the one-hour default for local timed events', async () => {
  await googleCalendarProvider.upsertEvent({
    tokens: { accessToken: 'access', refreshToken: 'refresh', expiresAt: null },
    event: {
      title: 'Meeting reminder',
      dateTime: '2026-08-31T12:25:00',
      timeZone: 'Europe/Warsaw',
    },
  });

  expect(insert.mock.calls[0][0].requestBody.end).toEqual({
    dateTime: '2026-08-31T13:25:00',
    timeZone: 'Europe/Warsaw',
  });
});

it('keeps elapsed-time arithmetic for offset-bearing timestamps', async () => {
  await googleCalendarProvider.upsertEvent({
    tokens: { accessToken: 'access', refreshToken: 'refresh', expiresAt: null },
    event: {
      title: 'Meeting reminder',
      dateTime: '2026-08-31T12:25:00.000Z',
    },
  });

  expect(insert.mock.calls[0][0].requestBody.end).toEqual({
    dateTime: '2026-08-31T13:25:00.000Z',
    timeZone: undefined,
  });
});

it('updates an existing event with the corrected request body', async () => {
  await googleCalendarProvider.upsertEvent({
    tokens: { accessToken: 'access', refreshToken: 'refresh', expiresAt: null },
    providerEventId: 'google-event-existing',
    event: {
      title: 'OurWeek weekly meeting',
      dateTime: '2026-08-31T12:25:00',
      timeZone: 'Europe/Warsaw',
      durationMinutes: 15,
    },
  });

  expect(insert).not.toHaveBeenCalled();
  expect(update).toHaveBeenCalledWith(expect.objectContaining({
    eventId: 'google-event-existing',
    requestBody: expect.objectContaining({
      end: { dateTime: '2026-08-31T12:40:00', timeZone: 'Europe/Warsaw' },
    }),
  }));
});
```

Add a final all-day regression test with `{ title: 'Task', date: '2026-08-31' }` and expect `{ start: { date: '2026-08-31' }, end: { date: '2026-09-01' } }`.

- [ ] **Step 2: Run the provider test to verify it fails**

Run: `npm test -- google-calendar.client.test.ts`

Expected: FAIL because `durationMinutes` does not exist and local input currently produces a UTC end.

### Task 2: Implement duration-aware, time-zone-safe event serialization

**Files:**
- Modify: `src/modules/calendar/google-oauth.client.ts:15-90`
- Modify: `src/modules/calendar/calendar.service.ts:419-429`
- Test: `tests/google-calendar.client.test.ts`

**Interfaces:**
- Consumes: `GoogleCalendarEventInput` from the calendar service.
- Produces: a Google Calendar event body with matching local start/end values or offset-preserving absolute timestamps.

- [ ] **Step 1: Extend the internal event input**

Add the optional field to `GoogleCalendarEventInput`:

```ts
durationMinutes?: number;
```

Add named constants in `google-oauth.client.ts`:

```ts
const DEFAULT_TIMED_EVENT_DURATION_MINUTES = 60;
const OFFSET_BEARING_DATE_TIME = /(Z|[+-]\d{2}:\d{2})$/i;
```

- [ ] **Step 2: Add local and offset-aware minute helpers**

Replace `addHours` with `addMinutes(value, minutes)`. For values matching `OFFSET_BEARING_DATE_TIME`, return:

```ts
new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString();
```

For local date-times, parse only the calendar fields with:

```ts
const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
```

Reject a non-matching internal input by throwing `Error('Invalid local calendar date-time.')`. Construct the local arithmetic date with `Date.UTC(year, month - 1, day, hour, minute, second)`; add minutes; then build a zero-padded `YYYY-MM-DDTHH:mm:ss` string from its UTC getters. This deliberately uses UTC only as a calendar-field arithmetic container and never serializes `Z` for local input.

- [ ] **Step 3: Use the event-specific or default duration**

In `toGoogleEvent`, replace the hard-coded one-hour end with:

```ts
const durationMinutes =
  event.durationMinutes ?? DEFAULT_TIMED_EVENT_DURATION_MINUTES;

end: {
  dateTime: addMinutes(event.dateTime, durationMinutes),
  timeZone: event.timeZone,
},
```

Retain the existing recurrence spread and the all-day event branch exactly as-is.

- [ ] **Step 4: Mark only weekly meetings as 15 minutes**

In `CalendarService.syncWeeklyMeetingForUser`, add the internal duration value next to `dateTime` and `timeZone`:

```ts
durationMinutes: 15,
```

Do not add this field to `syncMeetingReminder`, task, or follow-up event inputs.

- [ ] **Step 5: Run the provider test to verify it passes**

Run: `npm test -- google-calendar.client.test.ts`

Expected: PASS. The weekly end is `12:40` local time; default and all-day cases retain their specified behavior.

### Task 3: Verify calendar regressions and build

**Files:**
- Verify: `src/modules/calendar/google-oauth.client.ts`
- Verify: `src/modules/calendar/calendar.service.ts`
- Verify: `tests/google-calendar.client.test.ts`

**Interfaces:**
- Consumes: the completed provider serializer and weekly-meeting duration input.
- Produces: a type-safe API build and complete calendar test coverage.

- [ ] **Step 1: Run calendar-focused tests**

Run: `npm test -- calendar.service.test.ts calendar.repository.test.ts google-calendar.client.test.ts`

Expected: PASS.

- [ ] **Step 2: Run type checking and full tests**

Run: `npm run typecheck && npm test`

Expected: PASS.

- [ ] **Step 3: Run the deployment build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Inspect the final change set**

Run: `git -c safe.directory=D:/Projects/myself/weekly-us-api -C D:/Projects/myself/weekly-us-api diff --check` and `git -c safe.directory=D:/Projects/myself/weekly-us-api -C D:/Projects/myself/weekly-us-api diff -- src/modules/calendar/google-oauth.client.ts src/modules/calendar/calendar.service.ts tests/google-calendar.client.test.ts`

Expected: no whitespace errors; no files beyond the provider, service, and provider test are required for runtime behavior.

## Self-Review

- **Spec coverage:** Task 1 proves the 15-minute weekly event, local-time serialization, midnight rollover, default one-hour timed behavior, offset timestamp behavior, update path, and all-day regression. Task 2 supplies the duration only for weekly events and preserves all other paths. Task 3 runs calendar-focused and project-wide verification.
- **Placeholder scan:** no unresolved placeholders or deferred requirements remain.
- **Type consistency:** `durationMinutes` is internal to `GoogleCalendarEventInput`; `CalendarService.syncWeeklyMeetingForUser` supplies it and `toGoogleEvent` consumes it with a 60-minute default.
