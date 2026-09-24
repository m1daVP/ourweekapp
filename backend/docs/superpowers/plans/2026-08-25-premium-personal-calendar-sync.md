# Premium Personal Calendar Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each Premium adult a private Google Calendar connection that can
sync their recurring weekly meeting and tasks explicitly assigned to their
account.

**Architecture:** Keep OAuth credentials and all Google calls in the backend
calendar module. Store per-user preferences separately from a connection and
make the calendar service the only component that maps an eligible source to a
Google event. Extend tasks with explicit workspace-user assignees; retain the
existing participant responsibility data unchanged so a participant is never
mistaken for a signed-in adult.

**Tech Stack:** Node.js, Fastify, TypeScript, Zod, Supabase/PostgreSQL,
googleapis, Vue 3, Pinia, Vitest, Capacitor.

## Global Constraints

- Connections, preferences, mappings, and provider calls are always scoped by
  `workspace_id` **and** the authenticated `user_id`.
- Only owner and adult-member roles may connect or configure their own
  Calendar; viewers receive the existing safe authorization response.
- Premium is the sole household-level availability check. There is no
  workspace-owner switch and no endpoint that exposes or controls another
  adult's connection.
- The sole destination is the connected Google account's `primary` calendar.
  Do not add a calendar picker, shared calendar, event import, or Google-event
  reader.
- Connection settings are server-side. Remove the device-local Calendar
  settings and do not migrate a device's private toggle values to another
  signed-in account.
- Weekly Calendar events are recurring Google events. The owner of the
  connection chooses day, time, and IANA time zone in their Calendar settings;
  the initial values are Sunday, 18:00, and the device's current time zone.
- A task Calendar event requires an open task, a due date, and an explicit
  adult `responsibleUserIds` entry. Existing participant/shared/unassigned
  tasks never sync through inference.
- Google failures never prevent saving a meeting, task, or preference. Return
  only a generic retryable state; never log or return OAuth tokens, calendar
  IDs, or provider event IDs.
- Disconnect revokes local access, deletes only OurWeek event mappings, and
  deliberately leaves previously created Google events untouched.
- Use an additive migration. Do not edit applied migrations, backfill task
  assignees from participants, stage files, or create commits without the
  user's explicit approval.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/20260825130000_create_personal_calendar_preferences.sql` | Adds per-user Calendar preferences and explicit task user-assignee data without modifying existing participant responsibility columns. |
| `src/modules/calendar/calendar.schema.ts` | Calendar settings, health/status, recurring-event, and settings-update DTOs. |
| `src/modules/calendar/calendar.repository.ts` | Safe preference CRUD, connected-user lookup, and mapping removal on disconnect. |
| `src/modules/calendar/calendar.service.ts` | Owns personal settings, recurring weekly-event calculation, task eligibility, idempotent Google writes, and generic error state. |
| `src/modules/calendar/calendar.routes.ts` | Current-user Calendar status/settings/retry routes behind the existing Premium feature guard. |
| `src/modules/calendar/google-oauth.client.ts` | Sends recurring event payloads to Google `primary`; does not list calendars or events. |
| `src/modules/tasks/tasks.schema.ts` / `tasks.repository.ts` / `tasks.service.ts` | Carries, validates, persists, and syncs explicit adult user assignees after a successful task write. |
| `src/modules/tasks/tasks.routes.ts` | Constructs the task service with the Calendar sync collaborator. |
| `tests/calendar.migration.test.ts` / `tests/calendar.schema.test.ts` / `tests/calendar.repository.test.ts` / `tests/calendar.service.test.ts` / `tests/tasks.service.test.ts` | Regression coverage for migration safety, DTO validation, owner scoping, eligibility, idempotency, and non-blocking failures. |
| `D:/Projects/myself/weekly-us/src/features/calendar/types.ts` / `src/shared/api/calendarApi.ts` / `src/features/calendar/services/calendarService.ts` | Client DTOs and API wrappers for the current adult's Calendar settings. |
| `D:/Projects/myself/weekly-us/src/app/stores/calendarSync.ts` / `src/pages/CalendarSyncPage.vue` | Server-backed personal Calendar state, settings UI, retry feedback, and disconnect confirmation. |
| `D:/Projects/myself/weekly-us/src/features/tasks/types.ts` / `src/app/stores/tasks.ts` / `src/features/meeting/types.ts` / `src/app/stores/meetings.ts` / `src/pages/TasksPage.vue` | Preserves explicit adult assignees through local task and meeting copies and lets an editor choose active adult members. |
| `D:/Projects/myself/weekly-us/src/shared/api/syncDtos.ts` / related client tests / `src/features/localization/messages.ts` | Keeps sync DTOs, tests, and English/Ukrainian/Spanish copy aligned. |

