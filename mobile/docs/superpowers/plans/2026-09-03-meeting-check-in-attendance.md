# Meeting Check-in Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve a meeting's selected attendees and check-in phase across navigation, remounts, and sync while still allowing users to return to check-in and edit attendance.

**Architecture:** Add a durable `checkInCompleted` field to the synchronized meeting aggregate. The backend stores and returns it with the existing optimistic-concurrency meeting record; the frontend uses it instead of a component-local flag to decide whether to render check-in. Participant IDs remain initialized at creation only and are not reconciled from the household roster afterward.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest, Fastify, Zod, Supabase/PostgreSQL.

## Global Constraints

- Keep the change additive and rolling-deploy compatible: missing legacy values resolve to `false`.
- Do not change existing participant ownership validation, workspace scoping, or meeting concurrency behavior.
- Do not add dependencies or a separate attendance table.
- Do not stage or commit: commits require an explicitly pasted approved numbered commit list.

---

## File Structure

- `D:/Projects/myself/weekly-us-api/supabase/migrations/20260903120000_add_meeting_check_in_completed.sql`: additive boolean column for existing meeting rows.
- `D:/Projects/myself/weekly-us-api/src/modules/meetings/meetings.schema.ts`: API request/response defaulting for `checkInCompleted`.
- `D:/Projects/myself/weekly-us-api/src/modules/meetings/meetings.repository.ts`: row mapping and persistence of the column.
- `D:/Projects/myself/weekly-us-api/src/modules/meetings/meetings.service.ts`: sync snapshots include the new field.
- `D:/Projects/myself/weekly-us-api/tests/meetings.service.test.ts`: service-level sync coverage for the new field and legacy payloads.
- `D:/Projects/myself/weekly-us/src/features/meeting/types.ts`: durable frontend meeting property.
- `D:/Projects/myself/weekly-us/src/app/stores/meetings.ts`: creation/storage migration, explicit phase action, and removal of roster-driven attendee mutation.
- `D:/Projects/myself/weekly-us/src/features/meeting/composables/useMeetingSession.ts`: render and Back/Start transitions based on `checkInCompleted`.
- `D:/Projects/myself/weekly-us/src/features/meeting/meetingSyncSnapshot.ts`: sync-content comparison includes the field.
- `D:/Projects/myself/weekly-us/src/shared/api/syncDtos.ts`: defensively normalize a missing field from an older API.
- `D:/Projects/myself/weekly-us/src/shared/services/syncService.ts`: preserve a locally active valid meeting while applying a stale hydration result.
- `D:/Projects/myself/weekly-us/src/app/stores/__tests__/meetings.test.ts`, `src/features/meeting/composables/__tests__/useMeetingSession.test.ts`, and `src/shared/services/__tests__/syncService.test.ts`: frontend regression coverage.

## Task 1: Persist check-in completion in the backend

**Files:**

- Create: `D:/Projects/myself/weekly-us-api/supabase/migrations/20260903120000_add_meeting_check_in_completed.sql`
- Modify: `D:/Projects/myself/weekly-us-api/src/modules/meetings/meetings.schema.ts:131-175`
- Modify: `D:/Projects/myself/weekly-us-api/src/modules/meetings/meetings.repository.ts:1-215`
- Modify: `D:/Projects/myself/weekly-us-api/src/modules/meetings/meetings.service.ts:239-292`
- Test: `D:/Projects/myself/weekly-us-api/tests/meetings.service.test.ts`

**Interfaces:**

- Consumes: frontend payloads that may omit `checkInCompleted` during a rolling upgrade.
- Produces: every normalized `MeetingDto` has `checkInCompleted: boolean`; persisted records expose `check_in_completed`.

- [ ] **Step 1: Write failing service tests for the default and round-trip behavior**

Add a test payload with `checkInCompleted: true` and assert the repository input and returned sync meeting retain `true`. Add a legacy request fixture omitting the property and assert the service treats it as `false` rather than rejecting it.

```ts
expect(insertMeeting).toHaveBeenCalledWith(
  expect.objectContaining({ checkInCompleted: true })
);
expect(response.meetings[0]).toMatchObject({ checkInCompleted: true });
```

