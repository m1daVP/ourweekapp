# Weekly Meeting UX Redesign Implementation Plan

**Goal:** Deliver the conversation-led meeting experience defined in [the UX specification](../../weekly-meeting-flow-ux-redesign-spec.md), with simpler capture, understandable outcomes, reliable recovery, and a usable finish.

**Architecture:** Keep existing meeting sections, notes, tasks, agreements, stores, and sync services. Add presentation metadata and focused meeting components; make persistence results observable before connecting the new composers and navigation. Use existing backend contracts where they already support the intended behavior.

**Tech stack:** Vue 3, TypeScript, Pinia, vue-i18n, Capacitor, Vitest; Fastify, Zod, and Supabase for affected API contracts. Use existing npm scripts and dependencies.

**Status:** Planning only. No implementation, deployment, or Git commits are authorized by this document. Checkboxes track future implementation work. Execute milestones in order; no special execution skill or subagent setup is required.

## 1. Boundaries and implementation rules

- Target the mobile app, Android first, with iOS-compatible behavior.
- Use note, task, and agreement as the first-release types. Plans remain contextual notes; dedicated follow-ups and structured events are deferred.
- Preserve record IDs, source sections, historical attribution, task carry-forward, permissions, and existing integration settings.
- New creation rules must never hide historical content of another type.
- Do not remove Save draft until local success/failure is observable and recoverable.
- Keep drafts local and separate from submitted content, sync, export, recap, and AI input.
- No new framework, generic form engine, unified item table, analytics SDK, or background-job system.
- Do not edit applied migrations. A database migration is conditional on an actual schema constraint found during implementation.
- Every UI milestone includes its own loading/error states, translations, and accessibility work. Final QA verifies these; it does not postpone them.
- Make focused changes to existing large modules. Extract only the responsibilities this redesign needs.
- Re-read applicable AGENTS.md instructions and current working-tree changes before implementation. At planning time, MeetingSectionStep.vue and main.css already have user changes; the backend also has unrelated edits.

## 2. What the code already tells us

| Finding                                                                         | Implementation consequence                                                                         |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Frontend MeetingNote requires participantId, and addNote/updateNote validate it | Shared notes require changes across frontend types, store validation, rendering, and serialization |
| Backend meetingSectionNoteSchema already makes participantId optional           | Test existing compatibility first; do not assume a migration or new endpoint is needed             |
| persistAppData catches write failures and writeStorageSlice returns no result   | A store mutation cannot currently serve as proof of durable saving                                 |
| Store finishMeeting and session finishMeeting both reject empty meetings        | Change both guards and verify API sync of completed empty records                                  |
| Session completion awaits optional recap generation before routing              | Separate recorded completion/navigation from optional AI work                                      |
| Existing MeetingReviewCloseStep and recap pages already exist                   | Evolve them rather than building a second recap system                                             |

These are source observations, not a baseline test result. Run the checks below when implementation begins.

## 3. Milestone sequence

| Milestone | Result                                                   | Depends on | Relative size |
| --------- | -------------------------------------------------------- | ---------- | ------------- |
| M0        | Baseline and compatibility fixtures                      | None       | Small         |
| M1        | Shared notes survive local/API round trips               | M0         | Medium        |
| M2        | Observable persistence and recoverable composer drafts   | M0         | Large         |
| M3        | Template presentation rules and reusable capture UI      | M1, M2     | Large         |
| M4        | Integrated conversation flow and safe navigation         | M3         | Medium        |
| M5        | Final review, empty completion, immediate recorded recap | M4         | Large         |
| M6        | Regression, device QA, and usability release gate        | M1–M5      | Medium        |

Recommended execution is M0 → M1 → M2 → M3 → M4 → M5 → M6. M1 and M2 are logically independent, but both touch core frontend state; sequential work avoids overlapping edits.

Each milestone is a reviewable checkpoint, not necessarily a separately releasable mobile build. Release the complete experience after M6. If a backend compatibility change proves necessary, deploy its backward-compatible expansion before the client starts relying on it.

## 4. File ownership map

Paths below are relative to either frontend **D:/Projects/myself/weekly-us** or backend **D:/Projects/myself/weekly-us-api**. Proposed new files are labeled explicitly.