### Task 1: Add backward-compatible personal Calendar and task-assignee schema

**Files:**
- Create: `supabase/migrations/20260825130000_create_personal_calendar_preferences.sql`
- Modify: `tests/calendar.migration.test.ts`
- Test: `tests/calendar.migration.test.ts`

**Interfaces:**
- Produces `calendar_preferences(workspace_id, user_id, provider,
  weekly_meeting_sync_enabled, assigned_task_sync_enabled,
  weekly_meeting_day, weekly_meeting_time, time_zone, last_sync_error_code,
  last_sync_attempted_at)` with a unique `(workspace_id, user_id, provider)`
  key.
- Produces `tasks.responsible_user_ids jsonb not null default '[]'::jsonb`.
- Extends the `calendar_events.source_type` check with `weekly_meeting`.

- [ ] **Step 1: Write the failing migration assertions**

```ts
const sql = readFileSync(migrationPath, 'utf8');

expect(sql).toContain('create table public.calendar_preferences');
expect(sql).toContain('unique (workspace_id, user_id, provider)');
expect(sql).toContain("add column if not exists responsible_user_ids jsonb not null default '[]'::jsonb");
expect(sql).toContain("'weekly_meeting'");
expect(sql).toContain('alter table public.calendar_preferences enable row level security');
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/calendar.migration.test.ts`

Expected: FAIL because the new migration path does not exist.

- [ ] **Step 3: Write the additive migration**

```sql
create table public.calendar_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null default 'google' check (provider = 'google'),
  weekly_meeting_sync_enabled boolean not null default false,
  assigned_task_sync_enabled boolean not null default false,
  weekly_meeting_day text not null default 'sunday' check (weekly_meeting_day in ('sunday','monday','tuesday','wednesday','thursday','friday','saturday')),
  weekly_meeting_time time not null default '18:00:00',
  time_zone text not null default 'UTC',
  last_sync_error_code text,
  last_sync_attempted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, provider)
);

alter table public.tasks
  add column if not exists responsible_user_ids jsonb not null default '[]'::jsonb,
  add constraint tasks_responsible_user_ids_array
    check (jsonb_typeof(responsible_user_ids) = 'array');
```

Drop and recreate the existing `calendar_events_source_type_check` with its
three existing values plus `weekly_meeting`; add the preference indexes and
the same deny-all RLS posture used by the existing Calendar tables. Do not run
an `UPDATE` to derive users from participant IDs.

- [ ] **Step 4: Run the migration structural test**

Run: `npm test -- tests/calendar.migration.test.ts`

Expected: PASS.

### Task 2: Define personal Calendar preference and recurring-event contracts

**Files:**
- Modify: `src/modules/calendar/calendar.schema.ts`
- Modify: `src/modules/calendar/google-oauth.client.ts`
- Create: `tests/calendar.schema.test.ts`
- Test: `tests/calendar.schema.test.ts`

**Interfaces:**
- Produces `CalendarPreferencesDto`:

```ts
type CalendarPreferencesDto = {
  weeklyMeetingSyncEnabled: boolean;
  assignedTaskSyncEnabled: boolean;
  weeklyMeetingDay: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
  weeklyMeetingTime: string;
  timeZone: string;
  lastSyncErrorCode?: 'provider-error';
  lastSyncAttemptedAt?: string;
};
```

