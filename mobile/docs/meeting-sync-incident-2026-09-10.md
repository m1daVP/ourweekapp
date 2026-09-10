# Meeting completion / AI sync incident investigation — 2026-09-10

## Conclusion and scope

Two defects are reproducible in the current mobile source: losing the acknowledged server revision during an in-flight edit, and overwriting unsynced completed meeting contents during cloud hydration. Together they provide a plausible explanation for the reported repeated AI sync error, completed meeting reverting to a draft, and surviving standalone tasks. The exact Android incident is not confirmed: the installed binary, device storage, production meeting row, and request logs were not inspected. Current working files include unrelated ongoing meeting edits; none were altered by this investigation.

## Confirmed defect 1: acknowledged revision is discarded

In src/shared/services/syncService.ts, performMeetingSync returns the current local meeting unchanged when it differs from the submitted snapshot (around line 461). This protects content but also discards the successfully acknowledged serverRevision.

Reproduction: upload draft revision 1; complete/edit locally while the request is pending; server accepts the draft as revision 2. Local completion remains at revision 1. Both subsequent AI attempts submit revision 1 and receive a conflict. Backend src/modules/meetings/meetings.service.ts checks revision equality in hasServerConflict and rejects the stale write. The client retains revision 1 on conflict, with no reconciliation in this path, so retry alone does not resolve it. The existing concurrent-edit test even expects revision 2 to remain when revision 3 was acknowledged.

AI generation calls syncCompletedMeetingForAi first. A sync failure can prevent the AI provider request entirely. The user-facing syncRequired error combines several causes, so the displayed message alone cannot identify which one occurred.

## Confirmed defect 2: hydration can erase unsynced completion/content

applyMeetingsFromBackend (syncService.ts around line 233) calls generic mergeSyncItems without protecting locally dirty or conflicted meetings. syncMergeService.ts chooses the entire remote record when its timestamp is greater. It does not compare server revisions or preserve a local completed state/content. The replacement is immediately persisted.

Reproduction: local completed meeting with a note, task and agreement; cloud response containing the same ID as an empty draft with a later updatedAt. retrySync performs hydration and the local record becomes the empty draft. The standalone task and agreement survive.

Hydration runs before pushing in retrySync when initial hydration is incomplete. Sync session preparation resets that flag, including for the same owner; concurrent hydration is also not serialized with the meeting upload queue. Ordinary navigation alone does not necessarily reload cloud data, so the precise reload/session timing on the phone remains unverified.

The database's meetings_set_updated_at trigger sets updated_at to server now() on updates. Therefore a later timestamp does not establish that remote content includes later local edits. A server processing delay or phone/server clock difference can make an older-content record win this comparison.

## Why tasks survive, and possible recovery

src/app/stores/tasks.ts syncFromMeetings copies meeting tasks AND agreements into independent store arrays. It does not remove those copies when a meeting subsequently has empty sections. Missing agreements on the meeting screen may therefore still exist in local task-store agreements or backend agreements, identifiable by sourceMeetingId. Notes exist inside meeting sections and have no equivalent standalone copy in this path.

storageService.ts ensureFirstSyncBackup creates a backup only once, not before each destructive merge. It may predate this meeting. Other existing backup records may help, but recoverability is not established.

Preserve device app storage before further sync, logout, clearing data or reinstalling. Recovery investigation should inspect the affected meeting ID in the local meetings slice, standalone tasks/agreements, existing ourweek:app-data:backup records, and workspace-scoped backend rows. If notes never reached a retained copy, current code provides no automatic reconstruction.

## Verification

Ran a temporary Vitest investigation suite using the existing syncService mocks plus two incident reproductions. All 28 tests passed: 26 existing tests and two assertions demonstrating the defective behavior. These tests used mocked API responses, real sync/store logic, and a spy verifying the empty draft was persisted; they were not a live database or Android test. The temporary suite was removed afterward. No runtime source was changed, and full build/typecheck suites were not run for this investigation-only artifact.

## Remediation direction

1. Track acknowledged upload bases separately from newer local content; advance the base only when the response actually acknowledges the submitted content and has no conflict. Preserve newer edits for a subsequent upload.
2. Make hydration and upload merging consistently protect unsynced/conflicted records. Do not resolve divergent meeting contents solely by wall-clock timestamps. Retain both versions for unresolved conflicts.
3. Serialize/deduplicate hydration appropriately with uploads and guard session ownership for in-flight responses.
4. Persist a recoverable copy before replacing divergent user content; expose actionable conflict recovery instead of an endless AI retry.
5. Add permanent regression tests for in-flight draft creation/update, repeated AI retry, delayed hydration, restart after conflict, and preservation of notes/tasks/agreements. Validate on Android with delayed networking.

## Fix implemented on 2026-09-10

The investigation above describes the pre-fix behavior. The mobile app now stores acknowledged meeting content/revisions and pending uploads durably in sync metadata. Hydration and uploads share a queue, reject results from older sessions, and preserve local changes plus recovery copies of divergent remote versions. Content and its sync metadata are written atomically; failed persistence prevents applying the remote merge. Existing rows are synchronized using revisions rather than a resource-wide timestamp fallback.

AI preflight repairs identical-content revision conflicts and retries once after an acknowledged concurrent edit or recognized lost response. A genuinely divergent legacy meeting without an acknowledged base is retained and blocked from unsafe overwrite; this is not a promise to automatically reconcile conflicting edits. Recovery versions are retained internally in sync metadata. No recovery UI or restoration of already-lost incident notes is included.

Changes are in meetingSyncMerge.ts, meetingSyncSnapshot.ts, meetingsApi.ts, syncService.ts, syncRuntimeService.ts, storageService.ts, and their focused tests. No backend code, database schema or production data changed.

Android release verification: install an updated build without clearing existing storage; finish a weekly meeting containing notes, agreements and tasks while requests are delayed; generate the AI recap; revisit history; restart; verify completed content and recap remain. Repeat with offline edits and a dropped upload response, then reconnect. Verify the second device receives an acknowledged meeting update. Inspect true conflicts separately; both versions must remain available in storage rather than silently overwriting either.

## Final validation

- `npm test`: 83 files, 636 tests passed, including the new incident regressions.
- `npm run build`: passed, including both TypeScript checks. Vite reports its existing large-chunk warning.
- `npm run format:check`: passed.
- ESLint on all changed sync files: passed.
- `npm run check`: formatting passed, but repository-wide lint failed on the existing unused `formatDate` at `src/features/auth/components/AccountSettingsSection.vue:50`. That file has no working diff and was not modified.
- `git diff --check`: passed.
- No Android device test, signed build, deployment, commit, or production recovery was performed.