- [ ] **Step 2: Run the focused API test before implementation**

Run: `npm test -- meetings.service.test.ts`

Expected: FAIL because `checkInCompleted` is absent from the DTO and repository input.

- [ ] **Step 3: Add the backward-compatible schema, migration, repository, and snapshot changes**

Create an additive migration with a non-null default:

```sql
alter table public.meetings
  add column check_in_completed boolean not null default false;
```

Define the schema field with a default so old clients remain valid:

```ts
checkInCompleted: z.boolean().default(false),
```

Add `check_in_completed` to the repository select list, row type, API mapping, insert payload, and conditional update payload. Extend `UpsertMeetingInput`, `meetingToUpsertInput`, `persistedMeetingSnapshot`, and `serverMeetingSnapshot` with `checkInCompleted` so a phase change increments the existing server revision.

- [ ] **Step 4: Run the focused API test after implementation**

Run: `npm test -- meetings.service.test.ts`

Expected: PASS with both explicit `true` and omitted legacy values covered.

- [ ] **Step 5: Verify API types**

Run: `npm run typecheck`

Expected: PASS with all repository DTOs and test fixtures updated.

- [ ] **Step 6: Do not commit**

Leave the changes unstaged. A commit can only be created from a user-supplied approved numbered commit list.

## Task 2: Make meeting attendance and phase durable in the frontend

**Files:**

- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/types.ts:134-151`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/meetings.ts:169-180, 305-350, 432-580`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/composables/useMeetingSession.ts:240-320, 500-640, 1072-1141`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/meetingSyncSnapshot.ts:9-52`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/syncDtos.ts:47-59`
- Test: `D:/Projects/myself/weekly-us/src/app/stores/__tests__/meetings.test.ts`
- Test: `D:/Projects/myself/weekly-us/src/features/meeting/composables/__tests__/useMeetingSession.test.ts`

**Interfaces:**

- Consumes: normalized API/storage meetings with optional legacy `checkInCompleted`.
- Produces: `Meeting.checkInCompleted: boolean` and a store action that changes the phase without changing selected IDs.

- [ ] **Step 1: Write the failing frontend tests**

Add store tests proving that resuming a two-person meeting while three household members are active does not add the third person, and that the new phase action preserves selected IDs.

```ts
meetingsStore.resumeMeeting(meeting.id);
expect(meeting.participantIds).toEqual(['participant-1', 'participant-2']);

meetingsStore.setCheckInCompleted(true);
expect(meeting).toMatchObject({
  checkInCompleted: true,
  participantIds: ['participant-1', 'participant-2'],
});
```

Add helper tests that derive the check-in screen from `checkInCompleted`, including `false` at section zero and `true` at section zero.

```ts
expect(isMeetingCheckInStep(createMeeting({ checkInCompleted: false }))).toBe(
  true
);
expect(isMeetingCheckInStep(createMeeting({ checkInCompleted: true }))).toBe(
  false
);
```

- [ ] **Step 2: Run the focused frontend tests before implementation**

Run: `npm test -- src/app/stores/__tests__/meetings.test.ts src/features/meeting/composables/__tests__/useMeetingSession.test.ts`

Expected: FAIL because the property, action, and pure phase helper do not exist.

- [ ] **Step 3: Implement frontend state and phase transitions**

Add `checkInCompleted` to `Meeting`. Set it to `false` in `createDefaultMeeting` and default missing persisted legacy values to `false` in `normalizeMeeting`.

Delete `syncMeetingParticipants`; remove its calls from `ensureActiveMeeting`, `resumeMeeting`, and `syncActiveMeetingParticipants`. Keep `getActiveParticipantIds()` only for creating a new meeting. Add a narrow store action:

```ts
setCheckInCompleted(checkInCompleted: boolean) {
  const meeting = this.activeMeeting;
  if (!meeting || meeting.status === 'completed') return;
  meeting.checkInCompleted = checkInCompleted;
  meeting.updatedAt = nowIso();
  this.persist();
}
```

Replace `hasStartedRitual` with an exported pure predicate that requires an active, non-completed meeting at section zero with `checkInCompleted === false`. In `startRitual`, first save the selected IDs, then set check-in completed. In `goBack`, when at section zero, set check-in completed to `false`; otherwise retain the normal previous-section navigation.

Add `checkInCompleted` to `meetingSyncContent`. In `fromMeetingDto`, map missing legacy values to `false`:

```ts
checkInCompleted: meeting.checkInCompleted ?? false,
```

- [ ] **Step 4: Run the focused frontend tests after implementation**

Run: `npm test -- src/app/stores/__tests__/meetings.test.ts src/features/meeting/composables/__tests__/useMeetingSession.test.ts`

Expected: PASS. The three-person selection remains unchanged through phase toggles, and an existing meeting is not expanded from the roster.

- [ ] **Step 5: Do not commit**

Leave the changes unstaged. A commit can only be created from a user-supplied approved numbered commit list.

## Task 3: Keep local active-meeting selection during hydration

**Files:**

- Modify: `D:/Projects/myself/weekly-us/src/shared/services/syncService.ts:233-259`
- Test: `D:/Projects/myself/weekly-us/src/shared/services/__tests__/syncService.test.ts`

**Interfaces:**

- Consumes: local `meetingsStore.activeMeetingId` and a backend list response with `activeMeetingId`.
- Produces: a valid local active meeting remains selected when hydration receives a different server-proposed active ID.

- [ ] **Step 1: Write the failing hydration regression test**

Seed a local selected meeting and a list response whose valid `activeMeetingId` is a different server meeting. Invoke the initial `retrySync()` path.

```ts
meetingsStore.meetings = [meeting('local-active'), meeting('server-active')];
meetingsStore.activeMeetingId = 'local-active';
mocks.listMeetings.mockResolvedValueOnce({
  meetings: [meeting('server-active')],
  activeMeetingId: 'server-active',
  draftSavedAt: null,
  syncedAt,
});

