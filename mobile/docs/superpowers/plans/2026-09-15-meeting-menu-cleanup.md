# Meeting Menu Cleanup Implementation Plan

> **For agentic workers:** Execute this plan task-by-task in the current workspace. Steps use checkbox (`- [ ]`) syntax for tracking. Do not create commits unless the user explicitly authorizes them.

**Goal:** Reduce the active meeting overflow menu to Save draft and exit plus Delete meeting, and remove the obsolete menu-only behavior without breaking legacy meeting records.

**Architecture:** Change only the frontend menu composition and remove code made unreachable by that change. Preserve the store's `pauseMeeting()` action because the existing Close control calls it, preserve `resumeMeeting(meetingId)` for reopening unfinished meetings, and preserve `paused`/`incomplete` status types across frontend and backend for persisted-data compatibility.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vue I18n, Vitest

## Global Constraints

- The menu contains exactly Save draft and exit and Delete meeting, in that order.
- The menu contains no divider between its remaining actions.
- The Close control continues to pause and persist the meeting before returning Home.
- The final review Finish action remains unchanged.
- Existing `paused` and `incomplete` records remain valid and resumable.
- Do not modify backend code or database migrations.
- Do not create Git commits without explicit user authorization.

---

### Task 1: Simplify the Meeting Menu and Session API

**Files:**

- Modify: `src/pages/MeetingPage.vue`
- Modify: `src/features/meeting/composables/useMeetingSession.ts`

**Interfaces:**

- Consumes: `saveDraftAndExit()` and `deleteRitual()` through `handleRitualMenuSelect(actionId: string)`.
- Produces: a two-item `ActionMenuItem[]` and a composable return object without menu-only pause/resume or incomplete-session state.

- [ ] **Step 1: Reduce the menu to the two retained actions**

In `MeetingPage.vue`, make `ritualMenuItems` equivalent to:

```ts
const ritualMenuItems = computed<ActionMenuItem[]>(() => [
  {
    id: 'save-draft-exit',
    label: t('meeting.menu.saveDraftExit'),
    icon: 'draft',
    disabled: !canEditMeeting.value,
  },
  {
    id: 'delete-ritual',
    label: t('meeting.menu.deleteRitual'),
    icon: 'delete',
    variant: 'destructive',
    disabled: !canEditMeeting.value || isCompleted.value,
  },
]);
```

Remove `isPaused`, `isEndSessionDialogOpen`, and `confirmEndSessionIncomplete` from the composable destructuring. Remove the End Session `ConfirmationDialog`; retain the Delete meeting dialog.

- [ ] **Step 2: Remove unreachable composable behavior**

In `useMeetingSession.ts`, remove:

- the `isPaused` computed value;
- the menu-only `pauseRitual()` and `resumeRitual()` functions;
- `endSessionIncomplete()` and `confirmEndSessionIncomplete()`;
- `pause-ritual`, `resume-ritual`, and `end-session` branches from `handleRitualMenuSelect`;
- obsolete refs/return properties used only by the removed incomplete-session dialog.

Keep `closeMeeting()` and its call to `meetingsStore.pauseMeeting()` unchanged.

- [ ] **Step 3: Verify removed symbols are absent from the page/session layer**

Run:

```powershell
rg -n "pause-ritual|resume-ritual|end-session|pauseRitual|resumeRitual|confirmEndSessionIncomplete|isEndSessionDialogOpen|isPaused" src/pages/MeetingPage.vue src/features/meeting/composables/useMeetingSession.ts
```

Expected: no matches.

---

### Task 2: Remove Dead Store and Translation Entries

**Files:**

- Modify: `src/app/stores/meetings.ts`
- Modify: `src/features/localization/messages.ts`

**Interfaces:**

- Consumes: the reduced composable API from Task 1.
- Produces: no obsolete `endMeetingIncomplete()` or `resumeActiveMeeting()` store actions and no strings reachable only from removed menu behavior.

- [ ] **Step 1: Remove the unused incomplete-session store action**

Delete `endMeetingIncomplete()` and `resumeActiveMeeting()` from `src/app/stores/meetings.ts`. Keep `saveDraft()`, `pauseMeeting()`, `resumeMeeting(meetingId)`, and `finishMeeting()` because they still support current behavior.

- [ ] **Step 2: Remove obsolete translations in every locale**

From the English, Ukrainian, and Spanish meeting translation objects, remove these keys:

```text
meeting.menu.pauseRitual
meeting.menu.resumeRitual
meeting.menu.endSession
meeting.ritualPaused
meeting.ritualResumed
meeting.pauseRitualFailed
meeting.resumeRitualFailed
meeting.confirmEndSessionTitle
meeting.confirmEndSessionText
meeting.endSessionFailed
```

Retain `meeting.menu.saveDraftExit`, `meeting.menu.deleteRitual`, all delete-dialog strings, and final-completion strings.

- [ ] **Step 3: Verify no dead action or translation references remain**

Run:

```powershell
rg -n "endMeetingIncomplete|resumeActiveMeeting|pauseRitual|resumeRitual|endSession|ritualPaused|ritualResumed|confirmEndSession" src
```

Expected: no matches.

---

### Task 3: Validate Compatibility and Quality

**Files:**

- Verify: `src/features/meeting/types.ts`
- Verify: `src/app/stores/meetings.ts`
- Verify: `src/shared/components/ActionMenuPopup.vue`
- Verify: `src/features/localization/messages.ts`

**Interfaces:**

- Consumes: all source changes from Tasks 1 and 2.
- Produces: a type-safe frontend with unchanged legacy status compatibility.

- [ ] **Step 1: Confirm legacy statuses and Close behavior remain**

Run:

```powershell
rg -n "'paused'|'incomplete'|pauseMeeting\(\)|dividerBefore" src/features/meeting/types.ts src/app/stores/meetings.ts src/features/meeting/composables/useMeetingSession.ts src/shared/components/ActionMenuPopup.vue
```

Expected: status types still include `paused` and `incomplete`; `closeMeeting()` still calls `pauseMeeting()`; the generic menu component may still support `dividerBefore`.

- [ ] **Step 2: Run formatting validation on modified source files**

Run:

```powershell
npx prettier --check src/pages/MeetingPage.vue src/features/meeting/composables/useMeetingSession.ts src/app/stores/meetings.ts src/features/localization/messages.ts
```

Expected: all files pass formatting checks.

- [ ] **Step 3: Run TypeScript validation**

Run:

```powershell
npm run typecheck
```

Expected: both app and Node TypeScript checks pass.

- [ ] **Step 4: Run the frontend test suite**

Run:

```powershell
npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 5: Review the resulting diff**

Confirm the diff changes only the approved spec/plan and the four frontend source files. Verify the overflow menu visually contains two undivided options and that Delete still opens its confirmation dialog.
