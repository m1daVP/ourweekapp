# Google Calendar Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete only OurWeek-mapped Google Calendar events when a user disables the related sync option or disconnects Google Calendar.

**Architecture:** Add explicit mapping-list and mapping-delete-by-source-type repository methods, plus a provider delete operation that treats Google 404 responses as successful cleanup. The calendar service deletes every relevant remote event before persisting a disabled setting or clearing credentials. Mobile copy explains the deletion behavior in English, Ukrainian, and Spanish without changing API requests.

**Tech Stack:** Node.js, Fastify, TypeScript, Supabase, googleapis, Vue 3, vue-i18n, Vitest.

## Global Constraints

- Only events in `calendar_events` mapped to the authenticated workspace and user may be deleted.
- Disabling weekly sync deletes `weekly_meeting` mappings only.
- Disabling assigned-task sync deletes `task_due_date` mappings only.
- Disconnecting deletes all mapped source types before revoking the Google token.
- A Google 404 means the desired remote state has already been reached.
- Any other deletion failure preserves enabled settings, connection tokens, and event mappings for retry.
- Do not change database schema or public API DTOs.
- Add all user-facing copy in English, Ukrainian, and Spanish.
- Do not stage or commit changes without explicit user approval.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/modules/calendar/calendar.repository.ts` | Safely list and delete this user’s mappings for explicit source types. |
| `src/modules/calendar/google-oauth.client.ts` | Delete one known event ID from the connected user’s primary Google calendar. |
| `src/modules/calendar/calendar.service.ts` | Orchestrate remote-first deletion for settings changes and disconnect. |
| `tests/calendar.repository.test.ts` | Prove repository source-type and ownership query filters. |
| `tests/google-calendar.client.test.ts` | Prove Google delete calls and 404 handling. |
| `tests/calendar.service.test.ts` | Prove cleanup order, scope, failure preservation, and retry-safe behavior. |
| `D:/Projects/myself/weekly-us/src/features/localization/messages.ts` | Explain event removal in the Calendar Sync UI. |
| `D:/Projects/myself/weekly-us/src/features/localization/__tests__/calendarScheduleMessages.test.ts` | Verify the cleanup messages are present in all supported locales. |

### Task 1: Add scoped mapping access and Google deletion

**Files:**
- Modify: `src/modules/calendar/calendar.repository.ts:104-110,286-333`
- Modify: `src/modules/calendar/google-oauth.client.ts:25-38,151-180`
- Modify: `tests/calendar.repository.test.ts`
- Modify: `tests/google-calendar.client.test.ts`

**Interfaces:**
- Consumes: `CalendarSourceType`, `{ workspaceId, userId, sourceTypes }`, and Google credentials plus a mapped `providerEventId`.
- Produces: `listEventsForUserBySourceTypes(...)`, `clearEventMappingsForUserBySourceTypes(...)`, and `googleCalendarProvider.deleteEvent(...)`.

- [ ] **Step 1: Write failing repository and provider tests**

Add a repository test that invokes:

```ts
await repository.listEventsForUserBySourceTypes(
  'workspace-1',
  'user-1',
  ['weekly_meeting', 'task_due_date'],
);
```

Assert the Supabase query selects `EVENT_COLUMNS` and contains `eq('workspace_id', 'workspace-1')`, `eq('user_id', 'user-1')`, `eq('provider', 'google')`, and `in('source_type', ['weekly_meeting', 'task_due_date'])`.

Add a matching delete test for `clearEventMappingsForUserBySourceTypes` that asserts the same ownership, provider, and source-type filters.

In `tests/google-calendar.client.test.ts`, add:

```ts
it('deletes a mapped event from the connected user primary calendar', async () => {
  const { googleCalendarProvider } = await loadGoogleCalendarProvider();

  await googleCalendarProvider.deleteEvent({
    tokens,
    providerEventId: 'google-event-1',
  });

  expect(remove).toHaveBeenCalledWith({
    calendarId: 'primary',
    eventId: 'google-event-1',
  });
});