| Responsibility        | Existing frontend files                                                                                              | Proposed additions                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Presentation metadata | src/features/meeting/meetingTemplates.ts; types.ts                                                                   | src/features/meeting/meetingPresentation.ts                                                           |
| Local save results    | src/shared/services/storageService.ts; src/app/stores/meetings.ts; tasks.ts                                          | None unless a focused helper is needed                                                                |
| Draft lifecycle       | storageService.ts; src/app/stores/auth.ts                                                                            | src/features/meeting/composables/useMeetingComposer.ts; src/features/meeting/meetingComposerDrafts.ts |
| Capture and cards     | src/features/meeting/components/MeetingSectionStep.vue                                                               | MeetingItemComposer.vue; MeetingItemCard.vue in the same components directory                         |
| Session orchestration | src/features/meeting/composables/useMeetingSession.ts; src/pages/MeetingPage.vue                                     | None by default                                                                                       |
| Review and recap      | src/features/meeting/components/MeetingReviewCloseStep.vue; src/pages/MeetingSummaryPage.vue; MeetingDetailsPage.vue | None by default                                                                                       |
| UI primitives         | src/shared/components/BaseBottomSheet.vue; BaseDialog.vue; ActionMenuPopup.vue; SyncStatusNotice.vue                 | Reuse existing primitives                                                                             |
| Copy and style        | src/features/localization/messages.ts; src/styles/main.css                                                           | Prefer scoped component styles                                                                        |

Backend inspection/change points are src/modules/meetings/meetings.schema.ts, meetings.service.ts, meetings.repository.ts, meetings.routes.ts; tests/meetings.service.test.ts and tests/api-contract.routes.test.ts. Only modify the API implementation where compatibility tests show a gap.

## M0. Establish a reproducible baseline

**Deliverable:** Existing behavior and fixtures are understood before changing persistence or the meeting lifecycle.

- [ ] Read current diffs for overlapping frontend files and record which changes belong to the user.
- [ ] Run frontend npm test, npm run build, and npm run check. Run backend npm run typecheck and npm test. Record pre-existing failures separately from redesign regressions.
- [ ] Reuse src/features/meeting/**tests**/recapFixtures.ts to prepare fixtures for an attributed legacy note, a shared note, an empty meeting, a carried-forward task, and a completed meeting.
- [ ] Inspect src/features/meeting/meetingSyncMerge.ts, meetingSyncSnapshot.ts, src/shared/api/syncDtos.ts, src/shared/services/syncService.ts, and storage normalization for assumptions about attribution and completion.
- [ ] Capture the current device/browser flow for adding, backing out, pausing, resuming, and finishing. Use fictional content only.

**Exit check:** The implementer can identify the write boundary, both empty-content guards, existing overlay behavior, and the active user changes. Baseline failures have an explicit record in the implementation handoff.

## M1. Make shared notes compatible end to end

**Deliverable:** A note without attribution is a valid record, while historical attribution and authorization stay intact.

**Modify:** src/features/meeting/types.ts; src/app/stores/meetings.ts; src/features/meeting/meetingSyncSnapshot.ts; src/features/meeting/meetingSyncMerge.ts; src/shared/services/storageService.ts; affected note renderers and export/recap consumers.

**Tests:** src/app/stores/**tests**/meetings.test.ts; src/features/meeting/**tests**/meetingSyncMerge.test.ts; src/shared/services/**tests**/storageService.test.ts; tests/contract/apiContract.test.ts. Backend: tests/meetings.service.test.ts; tests/api-contract.routes.test.ts.

- [ ] Add regressions for adding a shared note, editing an attributed note without losing attribution, rejecting a supplied participant outside the meeting, and preserving attribution across sync.
- [ ] Make frontend attribution optional using participantId?: string. Omit it for shared notes; do not use an empty string, null, or a fabricated participant as the wire representation.
- [ ] Change store validation to check participant membership only when an attribution is provided. Preserve historical attribution when unrelated fields are edited; clearing attribution must be explicit.
- [ ] Update normalization, snapshots, merge comparison, recap, export, and display fallbacks to accept absent attribution without relabeling it as an unknown person.
- [ ] Verify backend create/update/read round trips for omitted participantId and legacy attributed notes. Preserve workspace ownership checks and rejection of invalid supplied participants.
- [ ] Verify older-client fixtures can read and resubmit shared notes without inventing attribution or dropping content. If they cannot, record the incompatible version and establish a supported-client release gate before enabling shared-note creation.
- [ ] Change API code/OpenAPI only if these checks demonstrate a gap. Do not add createdByUserId to client payloads as trusted audit identity.

**Exit check:** Shared and attributed notes round-trip through local persistence and API contracts with stable IDs. No database change is required unless an actual incompatible constraint is demonstrated.

## M2. Make saving observable and drafts recoverable

