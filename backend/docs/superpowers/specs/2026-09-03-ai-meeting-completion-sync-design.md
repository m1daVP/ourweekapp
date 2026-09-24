# AI-02: Synchronize Meeting Completion Before AI Generation

Date: 2026-09-03.

Status: implemented in the current backend and mobile working trees; automated verification complete, rollout/manual QA pending.

References: [AI_READINESS_REVIEW.md](../../../AI_READINESS_REVIEW.md), AI-02; [AI_RELEASE_CHECKLIST.md](../../../AI_RELEASE_CHECKLIST.md), step 6.

## Goal

Prevent AI generation from racing meeting completion sync, and prevent a successful AI write from leaving the mobile meeting with a stale server revision.

## Approved product behavior

- Finishing a meeting saves completion locally first.
- AI generation waits for successful backend synchronization of that completed meeting.
- If offline or synchronization fails, the meeting remains completed locally; AI is deferred and the user can retry from the summary screen.
- No background job, polling loop, or automatic retry loop is introduced.
- The API returns authoritative revision/timestamp data with the generated summary. Applying a server result must not create a new local edit.

## Chosen approach

Use client-orchestrated synchronization followed by the existing generation endpoint.

Alternatives considered:

1. A combined finish-and-generate endpoint would duplicate the current sync workflow and couple completion to a long-running request.
2. An asynchronous generation job would add persistence, polling, and recovery machinery beyond this fix.

The selected approach preserves the offline-first model and permits a backend-first, additive API rollout.

## Scope

In scope:

- Automatic generation after Finish and manual generation from the summary/details pages.
- Explicit synchronization acknowledgment before a provider request.
- Additive revision metadata in the AI API response, including cache hits.
- Safe application of server-generated summaries without timestamp/revision drift.
- Optimistic revision checks needed to avoid accepting stale content during this workflow.
- Focused regression tests and OpenAPI updates.

Out of scope:

- P0 provider funding/configuration changes, which the user will handle.
- Free/Premium allowance mapping, historical-summary entitlement gates, provider error taxonomy, model changes, global idempotency, and credit finalization/recovery. These remain separately tracked findings.
- Reworking unrelated synchronization resources or localization work already in progress.
- Database schema changes, deployment, and Git staging/commits/pushes.

## Backend contract

Keep existing request fields `meetingId` and `locale`, and existing response fields `summary`, `disclaimer`, and `generatedAt`.

Add optional request field `expectedServerRevision`: a positive integer representing the completed meeting acknowledged by sync. Older clients may omit it.

Add response field `meetingSync`:

```ts
{
  meetingId: string;
  sourceServerRevision: number;
  serverRevision: number;
  updatedAt: string;
}
```

Rules:

- `meetingId` must match the request and `summary.meetingId`.
- `sourceServerRevision` identifies the loaded meeting snapshot used for generation.
- `serverRevision` and `updatedAt` come from the persisted meeting returned by the database, not from a client clock or the generation start time.
- On a cache hit, return the current loaded meeting's authoritative metadata; no extra write or revision increment occurs.
- If `expectedServerRevision` is present and differs from the loaded meeting, return safe `409 meeting_update_conflict` before a provider call.
- When persisting newly generated output, require the original source revision to still match. Do not re-read the latest revision and silently attach an old result to newer meeting content.
- Preserve workspace filtering, soft-delete handling, completed-meeting validation, and role authorization.
- Preserve other callers of the meeting repository's summary-update method when adding an expected-revision option.

Returning compact metadata avoids a circular dependency between the existing AI summary schema and the full meeting schema.

## Mobile generation workflow

Use one shared coordinator for the three generation entry points so sequencing is not duplicated across pages.

1. Complete the meeting locally when invoked from Finish; retain existing validation and local persistence.
2. Synchronize any participant prerequisites before the meeting, preserving the existing participants-before-meetings dependency.
3. Await acknowledgment of the target completed meeting. An offline/skipped result, partial sync, missing target, or target conflict is not success.
4. Confirm the local target still matches the acknowledged snapshot. If it changed during synchronization, defer generation rather than summarize stale data.
5. Submit `meetingId`, `locale`, and the acknowledged `expectedServerRevision` to the existing AI endpoint.
6. Validate response identity and revision metadata; normalize summary tasks using the existing mobile mapping.
7. Apply the summary and authoritative metadata as remote state only if the local meeting still represents the submitted snapshot.
8. Persist that remote update without replacing `updatedAt` with `nowIso()` or marking the recap itself as a new user edit.

Explicit generation synchronization and the debounced background sync must not race each other for the same meeting state. Reuse or serialize in-flight meeting sync at the shared service boundary. Do not infer acknowledgment from the current timestamp-based merged store alone; use the actual server acknowledgment for the target.

The shared coordinator must treat a thrown sync error, an offline/skipped result, and a target conflict distinctly from a completed synchronization, even when another resource synchronized successfully.

## Concurrent edits and remote-state application