await retrySync();
expect(meetingsStore.activeMeetingId).toBe('local-active');
```

- [ ] **Step 2: Run the focused sync test before implementation**

Run: `npm test -- src/shared/services/__tests__/syncService.test.ts`

Expected: FAIL because hydration currently prefers the server response's active meeting ID.

- [ ] **Step 3: Prefer a locally valid active ID during initial list application**

In `applyMeetingsFromBackend`, select a locally active meeting when it is still present in `mergedMeetings`; use the response value only when there is no valid local active ID.

```ts
const activeMeetingId =
  meetingsStore.activeMeetingId &&
  mergedMeetings.some((meeting) => meeting.id === meetingsStore.activeMeetingId)
    ? meetingsStore.activeMeetingId
    : response.activeMeetingId &&
        mergedMeetings.some(
          (meeting) => meeting.id === response.activeMeetingId
        )
      ? response.activeMeetingId
      : null;
```

- [ ] **Step 4: Run the focused sync test after implementation**

Run: `npm test -- src/shared/services/__tests__/syncService.test.ts`

Expected: PASS, including the local-active meeting regression.

- [ ] **Step 5: Do not commit**

Leave the changes unstaged. A commit can only be created from a user-supplied approved numbered commit list.

## Task 4: Run cross-project verification

**Files:**

- Modify: none.

**Interfaces:**

- Consumes: the completed backend migration/API and frontend synced meeting model.
- Produces: verified TypeScript contracts and regression coverage in both projects.

- [ ] **Step 1: Run API checks**

Run in `D:/Projects/myself/weekly-us-api`: `npm run typecheck && npm test`

Expected: PASS.

- [ ] **Step 2: Run frontend checks**

Run in `D:/Projects/myself/weekly-us`: `npm run typecheck && npm test`

Expected: PASS.

- [ ] **Step 3: Run production builds**

Run in each project: `npm run build`

Expected: PASS.

- [ ] **Step 4: Manually test the user flow**

1. Start a meeting with three active participants.
2. Leave all three selected and press Start.
3. Advance one section, then go Back twice to return to check-in.
4. Confirm all three remain selected; deselect one, restart, refresh the page, and confirm the two selected attendees remain unchanged.
5. Add or activate another household participant, return to the meeting, and confirm that the meeting attendee list does not grow automatically.

- [ ] **Step 5: Do not commit**

Leave the changes unstaged. A commit can only be created from a user-supplied approved numbered commit list.