it('treats a Google 404 event deletion as successful cleanup', async () => {
  remove.mockRejectedValueOnce({ code: 404 });
  const { googleCalendarProvider } = await loadGoogleCalendarProvider();

  await expect(googleCalendarProvider.deleteEvent({
    tokens,
    providerEventId: 'already-gone',
  })).resolves.toBeUndefined();
});
```

The Google mock’s `events` object must expose a hoisted `remove` spy in addition to `insert` and `update`.

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm test -- calendar.repository.test.ts google-calendar.client.test.ts`

Expected: FAIL because the repository methods, provider method, and `events.delete` wiring do not exist.

- [ ] **Step 3: Add narrow repository methods**

Add these `CalendarRepository` methods and include them in the service repository port:

```ts
async listEventsForUserBySourceTypes(
  workspaceId: string,
  userId: string,
  sourceTypes: CalendarSourceType[],
) {
  const { data, error } = await this.supabase
    .from('calendar_events')
    .select(EVENT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'google')
    .in('source_type', sourceTypes);

  throwOnSupabaseError(error, 'calendar_event_list_failed', 'Unable to load calendar events.');
  return (data ?? []).map(mapCalendarEventRowToDto);
}

async clearEventMappingsForUserBySourceTypes(
  workspaceId: string,
  userId: string,
  sourceTypes: CalendarSourceType[],
) {
  const { error } = await this.supabase
    .from('calendar_events')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('provider', 'google')
    .in('source_type', sourceTypes);

  throwOnSupabaseError(error, 'calendar_event_delete_failed', 'Unable to remove calendar events.');
}
```

Retain `clearEventMappingsForUser` for the all-source disconnect cleanup only if the service still needs it; otherwise replace it with the new explicit all-source call.

- [ ] **Step 4: Add the provider deletion operation**

Extend `GoogleCalendarProvider` with:

```ts
deleteEvent(input: {
  tokens: GoogleCalendarTokens;
  providerEventId: string;
}): Promise<void>;
```

Set OAuth credentials exactly as `upsertEvent` does, then call:

```ts
await calendar.events.delete({
  calendarId: 'primary',
  eventId: input.providerEventId,
});
```

Catch only provider errors whose `code` is `404`; return normally for those. Re-throw every other failure for the service to handle safely.

- [ ] **Step 5: Run repository and provider tests**

Run: `npm test -- calendar.repository.test.ts google-calendar.client.test.ts`

Expected: PASS.

### Task 2: Delete remote events before disabling or disconnecting

**Files:**
- Modify: `src/modules/calendar/calendar.service.ts:34-45,341-400`
- Modify: `tests/calendar.service.test.ts`

**Interfaces:**
- Consumes: scoped event mappings, `googleProvider.deleteEvent`, and an active connection’s decrypted tokens.
- Produces: setting updates or disconnects only after remote event removal succeeds.

- [ ] **Step 1: Write failing service tests**

Extend `FakeCalendarRepository` with source-type map/list/delete tracking and `FakeGoogleProvider` with `deleteEvent`. Seed mappings for `weekly_meeting`, `task_due_date`, `meeting_reminder`, and `follow_up_date`.

Add these behavioral tests:

```ts
it('deletes only the weekly event before disabling weekly sync', async () => {
  await service.updateGoogleSettings(auth, { weeklyMeetingSyncEnabled: false });

  expect(provider.deletedEventIds).toEqual(['weekly-event']);
  expect(repository.clearedSourceTypeGroups).toEqual([['weekly_meeting']]);
  expect(repository.preferences.weeklyMeetingSyncEnabled).toBe(false);
});

it('deletes only assigned-task events before disabling task sync', async () => {
  await service.updateGoogleSettings(auth, { assignedTaskSyncEnabled: false });

  expect(provider.deletedEventIds).toEqual(['task-event']);
  expect(repository.clearedSourceTypeGroups).toEqual([['task_due_date']]);
  expect(repository.preferences.assignedTaskSyncEnabled).toBe(false);
});

it('deletes every mapped OurWeek event before disconnecting', async () => {
  await service.disconnectGoogle(auth);

  expect(provider.deletedEventIds).toEqual([
    'weekly-event',
    'task-event',
    'meeting-event',
    'follow-up-event',
  ]);
});

it('preserves settings, mappings, and connection when cleanup fails', async () => {
  provider.deleteFailureForEventId = 'task-event';

  await expect(service.updateGoogleSettings(auth, {
    weeklyMeetingSyncEnabled: false,
    assignedTaskSyncEnabled: false,
  })).rejects.toThrow('calendar_provider_delete_failed');

  expect(repository.upsertPreferencesCalls).toBe(0);
  expect(repository.clearedSourceTypeGroups).toEqual([]);
  expect(repository.connections.get('workspace-1:user-1')?.status).toBe('connected');
});
```

For the disconnect order test, capture ordered markers in fake provider/repository methods and assert:

```ts
expect(operations).toEqual([
  'delete:weekly-event',
  'delete:task-event',
  'delete:meeting-event',
  'delete:follow-up-event',
  'revoke',
  'disconnect',
  'clear-mappings',
]);
```

- [ ] **Step 2: Run service tests to verify failure**

Run: `npm test -- calendar.service.test.ts`

Expected: FAIL because settings changes and disconnect do not delete remote mapped events.

- [ ] **Step 3: Add a private cleanup helper**

Define the complete source-type list once:

```ts
const ALL_CALENDAR_SOURCE_TYPES: CalendarSourceType[] = [
  'weekly_meeting',
  'task_due_date',
  'meeting_reminder',
  'follow_up_date',
];
```

Add `removeMappedGoogleEvents(auth, connection, sourceTypes)` that:

1. loads only scoped mappings;
2. decrypts the connection tokens once;
3. awaits `googleProvider.deleteEvent` for each provider event ID;
4. deletes the matching mapping rows only after all provider deletes resolve.

Do not catch non-404 provider errors in this helper. They must prevent the following settings write or local disconnect.

- [ ] **Step 4: Integrate cleanup into disconnect**

In `disconnectGoogle`, when a connection exists:

1. call `removeMappedGoogleEvents(auth, connection, ALL_CALENDAR_SOURCE_TYPES)`;
2. call `googleProvider.revoke`, retaining the current best-effort revocation catch;
3. call `disconnectConnection`.

Remove the old unconditional local-only `clearEventMappingsForUser` call because successful remote cleanup already removed every mapping. A non-404 remote-delete failure must propagate before token revocation and local disconnect.

- [ ] **Step 5: Integrate cleanup into settings updates**

Before `upsertPreferences`, detect only true-to-false transitions:

```ts
const disabledSourceTypes: CalendarSourceType[] = [
  ...(current.weeklyMeetingSyncEnabled && !preferences.weeklyMeetingSyncEnabled
    ? ['weekly_meeting' as const] : []),
  ...(current.assignedTaskSyncEnabled && !preferences.assignedTaskSyncEnabled
    ? ['task_due_date' as const] : []),
];
```

When this list is non-empty, load the current connection. If present, call `removeMappedGoogleEvents` before saving preferences. If no connection exists, clear only the matching local mappings before saving the disabled preference.

Preserve the existing behavior that an enabled weekly setting triggers `syncWeeklyMeetingForUser` after preferences are saved.

- [ ] **Step 6: Run service tests**

Run: `npm test -- calendar.service.test.ts`

Expected: PASS.

