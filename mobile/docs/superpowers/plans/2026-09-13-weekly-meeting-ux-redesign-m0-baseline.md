# Weekly Meeting UX Redesign — M0 Baseline Record

**Recorded:** 2026-09-13

This record captures the implementation starting point for the weekly-meeting
UX redesign. It does not change product behavior.

## Active worktree changes preserved

- `src/features/meeting/components/MeetingSectionStep.vue` comments out the
  existing section-level **Save draft** button.
- `src/styles/main.css` changes the section action layout from three to two
  columns and comments out the former two-button grid rule.
- `docs/weekly-meeting-flow-ux-redesign-spec.md` and
  `docs/superpowers/plans/2026-09-13-weekly-meeting-ux-redesign.md` are new,
  untracked redesign documents.

M0 does not alter those changes. The baseline fixture update is limited to
`src/features/meeting/__tests__/recapFixtures.ts`.

## Reusable compatibility fixtures

`recapFixtures.ts` now exports:

- `legacyAttributedNoteFixture()` for the current, attributed note shape.
- `sharedNoteFixture()` for the intended no-`participantId` wire shape. It is
  deliberately typed as `Omit<MeetingNote, 'participantId'>` until M1 changes
  the application model.
- `carriedForwardTaskFixture()` for a task with a stable
  `carriedFromTaskId`.
- `emptyMeetingFixture()` for an in-progress meeting with no saved content.
- `meetingFixture()` remains the completed-meeting fixture used by recap tests.

## Persistence and sync boundary

- Frontend meeting mutations call `writeStorageSlice('meetings', ...)` through
  `useMeetingsStore.persist()`.
- `writeStorageSlice` updates the in-memory envelope and calls
  `persistAppData`.
- `persistAppData` catches unavailable storage and `setItem` failures, records
  a recovery message, and returns no success/failure value to the caller.
- Therefore current mutation callers cannot truthfully distinguish an in-memory
  update from a durable local write. M2 must introduce an explicit local write
  result before replacing Save draft with autosave messaging.
- Meeting sync snapshots include `participantId` only through `compact`; the
  backend meeting schema already accepts an omitted note `participantId` and
  checks it only when present. M1 must update the frontend type, store
  validation, normalization, and tests to match that contract.

## Lifecycle guards and overlays

- Empty completion is blocked twice: `useMeetingSession.finishMeeting()` checks
  `hasMeetingContent`, then `useMeetingsStore.finishMeeting()` checks
  `meetingHasContent`. M5 must remove or replace both guards together.
- `closeMeeting()` currently routes directly Home; pause and exit are not yet
  persistence-aware.
- `BaseBottomSheet` closes the topmost sheet through Escape, its scrim, close
  control, and the registered Android back handler. Composer drafts do not yet
  exist, so dismissal currently cannot retain partial text.
- Completion marks the meeting completed before the optional AI recap
  disclosure/generation branch; the recap route is reached only after that
  branch completes. M5 must route to the recorded recap independently of
  optional AI work.

## Verification results

| Check                                             | Result                                                                                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Frontend `npm test`                               | Passed: 84 files, 645 tests                                                                                                      |
| Frontend `npm run build`                          | Passed; existing Vite warning reports a chunk above 500 kB                                                                       |
| Frontend `npm run check`                          | Passed: Prettier and ESLint                                                                                                      |
| Frontend fixture-focused tests                    | Passed: 3 files, 14 tests                                                                                                        |
| Frontend `npm run typecheck` after fixture update | Passed                                                                                                                           |
| Backend `npm run typecheck`                       | Passed                                                                                                                           |
| Backend `npm test`                                | Does not complete cleanly: the workspace-ownership integration file reports 3 failures before the suite stops reporting progress |

The backend failures are all in
`tests/database-workspace-ownership.integration.test.ts` before any redesign
code changed. Each fails at the database fixture's **user-a user creation**
operation. Treat this as a test-environment or database-fixture blocker, not a
weekly-meeting regression, until a separate backend investigation proves
otherwise.

## Manual browser/device capture

The local app opens at `/welcome` and requires an existing account before the
meeting flow is reachable. No test account or user data was supplied, so this
baseline intentionally did not create or modify an account. M4/M6 still need a
fictional-content device pass covering add, dismiss, pause, resume, and finish.

## M1 handoff

Start by changing `MeetingNote.participantId` to optional, then update the
meeting store's add/edit validation to validate participant membership only when
attribution is supplied. Use the shared and legacy fixtures above for local,
sync, and API round-trip coverage. Preserve historical attribution and omit an
absent value from serialized payloads.
