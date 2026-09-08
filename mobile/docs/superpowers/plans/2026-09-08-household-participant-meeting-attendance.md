# Household Participant Meeting Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove calls to a nonexistent meetings-store action while preserving explicit active-meeting attendance during household participant creation and re-enabling.

**Architecture:** Household participant mutations remain owned by the participants store. Active-meeting attendance remains owned by the meeting check-in flow and its existing `setActiveMeetingParticipants` action; household settings will not synchronize attendance automatically.

**Tech Stack:** Vue 3, Pinia 4, TypeScript 6, Vue Test Utils, Vitest 4.

## Global Constraints

- Do not add or restore `syncActiveMeetingParticipants`.
- Do not replace the stale calls with `setActiveMeetingParticipants`.
- Creating or re-enabling a participant must not change `activeMeeting.participantIds`.
- Preserve existing permission, invitation, editor-reset, and sheet-close behavior.
- Do not add dependencies, API changes, migrations, or localization text.
- Do not stage or commit files without an explicit user request.

---

### Task 1: Remove The Invalid Meetings-Store Calls

**Files:**
- Modify: `src/features/participants/components/HouseholdMembersSettings.vue`

**Interfaces:**
- Consumes: `participantsStore.createParticipant(payload)`
- Consumes: `participantsStore.enableParticipant(participantId)`
- Removes all component use of `meetingsStore`

- [ ] **Step 1: Confirm the current TypeScript failure**

Run:

```bash
npx vue-tsc --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0
```

Expected before the fix: diagnostics identify `syncActiveMeetingParticipants` as missing from the meetings store. Record other pre-existing diagnostics separately.

- [ ] **Step 2: Remove the two stale calls**

Delete only these statements from the successful create and enable paths:

```ts
meetingsStore.syncActiveMeetingParticipants();
```

If `meetingsStore` is unused afterward, remove its `useMeetingsStore` import and local store initialization. Do not alter participant or invitation sequencing.

- [ ] **Step 3: Re-run the explicit app typecheck**

Run the command from Step 1. Expected: no `syncActiveMeetingParticipants` diagnostic remains. Any unrelated baseline diagnostics must not be bypassed with casts or configuration changes.

---

### Task 2: Replace The Masking Test With Attendance Regression Coverage

**Files:**
- Modify: `src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts`
- Test against: `src/app/stores/participants.ts`
- Test against: `src/app/stores/meetings.ts`

**Interfaces:**
- Uses real Pinia stores through `createPinia()` and `setActivePinia()`.
- Uses `meetingsStore.startNewMeeting()` to create active attendance state.
- Uses the component's existing create and enable UI controls.

- [ ] **Step 1: Remove the fabricated meetings-store action**

Delete this mock contract:

```ts
vi.mock('@/app/stores/meetings', () => ({
  useMeetingsStore: () => ({ syncActiveMeetingParticipants: vi.fn() }),
}));
```

Use a real Pinia instance in `beforeEach`. Mock storage boundaries if required so tests remain isolated, but do not mock the participants or meetings action interfaces being exercised.

- [ ] **Step 2: Add creation coverage with an active meeting**

Seed active participants, start a meeting, and save its initial `participantIds`. Use the component's Add person flow to create another participant. Assert:

```ts
expect(participantsStore.participants).toContainEqual(
  expect.objectContaining({ name: 'New person', isActive: true })
);
expect(meetingsStore.activeMeeting?.participantIds).toEqual(initialAttendance);
```

Also assert the component reaches its existing success or invitation step rather than throwing.

- [ ] **Step 3: Add re-enable coverage for a participant absent from attendance**

Create and disable a participant after the active meeting attendance is saved. Trigger the component's re-enable action and assert the participant becomes active while `participantIds` remains exactly equal to the initial attendance.

- [ ] **Step 4: Add re-enable coverage for a participant already saved in attendance**

Start a meeting containing the participant, disable that participant, and verify the existing active-meeting participant computation excludes them. Re-enable through household settings and assert the saved ID was never removed or rewritten and the participant becomes available again through the existing active filtering.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts src/features/meeting/composables/__tests__/useMeetingSession.test.ts
```

Expected: all tests pass, with no test mock defining `syncActiveMeetingParticipants`.

---

### Task 3: Complete Release Verification

**Files:**
- Verify: `src/features/participants/components/HouseholdMembersSettings.vue`
- Verify: `src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts`

- [ ] **Step 1: Check formatting and lint**

Run:

```bash
npx prettier --check src/features/participants/components/HouseholdMembersSettings.vue src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts
npx eslint src/features/participants/components/HouseholdMembersSettings.vue src/features/participants/components/__tests__/HouseholdMembersSettings.test.ts
```

Expected: both commands pass.

- [ ] **Step 2: Run the full mobile suite and build**

Run:

```bash
npm test
npm run build
```

Expected: the full test suite and Vue/Vite production build pass. Existing unrelated Vite warnings may remain.

- [ ] **Step 3: Review the final diff**

Verify `rg "syncActiveMeetingParticipants" src` returns no matches, active attendance changes only through the existing meeting flow, and unrelated working-tree changes remain untouched.