- Produces `UpdateCalendarPreferencesDto` with the two booleans and optional
  complete weekly schedule (`weeklyMeetingDay`, `weeklyMeetingTime`,
  `timeZone`); reject a partial schedule update.
- Extends `GoogleCalendarEventInput` with optional
  `recurrence: string[]` and `timeZone: string` for date-time events.

- [ ] **Step 1: Add failing Calendar DTO tests**

```ts
expect(calendarPreferencesSchema.parse({
  weeklyMeetingSyncEnabled: true,
  assignedTaskSyncEnabled: false,
  weeklyMeetingDay: 'sunday',
  weeklyMeetingTime: '18:00',
  timeZone: 'Europe/Warsaw',
})).toMatchObject({ weeklyMeetingDay: 'sunday' });

expect(() => updateCalendarPreferencesSchema.parse({
  weeklyMeetingDay: 'monday',
})).toThrow();
```

- [ ] **Step 2: Run the focused schema test to verify it fails**

Run: `npm test -- tests/calendar.schema.test.ts`

Expected: FAIL because the preference schemas do not exist.

- [ ] **Step 3: Add Zod DTOs and Google event serialization**

```ts
export const calendarPreferencesSchema = z.object({
  weeklyMeetingSyncEnabled: z.boolean(),
  assignedTaskSyncEnabled: z.boolean(),
  weeklyMeetingDay: calendarWeekdaySchema,
  weeklyMeetingTime: z.string().regex(/^\d{2}:\d{2}$/),
  timeZone: z.string().trim().min(1).max(100),
  lastSyncErrorCode: z.literal('provider-error').optional(),
  lastSyncAttemptedAt: isoDateTimeStringSchema.optional(),
});
```

Extend `GoogleCalendarEventInput` now so the service task can pass recurring
event fields without a later type-contract change. Map date-time inputs to
Google with `start.timeZone`, `end.timeZone`, and `recurrence` only when
present. Keep `calendarId: 'primary'`, and do not add calendar list/read
methods to the provider interface.

- [ ] **Step 4: Run the focused schema test to verify it passes**

Run: `npm test -- tests/calendar.schema.test.ts`

Expected: PASS.

### Task 3: Persist and expose only the current adult's Calendar preferences

**Files:**
- Modify: `src/modules/calendar/calendar.repository.ts`
- Modify: `src/modules/calendar/calendar.service.ts`
- Modify: `src/modules/calendar/calendar.routes.ts`
- Modify: `tests/calendar.repository.test.ts`
- Modify: `tests/calendar.service.test.ts`
- Test: `tests/calendar.repository.test.ts`
- Test: `tests/calendar.service.test.ts`

**Interfaces:**
- Consumes `CalendarPreferencesDto` from Task 2.
- Produces repository methods:

```ts
findPreferencesForUser(workspaceId: string, userId: string): Promise<CalendarPreferencesDto | null>
upsertPreferences(input: { workspaceId: string; userId: string; preferences: CalendarPreferencesDto }): Promise<CalendarPreferencesDto>
clearEventMappingsForUser(workspaceId: string, userId: string): Promise<void>
```

- Produces routes `GET /calendar/google/settings`, `PUT /calendar/google/settings`,
  and `POST /calendar/google/retry`, each authenticated, Premium-gated, and
  restricted to the caller.

- [ ] **Step 1: Add repository query-shape tests**

```ts
await repository.upsertPreferences({ workspaceId: 'workspace-1', userId: 'user-1', preferences });
expect(supabase.upsertRow).toMatchObject({ workspace_id: 'workspace-1', user_id: 'user-1' });
expect(supabase.upsertOptions).toEqual({ onConflict: 'workspace_id,user_id,provider' });
```

Add a disconnect test that expects an event-mapping delete filtered by both
`workspace_id` and `user_id`.

- [ ] **Step 2: Run repository tests to verify they fail**

Run: `npm test -- tests/calendar.repository.test.ts`