- Capture the submitted meeting's revision and content snapshot before generation.
- If a local edit occurs while AI is in flight, retain it and its original conflict base; do not stamp the edit with the new server revision as if it were acknowledged.
- If a newer server snapshot has already been applied, do not regress its revision or timestamp with an older AI response.
- Preserve genuine sync conflicts. This fix must remove AI-only revision drift, not bypass conflict handling.
- Scope applying remote state narrowly so unrelated user edits are not suppressed by a global sync flag during the provider request.

## Error handling and rollout

- Meeting completion succeeds independently of AI. After sync/offline failure, navigate to the normal summary screen with a recoverable AI-deferred state.
- Manual retry performs the same synchronization checks again before contacting AI.
- A revision conflict does not automatically loop generation. Preserve data and ask the user to resolve/retry after synchronization.
- Keep the existing generation timeout separate from pre-generation synchronization; clear timers on every path.
- Deploy the additive backend response before the updated mobile client.
- During mixed-version rollout, missing `meetingSync` metadata must not cause the client to invent a revision. Reconcile through an authoritative meeting read; if that fails, preserve local data and surface a recoverable sync state.
- Use existing localization keys where they accurately describe the result. If new copy is necessary, make narrowly scoped additions without replacing the user's unrelated localization edits.

## Affected files

Backend:

- `src/modules/ai/ai.schema.ts`: request revision and response sync metadata schemas.
- `src/modules/ai/ai.service.ts`: revision validation, cache metadata, and authoritative success metadata.
- `src/modules/meetings/meetings.repository.ts`: source-revision-aware summary persistence.
- `tests/ai.service.test.ts`, `tests/ai.routes.test.ts`, and relevant repository tests: generation/revision/serialization regressions.
- Generated OpenAPI artifact through the existing generation command.

Mobile (`D:/Projects/myself/weekly-us`):

- `src/shared/api/aiApi.ts`: additive DTO fields.
- `src/features/meeting/aiSummaryService.ts`: common generation orchestration and response validation.
- `src/shared/services/syncService.ts`: target acknowledgment and synchronization coordination.
- `src/app/stores/meetings.ts`: safe remote summary/metadata application.
- `src/features/meeting/composables/useMeetingSession.ts`, `src/pages/MeetingSummaryPage.vue`, `src/pages/MeetingDetailsPage.vue`: use the common workflow.
- Existing AI summary, meeting-session, sync-service, and sync-merge tests; focused store/page tests where needed.

Mobile writes are outside the current backend workspace's writable roots and require filesystem approval when implementation reaches those files.

## Verification

Write failing regression tests before changing runtime behavior. Required cases:

1. Provider generation does not start until the target completion is acknowledged by the server.
2. Unsynchronized participant prerequisites are synchronized first.
3. Offline/skipped sync, thrown failure, partial sync, missing target, and target conflict cause zero provider calls.
4. Local completion survives those failures and manual retry can later succeed.
5. Fresh generation returns persisted revision/timestamp values; cache hits return current metadata without a new write.
6. A stale request revision is rejected before generation; a meeting changed during generation is not overwritten by stale output.
7. Applying an unchanged successful result does not manufacture a local timestamp or dirty edit; the next sync has no AI-only conflict.
8. Local edits during generation and newer remote revisions are preserved rather than falsely acknowledged or overwritten.
9. Manual summary/details generation follows the same ordering as automatic generation.
10. Missing metadata from an older backend uses authoritative reconciliation and never fabricates revision values.
11. Existing workspace/role/completed-meeting checks continue to reject unauthorized or invalid requests.

Backend checks: focused tests, `npm run typecheck`, `npm test`, `npm run build`, and `npm run openapi:check` after regenerating the schema artifact.

Mobile checks: relevant tests, `npm test`, and the explicit app TypeScript check (`node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0` for the current toolchain). Report unrelated existing failures separately.

No funded provider call or production mutation is required to verify sequencing and revision regressions. The eventual funded staging smoke test remains a release gate after P0 is resolved.

## Acceptance

Finish -> acknowledged completion sync -> AI generation -> remote result application -> subsequent sync succeeds without an AI-only conflict. Offline and error paths preserve the completed meeting, and concurrent edits remain protected.

## Implementation result

Completed on 2026-09-03 without a database migration or provider call. The backend adds optional `expectedServerRevision`, guarded summary persistence, and authoritative `meetingSync` response metadata. The mobile app serializes meeting sync, requires target acknowledgment after participant prerequisites, preserves edits made during network requests, centralizes generation/apply behavior, reconciles older backend responses, and uses that coordinator from all three entry points.

Verification:

- Backend: 51 suites and 376 tests passed; typecheck, build, and OpenAPI check passed.
- Mobile: 59 suites and 444 tests passed; production build passed; all AI-02 files pass Prettier.
- Project-wide mobile formatting remains blocked by 16 unrelated pre-existing files.
- Targeted mobile lint reports the pre-existing unused `meetingPreview` at `MeetingDetailsPage.vue:68`; AI-02 introduced no additional lint result.
- Explicit `tsconfig.app.json` checking continues to report the pre-existing application type-error baseline, including the separately tracked `assistantRecap` defect; the normal production build passes.
- Not run: funded OpenAI call, database migration test (none required), deployment, or real-device/slow-network QA.