**Deliverable:** UI callers can distinguish a successful local write from a failed one; unsubmitted text survives confirmed draft persistence.

**Modify:** src/shared/services/storageService.ts; src/app/stores/meetings.ts; src/app/stores/tasks.ts where meeting writes also update task/agreement slices; account cleanup in src/app/stores/auth.ts and its existing storage cleanup path.

**Create:** src/features/meeting/meetingComposerDrafts.ts; src/features/meeting/composables/useMeetingComposer.ts.

**Tests:** src/shared/services/**tests**/storageService.test.ts; src/app/stores/**tests**/meetings.test.ts; src/app/stores/**tests**/tasks.test.ts; new src/features/meeting/composables/**tests**/useMeetingComposer.test.ts; relevant auth cleanup tests.

### M2.1. Expose write outcomes

- [ ] Add tests with blocked storage and setItem throwing. A reported saved state must require a successful write; a retry must not duplicate a record.
- [ ] Return a typed local result from the storage write path. Existing callers may initially ignore it; meeting mutation callers must consume it.

```ts
type LocalWriteResult =
  { ok: true } | { ok: false; reason: 'unavailable' | 'write_failed' };
```

- [ ] Keep failed in-memory content recoverable, but do not advance its last-successful-save marker. Retry the same snapshot and stable item ID rather than invoking Add again.
- [ ] For operations touching meeting and task/agreement slices, persist a consistent envelope before acknowledging success. Reuse the existing envelope/sync persistence patterns; prevent one slice succeeding while the other is reported as saved.
- [ ] Make lifecycle callers retain their screen on failure. A failed completion must leave or restore an editable meeting, not strand it with completed permissions.
- [ ] Keep local saving status separate from sync metadata. Do not mark every item synced merely because an earlier sync succeeded.

### M2.2. Retain composer drafts

- [ ] Define a versioned local-only draft entry with scope: user, workspace, meeting, section, capture type, and edited item ID when applicable; include text/fields and updatedAt.
- [ ] Add a dedicated draft slice through the established storage service. Add a version migration that initializes drafts without changing existing meeting records; ensure export and sync use explicit submitted-content projections.
- [ ] Persist typing with a short debounce, for example 300 ms, and flush before dismissal, navigation, pause, and finish. A lifecycle background flush is best effort; do not promise writes after process termination.
- [ ] Give the composer controller load, retain, discard, and submit operations. Draft removal happens only after confirmed item persistence, explicit discard, or account-data cleanup.
- [ ] Cover account switching and logout: drafts from one scope never load into another, and cleanup removes them through the existing privacy policy path.
- [ ] Cover submission succeeding but draft cleanup failing: retain submission identity so reopening/retrying cannot create a duplicate item. Editing a record that changed since the draft was saved must use existing conflict handling rather than silently replace it.

**Exit check:** Storage failure, dismissal, restart, retry, logout, and duplicate-submission scenarios pass. Saving is truthful even while offline. Nothing from the draft slice reaches sync, export, or AI input.

## M3. Build presentation rules and capture components

**Deliverable:** The new interaction works in focused component tests before replacing the active page flow.

**Create:** src/features/meeting/meetingPresentation.ts; src/features/meeting/components/MeetingItemComposer.vue; MeetingItemCard.vue; colocated tests for each.

**Modify:** meetingTemplates.ts; localization/messages.ts; BaseBottomSheet.vue only if its existing behavior cannot satisfy the composer requirements.

### M3.1. Configure each template

- [ ] Implement the spec's SectionPresentation contract beside template definitions. Key configuration by template and section so reused section IDs can differ between templates.
- [ ] Map all existing templates to phases, conversation/review screens, allowed creation types, a primary capture action, and shared/optional attribution. Use the final section of each template as review while retaining its saved content and relevant prompt.
- [ ] Add translated prompts, helpers, optional examples, action labels, draft messages, and save-error copy. Do not derive behavior from translated text.
- [ ] Add tests that each primary type is allowed, each conversation has its action label, every template has a final review, and missing phases are omitted.
- [ ] Preserve the order and stored content of in-progress meetings. For a historical section without current configuration, display its stored prompt/content with safe note capture when editable; never discard it during normalization.

### M3.2. Implement composers and cards