Expected: FAIL because the preference methods and mapping delete are absent.

- [ ] **Step 3: Implement preference ownership and safe status output**

Extend `CalendarConnectionStatusDto` with the caller's `preferences` object;
use disabled defaults when no preference row exists. In `getGoogleStatus`,
`updateGoogleSettings`, and `retryGoogleSync`, call
`requireMinimumRole(auth, 'adult_member')`, then only pass
`auth.workspaceId` and `auth.userId` to repositories. Exclude provider IDs,
tokens, and another person's state from every response schema.

Make `disconnectGoogle` call `clearEventMappingsForUser` after its local
connection revocation/update. Keep the existing successful local disconnect
when Google revocation throws.

- [ ] **Step 4: Run service and repository tests**

Run: `npm test -- tests/calendar.repository.test.ts tests/calendar.service.test.ts`

Expected: PASS. Add explicit assertions that a viewer is rejected and that a
second adult's connection/preferences are never fetched or returned.

### Task 4: Implement idempotent personal weekly and assigned-task sync

**Files:**
- Modify: `src/modules/calendar/calendar.repository.ts`
- Modify: `src/modules/calendar/calendar.service.ts`
- Modify: `src/modules/calendar/calendar.routes.ts`
- Modify: `tests/calendar.service.test.ts`
- Test: `tests/calendar.service.test.ts`

**Interfaces:**
- Produces `CalendarSyncCoordinator` exported by `calendar.service.ts`:

```ts
export type CalendarSyncCoordinator = {
  syncWeeklyMeetingForUser(auth: AuthContext, now?: Date): Promise<CalendarSyncResultDto>;
  syncAssignedTaskForUser(input: {
    workspaceId: string;
    userId: string;
    task: Pick<TaskDto, 'id' | 'title' | 'dueDate' | 'status' | 'deletedAt'>;
  }, now?: Date): Promise<CalendarSyncResultDto>;
};
```

- `syncWeeklyMeetingForUser` stores its mapping as
  `(sourceType: 'weekly_meeting', sourceId: 'personal-weekly-meeting')`.
- `syncAssignedTaskForUser` writes only for a connected adult with task sync
  enabled, an open non-deleted task, and a due date.

- [ ] **Step 1: Write failing eligibility and idempotency tests**

```ts
await service.syncAssignedTaskForUser({ workspaceId, userId, task: task({ dueDate: '2026-06-10' }) }, now);
await service.syncAssignedTaskForUser({ workspaceId, userId, task: task({ dueDate: '2026-06-11' }) }, now);

expect(provider.upsertEvent.mock.calls[1][0].providerEventId).toBe('google-event-new');

await service.syncWeeklyMeetingForUser(auth, now);
expect(provider.upsertEvent).toHaveBeenLastCalledWith(expect.objectContaining({
  event: expect.objectContaining({
    recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=SU'],
    timeZone: 'Europe/Warsaw',
  }),
}));

await expect(service.syncAssignedTaskForUser({ workspaceId, userId, task: task({ dueDate: null }) }, now))
  .resolves.toMatchObject({ synced: false, skippedReason: 'missing-calendar-date' });
```

Add cases for both disabled preferences, no connection, a disconnected
connection, task `status: 'done'`, deleted task, and provider failure. Verify
the failure returns `provider-error`, retains the task write, and records only
the generic error code in that adult's preference row.

- [ ] **Step 2: Run the focused Calendar service tests to verify they fail**

Run: `npm test -- tests/calendar.service.test.ts`

Expected: FAIL because the coordinator methods do not exist.

- [ ] **Step 3: Implement the coordinator without client-supplied event data**

Calculate the next weekly occurrence from the persisted weekday/time/time-zone
settings and form this provider input:

```ts
{
  title: 'OurWeek weekly meeting',
  dateTime: nextOccurrenceIso,
  timeZone: preferences.timeZone,
  recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${googleWeekday}`],
}
```

Reuse the existing `(workspaceId, userId, sourceType, sourceId)` lookup before
calling Google, then upsert the mapping only after Google returns an event ID.
For task events, derive title and due date from the canonical saved task rather
than any Calendar HTTP body. Preserve the current generic provider-failure
handling and make retry re-run only the owning adult's enabled sources.

Remove the public `/meeting-reminders`, `/task-due-dates`, and
`/follow-up-dates` write endpoints; they let a client choose a source/title and
are incompatible with server-owned eligibility. Do not replace them with a
follow-up route in this milestone.

- [ ] **Step 4: Run Calendar tests**

Run: `npm test -- tests/calendar.service.test.ts tests/calendar.repository.test.ts`

Expected: PASS, proving a mapping from another adult is never reused and that
repeated writes update one event instead of inserting duplicates.

### Task 5: Carry explicit adult assignees through task sync and trigger Calendar safely

**Files:**
- Modify: `src/modules/tasks/tasks.schema.ts`
- Modify: `src/modules/tasks/tasks.repository.ts`
- Modify: `src/modules/tasks/tasks.service.ts`
- Modify: `src/modules/tasks/tasks.routes.ts`
- Modify: `tests/tasks.service.test.ts`
- Test: `tests/tasks.service.test.ts`

**Interfaces:**
- Consumes `CalendarSyncCoordinator` from Task 4.
- Extends `TaskDto`, `UpsertTaskInput`, and `UpdateTaskIfRevisionMatchesInput`
  with `responsibleUserIds: string[]`.
- Produces task-service constructor input:

```ts
type WorkspaceMembersPort = {
  listActiveMembersForWorkspace(workspaceId: string): Promise<Array<{ userId: string; role: UserRole }>>;
};
```

- [ ] **Step 1: Add failing task-service tests**

```ts
const request = syncRequest({
  responsibleUserIds: [adultUserId, adultUserId],
  responsibilityType: 'shared',
  responsibleParticipantIds: [],
});

await expect(service.syncTasks(auth, request, now)).rejects.toMatchObject({
  statusCode: 422,
  code: 'task_responsible_user_invalid_reference',
});
```

Add tests that an active owner/adult ID is accepted, a viewer/removed/foreign
user ID is rejected, and calendar sync is called once for each accepted
assignee only after insert/update succeeds. Add a provider-failure test that
still returns the successfully saved task response.

- [ ] **Step 2: Run the focused task tests to verify they fail**

Run: `npm test -- tests/tasks.service.test.ts`

Expected: FAIL because task DTOs do not include `responsibleUserIds` and the
Calendar coordinator is not invoked.

- [ ] **Step 3: Implement task assignee validation, persistence, and trigger**

Add `responsibleUserIds: z.array(apiIdSchema)` to `taskSchema`; normalize it
with the existing `uniqueStrings` equivalent and reject duplicates rather than
silently accepting them at the API boundary. Validate all IDs against active
workspace members whose roles are `owner` or `adult_member`.

Add `responsible_user_ids` to `TASK_COLUMNS`, `TaskRow`, every insert/upsert/
revision-guarded update, and `mapTaskRowToDto`. Preserve it in conflict DTOs
and content-change detection. After each canonical task insert/update, call:

```ts
await Promise.all(savedTask.responsibleUserIds.map((userId) =>
  this.calendarSyncCoordinator.syncAssignedTaskForUser({
    workspaceId,
    userId,
    task: savedTask,
  }),
));
```

Catch coordinator errors at this boundary and log only a structured source/user
identifier; never convert a task save into a Calendar error. Inject the
coordinator and an existing workspace-members repository through
`createDefaultTasksService` in `tasks.routes.ts`.

- [ ] **Step 4: Run the task tests to verify they pass**

Run: `npm test -- tests/tasks.service.test.ts`

Expected: PASS, including conflict and cross-workspace regression tests.

### Task 6: Replace local Calendar settings with server-backed personal controls

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/features/calendar/types.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/calendarApi.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/calendar/services/calendarService.ts`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/calendarSync.ts`
- Modify: `D:/Projects/myself/weekly-us/src/pages/CalendarSyncPage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/features/localization/messages.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/__tests__/apiWrappers.test.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/calendar/services/__tests__/calendarService.test.ts`
- Test: `D:/Projects/myself/weekly-us/src/app/stores/__tests__/calendarSync.test.ts`

**Interfaces:**
- Consumes `GET`/`PUT /calendar/google/settings` and `POST /calendar/google/retry`
  from Tasks 3–4.
- Produces `CalendarSettings` matching the backend DTO and a store action
  `updateSettings(payload: Partial<CalendarSettings>): Promise<void>`.

- [ ] **Step 1: Write failing client API and store tests**

```ts
await updateGoogleCalendarSettings({ assignedTaskSyncEnabled: false });
expect(apiRequest).toHaveBeenCalledWith('/calendar/google/settings', {
  method: 'PUT',
  body: { assignedTaskSyncEnabled: false },
  requiresAuth: true,
});