### Task 3: Explain cleanup in every mobile locale

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/features/localization/messages.ts:427-470,1895-1942,3399-3448`
- Modify: `D:/Projects/myself/weekly-us/src/features/localization/__tests__/calendarScheduleMessages.test.ts`

**Interfaces:**
- Consumes: existing `calendar.disconnectConfirmText` and option-description translation keys.
- Produces: user-visible deletion descriptions in `en`, `uk`, and `es`.

- [ ] **Step 1: Write failing localization assertions**

Extend the existing calendar localization test so each locale has non-empty cleanup strings for:

```ts
messages[locale].calendar.disconnectConfirmText
messages[locale].calendar.options.weeklyMeeting.cleanupDescription
messages[locale].calendar.options.taskDueDates.cleanupDescription
```

- [ ] **Step 2: Run the localization test to verify it fails**

Run: `npm test -- src/features/localization/__tests__/calendarScheduleMessages.test.ts`

Expected: FAIL because the option cleanup descriptions are absent.

- [ ] **Step 3: Add and render localized cleanup descriptions**

Add these message values:

| Locale | Weekly cleanup | Task cleanup | Disconnect confirmation |
| --- | --- | --- | --- |
| `en` | `Turning this off removes the weekly meeting from Google Calendar.` | `Turning this off removes synced task due dates from Google Calendar.` | `OurWeek will remove every event it created in Google Calendar, then disconnect your account.` |
| `uk` | `Якщо вимкнути цю опцію, OurWeek видалить щотижневу зустріч із Google Calendar.` | `Якщо вимкнути цю опцію, OurWeek видалить синхронізовані дати завдань із Google Calendar.` | `OurWeek видалить усі створені ним події з Google Calendar, а потім відключить обліковий запис.` |
| `es` | `Al desactivar esta opción, OurWeek eliminará la reunión semanal de Google Calendar.` | `Al desactivar esta opción, OurWeek eliminará las fechas de tareas sincronizadas de Google Calendar.` | `OurWeek eliminará todos los eventos que creó en Google Calendar y luego desconectará tu cuenta.` |

Render each `cleanupDescription` as a `<small>` beneath its existing option description in `CalendarSyncPage.vue`. Do not add a new request or a confirmation dialog for the individual toggle; the existing setting update performs the requested cleanup.

- [ ] **Step 4: Run the localization test**

Run: `npm test -- src/features/localization/__tests__/calendarScheduleMessages.test.ts`

Expected: PASS.

### Task 4: Run complete verification

**Files:**
- Verify: calendar provider, repository, service, tests, and mobile localization changes listed above.

**Interfaces:**
- Consumes: complete cleanup behavior and updated mobile messages.
- Produces: validated backend and mobile builds.

- [ ] **Step 1: Run backend focused tests and typecheck**

Run in `D:/Projects/myself/weekly-us-api`: `npm run typecheck && npm test -- calendar.repository.test.ts calendar.service.test.ts google-calendar.client.test.ts`

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run in `D:/Projects/myself/weekly-us-api`: `npm run build`

Expected: PASS.

- [ ] **Step 3: Run mobile focused test and build**

Run in `D:/Projects/myself/weekly-us`: `npm test -- src/features/localization/__tests__/calendarScheduleMessages.test.ts && npm run build`

Expected: PASS.

- [ ] **Step 4: Check final diffs**

Run in both repositories: `git diff --check` using the repository-specific safe-directory override.

Expected: no whitespace errors and no changes outside calendar cleanup, user messaging, tests, and the approved documentation.

## Self-Review

- **Spec coverage:** Task 1 implements and tests ownership-scoped mapping retrieval and Google deletion; Task 2 covers transition-specific and disconnect-wide remote-first cleanup, safe retry, and operation order; Task 3 makes the destructive behavior explicit in every app locale; Task 4 verifies both repositories.
- **Placeholder scan:** no unresolved placeholders or deferred requirements remain.
- **Type consistency:** `CalendarSourceType` is used consistently by repository filters and the service source-type lists; `GoogleCalendarProvider.deleteEvent` consumes only encrypted-connection tokens after decryption and the mapped provider event ID.