- [ ] Build one focused composer wrapper using BaseBottomSheet and the M2 controller. Use a single note field, task title with optional controls, and one agreement statement.
- [ ] Preserve current unassigned/shared task responsibility options. Do not preselect the person holding the device.
- [ ] Primary Add opens directly; More ways to add shows allowed alternatives and closes before opening the composer.
- [ ] Submit shows local errors inline and collapses only on confirmed success. Dismiss retains the draft; Cancel while editing does not mutate the saved item.
- [ ] Render compact type-specific cards with read-more, accessible menus, existing task completion controls, and Edit/Delete with Undo or confirmation.
- [ ] Add Create task/agreement from note where permitted; prefill editable text, require explicit submission, and retain the original note.
- [ ] Manage keyboard visibility, focus restoration, top-overlay Android back handling, large text, and reduced motion within these components.

**Exit check:** A note takes one tap to open and one field to submit. Tasks save without an owner/date. Alternatives are constrained by section, historical cards remain visible, and failed saves keep entered content accessible.

## M4. Integrate the guided conversation and navigation

**Deliverable:** The real meeting page uses contextual capture and resumes safely.

**Modify:** src/pages/MeetingPage.vue; src/features/meeting/components/MeetingSectionStep.vue; src/features/meeting/composables/useMeetingSession.ts; localized copy and scoped styles.

**Tests:** existing MeetingSectionStep.test.ts and useMeetingSession.test.ts; add page integration coverage if component/session tests do not cover navigation together.

- [ ] Replace persistent forms with question → cards → contextual Add → optional example. Remove repeated author selection and large participant controls from discussion screens.
- [ ] Keep check-in short and existing participant requirements unchanged. Keep unfinished-task review once near the start; continuing without a choice leaves prior tasks untouched.
- [ ] Wire Reflect/Plan/Agree progress from presentation metadata. Count actual discussion/review steps, exclude check-in, and keep progress independent of recorded item count.
- [ ] Wire Back/Next to persist position and permit empty sections. Back from the first discussion returns to check-in without clearing records.
- [ ] Route Close and pause-and-exit through one persistence-aware action. On failure, retain the page; on success, pause and return Home. Keep explicit end-incomplete/delete separate.
- [ ] Display M2 local status and actual existing sync/conflict state. Remove primary Save draft only after these paths work.
- [ ] Keep the add action after cards, restore focus after submission, and avoid pinning headers that crowd small screens. Use Review together before the final step.
- [ ] Exercise shared notes and optional perspective attribution across all templates, including conflict cleanup.

**Exit check:** A real meeting can be started, traversed without recording, populated, paused, and resumed with correct position and drafts. Skipping prior-task review causes no task mutations.

## M5. Finish with useful outcomes and an immediate recap

**Deliverable:** Review edits source records, completion can be empty, and optional AI work cannot hold up the recorded recap.

**Modify:** src/features/meeting/components/MeetingReviewCloseStep.vue; src/features/meeting/composables/useMeetingSession.ts; src/app/stores/meetings.ts; src/pages/MeetingSummaryPage.vue; MeetingDetailsPage.vue if display compatibility requires it.

**Tests:** src/features/meeting/composables/**tests**/meetingRecapCompletion.test.ts; useMeetingSession.test.ts; src/app/stores/**tests**/meetings.test.ts; src/pages/**tests**/MeetingRecapPages.test.ts; backend meeting/contract tests for empty completed sync.

### M5.1. Review source records

- [ ] Render agreements, tasks, and notes grouped by source section; collapse notes initially and omit empty groups.
- [ ] Reuse item editors/cards from M3. Editing in review targets the source ID; new items belong to the final section.
- [ ] Show unassigned responsibility neutrally and keep it optional. Do not infer resolution from tensions or require individual sign-off.
- [ ] Add the accurate empty state and expose Add agreement/task/note as secondary actions.

### M5.2. Complete safely

- [ ] Remove the content-required condition in both session and store. Preserve auth, permission, active-meeting, and idempotency guards.
- [ ] Test and, only if necessary, adjust backend validation so completed empty meetings survive create/update/read sync. Do not weaken unrelated request validation.
- [ ] Before Finish, resolve retained drafts through Review drafts or explicit Discard drafts and finish. The review action opens an outstanding draft and returns to review afterward.
- [ ] Flush local writes, mark completion once, and navigate only after confirmed local persistence. Keep the original completion timestamp on repeated calls/retries.
- [ ] On persistence failure, keep final review editable and display Retry. Verify related task/agreement state remains consistent.

### M5.3. Decouple optional AI