await store.updateSettings({ weeklyMeetingSyncEnabled: true });
expect(store.connectionStatus?.preferences.weeklyMeetingSyncEnabled).toBe(true);
```

- [ ] **Step 2: Run focused client tests to verify they fail**

Run: `npm test -- src/shared/api/__tests__/apiWrappers.test.ts src/app/stores/__tests__/calendarSync.test.ts`

Expected: FAIL because settings API wrappers and server-backed store actions
do not exist.

- [ ] **Step 3: Implement the personal settings experience**

Delete `CalendarSyncSettings`, storage reads/writes, and the follow-up setting
from `calendarSync.ts`. Hydrate the caller's settings from Calendar status;
optimistically disable controls during a PUT and restore the previous settings
when it fails. Expose a retry button only for the caller's generic
`provider-error` state.

In `CalendarSyncPage.vue`, use “Your Google Calendar”, retain exactly two
toggles (“Weekly meetings” and “Tasks assigned to you”), and add weekday/time
inputs only when weekly meetings are enabled. On first settings save, send
`Intl.DateTimeFormat().resolvedOptions().timeZone` and the default Sunday
18:00 schedule. Replace the old follow-up option with copy that shared and
unassigned items stay in OurWeek. Put a clear disconnect confirmation in the
existing dialog component: “Disconnecting stops future Calendar sync. Events
already in Google will remain.”

Add matching English, Ukrainian, and Spanish messages. Never show another
adult's email, settings, provider errors, or sync state.

- [ ] **Step 4: Run focused client tests**

Run: `npm test -- src/shared/api/__tests__/apiWrappers.test.ts src/features/calendar/services/__tests__/calendarService.test.ts src/app/stores/__tests__/calendarSync.test.ts`

Expected: PASS.

### Task 7: Add explicit adult task assignment to the mobile sync model and editor

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/features/tasks/types.ts`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/tasks.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/types.ts`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/meetings.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/syncDtos.ts`
- Modify: `D:/Projects/myself/weekly-us/src/pages/TasksPage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/__tests__/tasks.test.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/__tests__/syncDtos.test.ts`
- Test: `D:/Projects/myself/weekly-us/src/app/stores/__tests__/tasks.test.ts`

**Interfaces:**
- Consumes `WorkspaceMember` records already loaded by
  `useWorkspaceStore().activeMembers`.
- Extends all local task representations with
  `responsibleUserIds: string[]`.
- Produces a task-editor payload with both distinct responsibility fields:

```ts
{
  responsibilityType: TaskResponsibilityType;
  responsibleParticipantIds: string[];
  responsibleUserIds: string[];
}
```

- [ ] **Step 1: Write failing store and DTO tests**

```ts
const task = store.addTask({
  title: 'Book dentist',
  responsibilityType: 'participant',
  responsibleParticipantIds: ['participant-1'],
  responsibleUserIds: ['adult-user-1'],
});

expect(task?.responsibleUserIds).toEqual(['adult-user-1']);
expect(toTaskSyncDto(task!)).toMatchObject({ responsibleUserIds: ['adult-user-1'] });
```

Also assert legacy stored tasks normalize to `responsibleUserIds: []` and
meeting-derived task copies do not discard this property.

- [ ] **Step 2: Run the focused client tests to verify they fail**

Run: `npm test -- src/app/stores/__tests__/tasks.test.ts src/shared/api/__tests__/syncDtos.test.ts`

Expected: FAIL because the local task model does not carry user IDs.

- [ ] **Step 3: Implement explicit adult selection without changing participant meaning**

Use `uniqueStrings` when normalizing, creating, updating, cloning, carrying,
and syncing tasks. Keep the existing participant responsibility selector
unchanged. Add a separate multi-select labelled “Adults assigned to this
task” to the task create/edit sheets, populated only from active workspace
members with role `owner` or `adult_member`; include no viewer or invited
member. Explain in short supporting copy that only selected adults who turn on
Calendar task sync receive an event.

Pass the selection through `tasksStore`, `meetingsStore.updateTaskDetails`,
meeting task copies, local storage normalization, and sync DTO mapping. Do not
automatically derive adult IDs from participant names, emails, or initials.

- [ ] **Step 4: Run focused client tests**

Run: `npm test -- src/app/stores/__tests__/tasks.test.ts src/shared/api/__tests__/syncDtos.test.ts`

Expected: PASS, including legacy storage and multi-adult assignment cases.

### Task 8: Verify end-to-end privacy, regression behavior, and rollout readiness

**Files:**
- Modify: `tests/calendar.service.test.ts`
- Modify: `tests/tasks.service.test.ts`
- Modify: `D:/Projects/myself/weekly-us/src/pages/CalendarSyncPage.vue` only if test findings require a focused fix
- Test: `tests/calendar.service.test.ts`
- Test: `tests/tasks.service.test.ts`
- Test: `D:/Projects/myself/weekly-us/src/app/stores/__tests__/calendarSync.test.ts`

**Interfaces:**
- Consumes all contracts delivered by Tasks 1–7.
- Produces a verified personal Calendar flow with no cross-adult controls.

- [ ] **Step 1: Add cross-adult regression cases**

```ts
await expect(otherAdultService.disconnectGoogle(auth, now)).resolves.toMatchObject({
  state: 'disconnected',
});
expect(repository.clearEventMappingsForUser).toHaveBeenCalledWith(workspaceId, auth.userId);
expect(repository.findConnectionForUser).not.toHaveBeenCalledWith(workspaceId, otherUserId);
```

Add route-level coverage for 401, viewer 403, Free entitlement denial, and a
wrong-workspace source ID. Add a two-adult task test where only the opted-in
assignee receives an event and a reconnect test proving old mappings were
removed before a new Google connection is used.

- [ ] **Step 2: Run the focused backend regression suite**

Run: `npm test -- tests/calendar.migration.test.ts tests/calendar.repository.test.ts tests/calendar.service.test.ts tests/tasks.service.test.ts`

Expected: PASS.

- [ ] **Step 3: Run static and full regression checks**

Run in `D:/Projects/myself/weekly-us-api`: `npm run typecheck && npm test`

Run in `D:/Projects/myself/weekly-us`: `npm run typecheck && npm test && npm run build`

Expected: all commands PASS. Investigate every type or test failure; do not
disable tests or loosen ownership assertions to make the suite pass.

- [ ] **Step 4: Perform staging manual checks**

Use two active adult accounts in one Premium workspace plus a viewer. Verify:

1. Each adult can connect a different Google account and only sees their own
   state and settings.
2. A weekly setting creates/updates one recurring event in that adult's
   primary calendar.
3. A due-dated task assigned to both adults appears only for adults who have
   enabled task sync.
4. A shared, participant-only, unassigned, done, or due-date-less task makes
   no Google write.
5. A forced provider failure leaves the task and setting saved and offers only
   that adult a retry.
6. Disconnect stops future writes, removes OurWeek mappings, and leaves the
   existing Google event visible.

Record migration application, staging verification, and provider error-rate
monitoring in the deployment checklist before production release.