- [ ] Navigate immediately to the existing recorded recap after completion. Show local agreements/tasks/notes independently of AI state.
- [ ] Move any remaining AI disclosure and generation interaction to the usable recap. Reuse existing readiness, entitlement, quota, recovery, and disclosure logic.
- [ ] Generate only after an explicit eligible request or previously established consent/settings path. Do not add an automatic watcher that generates on every recap mount.
- [ ] Prevent duplicate generation across navigation/retry and handle in-flight work through the existing generation lifecycle. Empty meetings never trigger AI.
- [ ] Keep AI failure, offline state, and Free access from blocking the recorded recap. Back to Home remains the primary exit; no new calendar or notification actions occur.

**Exit check:** Empty/nonempty, Free/Premium, online/offline, AI failure, draft leftovers, repeated Finish, and local-write failure all produce the specified result. Final-review edits never create summary duplicates.

## M6. Verify and release the complete experience

**Deliverable:** A tested candidate with documented device/usability findings and an explicit compatibility decision.

- [ ] Run the frontend and backend checks listed below once the combined implementation is complete. Fix redesign regressions and record any unrelated baseline failures.
- [ ] Exercise every acceptance scenario in UX spec section 17. Record pass/fail, device/build, and any recovery limitations in a new docs/weekly-meeting-ux-redesign-qa.md.
- [ ] Test a physical Android device: keyboard open, larger text, narrow layout, Android gesture/back, safe areas, app backgrounding, restart, offline saves, and draft recovery. Browser-only results do not satisfy this gate.
- [ ] Test upgrade fixtures with existing attributed notes, shared notes, in-progress templates, carry-forward tasks, and completed history. Confirm sync conflicts and account cleanup retain existing protections.
- [ ] Check all supported locales for missing keys, truncated labels, date/plural formatting, accessible names, and empty-state wording. Verify reduced-motion behavior.
- [ ] Use the spec's approximately five-household usability exercise. Check comprehension of note/task/agreement, independent completion, recovery, and finding outcomes. Record evidence, not assumed engagement gains.
- [ ] If API/schema changes were required, verify the older/newer client matrix and apply only the necessary backward-compatible backend changes before releasing the mobile build. Test migrations locally and in staging if any exist.
- [ ] Document recovery: retain compatible backend additions; never roll back to a client that cannot read new records/draft storage without a tested compatibility path. Prefer a forward fix when persisted data has changed.

**Release gate:** No unresolved loss of confirmed saved content, false save-success state, cross-account draft exposure, duplicate completion/submission, or blocked core recap. Usability issues that prevent the core tasks are fixed before release.

## 5. Verification commands

Run in the stated repository. These are implementation instructions; they were not run as part of writing this plan.

### Frontend

Use targeted tests while developing, for example:

```sh
npm test -- src/shared/services/__tests__/storageService.test.ts
npm test -- src/app/stores/__tests__/meetings.test.ts
npm test -- src/features/meeting/composables/__tests__/useMeetingSession.test.ts
npm test -- src/features/meeting/composables/__tests__/meetingRecapCompletion.test.ts
```

Final checks:

```sh
npm test
npm run build
npm run check
```

After web checks, prepare the existing Android project for device QA:

```sh
npm run cap:sync
npm run cap:open
```

Use the current package script cap:open; older project prose refers to cap:open:android, which is not present in the inspected package.json.

### Backend

```sh
npm run typecheck
npm test
npm run openapi:check
```

Run npm run openapi:generate only if the public schema changed, then review docs/openapi.json and the frontend contract fixture impact. Run npm run build for deployment-oriented changes.

If a migration is actually necessary, use npm run db:migrate:local and npm run db:verify:local against the local database. Do not use the unqualified db:migrate script as a local test; it runs supabase db push.

## 6. Spec coverage and deferred work

| UX requirements                                                   | Milestones |
| ----------------------------------------------------------------- | ---------- |
| Shared notes and historical attribution                           | M1         |
| Autosave, drafts, interruption, duplicate prevention              | M2, M4, M5 |
| Contextual actions, cards, examples, meaningful type differences  | M3, M4     |
| Template-aware progress, check-in, previous-task review, skipping | M3, M4     |
| Outcome review, empty completion, optional AI, recorded recap     | M5         |
| Mobile accessibility and localization                             | M3–M6      |
| Contract/storage compatibility and privacy                        | M1, M2, M6 |
| Usability evidence and release acceptance                         | M6         |

Dedicated follow-up entities, structured plans, cross-section outcome links, custom agendas, real-time co-editing, gamification, and new integrations require separate future scope. They are not prerequisites for completing these milestones.

For each completed milestone, record files changed, behavior delivered, checks performed, remaining risks, and the next dependency. Git staging/committing and deployment require the user's separate authorization.
