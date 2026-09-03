# AI-02 Sync Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

The named execution skills are unavailable in this session. Execute inline using the test-first steps below. The user already requested implementation and approved [the design](../specs/2026-09-03-ai-meeting-completion-sync-design.md). No further design approval or Git commit is required.

**Goal:** Synchronize completed meetings before AI calls and apply authoritative AI revision metadata without losing concurrent edits.

**Architecture:** Keep the existing sync and AI endpoints. Add revision guards/metadata to the backend; centralize mobile preflight sync and remote result application. Coordinate meeting sync operations and preserve immutable submitted snapshots for conflict checks.

**Tech Stack:** Node 24, Fastify, TypeScript, Zod, Supabase, Vue 3, Pinia, Vitest.

## Global Constraints

- Finishing a meeting saves completion locally first.
- No background job, polling loop, or automatic retry loop is introduced.
- Preserve workspace filtering, soft-delete handling, completed-meeting validation, and role authorization.
- Backend first, additive API rollout; no database migration or provider/configuration change.
- Preserve existing unrelated changes, particularly mobile localization work.
- No stage, commit, push, production mutation, or funded provider test.
- Request filesystem approval for mobile files outside the backend writable root.

## Task 1: Backend revision contract and guarded persistence

Files: modify `src/modules/ai/ai.schema.ts`, `src/modules/ai/ai.service.ts`, `src/modules/meetings/meetings.repository.ts`; modify `tests/ai.service.test.ts`, `tests/ai.routes.test.ts`; create `tests/meetings.summary-repository.test.ts`.

Interfaces:

```ts
// Additive request field
expectedServerRevision?: number;
// Required on new backend responses
meetingSync: {
  meetingId: string;
  sourceServerRevision: number;
  serverRevision: number;
  updatedAt: string;
};
// Preserve three-argument legacy callers
updateMeetingSummary(workspaceId, meetingId, summary, expectedServerRevision?);
```

- [ ] Add failing service tests using the existing harness:

```ts
const h = createHarness({ meeting: meeting({ serverRevision: 3 }) });
await expect(h.service.generateMeetingSummary(auth, {
  meetingId, expectedServerRevision: 2,
})).rejects.toMatchObject({ code: 'meeting_update_conflict' });
expect(h.provider.generateMeetingSummary).not.toHaveBeenCalled();
expect(h.ai.createSummaryRequest).not.toHaveBeenCalled();
```

- [ ] Test success metadata from an updated row with revision 4 and a database timestamp different from generation time; test cached metadata with no write and a failed optimistic write.
- [ ] Run `npm test -- tests/ai.service.test.ts`; verify the new assertions fail before implementation.
- [ ] Use `serverRevisionSchema` for both request and response fields. Reject a stale supplied revision after scoped meeting lookup. Pass the original loaded revision to persistence.

```ts
if (input.expectedServerRevision !== undefined &&
    input.expectedServerRevision !== meeting.serverRevision) {
  throw new ApiError(409, 'meeting_update_conflict', 'Meeting changed. Please sync and try again.');
}
```

- [ ] In the repository, use the supplied revision directly for the conditional update; only load a revision for legacy callers. Keep workspace/id/deleted filters.
- [ ] Test repository query shape: supplied revision does not cause a latest-row read; `.eq('server_revision', sourceRevision)` and increment `sourceRevision + 1` are present; null update remains a conflict.
- [ ] Test route serialization of `meetingSync` and rejection of zero/fractional revisions. Align stale route test fixtures with current service-owned authorization without removing real service denial tests.
- [ ] Run backend focused tests and typecheck.

## Task 2: Acknowledged, serialized meeting sync

Mobile files: modify `src/shared/services/syncService.ts`; create `src/features/meeting/meetingSyncSnapshot.ts`; extend `src/shared/services/__tests__/syncService.test.ts`.

Interfaces:

```ts
syncCompletedMeetingForAi(meetingId: string): Promise<Meeting>;
meetingSyncContent(meeting: Meeting): string;
```

`meetingSyncContent` projects the persisted meeting fields and nested note/task/agreement fields, excluding client-only nested metadata, summary, revision, and timestamps controlled by sync. Normalize strings and optional fields to the API contract before comparing acknowledged content. Keep a separate immutable full local snapshot to detect edits during each request.

- [ ] Write tests asserting participant sync precedes meeting sync, and that offline/partial/missing/conflicting target results reject preflight.
- [ ] Test timestamp skew: matching acknowledged content takes the authoritative revision even if the client clock is ahead; an edit made while sync is pending is never overwritten.
- [ ] Test two overlapping meeting sync requests serialize and read the latest store state when their turn starts.
- [ ] Run the focused sync tests and observe the new failures.
- [ ] Queue meeting sync operations at the shared boundary and expose the actual remote acknowledgment to the target preflight, not just merged store data.

```ts
let meetingSyncQueue: Promise<unknown> = Promise.resolve();
function queueMeetingSync<T>(operation: () => Promise<T>): Promise<T> {
  const result = meetingSyncQueue.then(operation, operation);
  meetingSyncQueue = result.catch(() => undefined);
  return result;
}
```

- [ ] Preflight participant prerequisites, reject skipped/conflicted results, then synchronize and confirm the target is completed, has a valid revision, and matches submitted content.
- [ ] Limit remote-state suppression to synchronous state application/next Vue tick. Never hold it across the provider call.
- [ ] Rerun sync tests, including existing hydration and unrelated-resource tests.

## Task 3: Shared generation coordinator and safe result application

Mobile files: modify `src/shared/api/aiApi.ts`, `src/features/meeting/aiSummaryService.ts`, `src/app/stores/meetings.ts`; create `src/features/meeting/__tests__/aiGenerationFlow.test.ts`.

Interfaces:

```ts
// Keep public coordinator return value; callers no longer save it again.
generateMeetingSummary(meeting: Meeting): Promise<MeetingSummary>;
// Store action validates identity/snapshot and applies summary + metadata.
applyRemoteAiSummary(source: Meeting, summary: MeetingSummary,
  sync: AiMeetingSyncDto): boolean;
```

- [ ] Add a deferred preflight test proving `generateAiMeetingSummary` is uncalled until acknowledgment resolves.
- [ ] Add tests for sync rejection, response identity mismatch, malformed metadata, local edits in flight, newer remote revisions, and normal application preserving server timestamps.

```ts
expect(generateAiMeetingSummary).not.toHaveBeenCalled();
// After resolving sync preflight:
expect(generateAiMeetingSummary).toHaveBeenCalledWith(
  expect.objectContaining({ expectedServerRevision: 3 }), expect.anything(),
);
expect(store.meetings[0].serverRevision).toBe(4);
expect(store.meetings[0].updatedAt).toBe(serverUpdatedAt);
```

- [ ] Run the new tests to confirm failure, then invoke preflight from the coordinator and send its revision.
- [ ] Validate `meetingSync` identity, positive integer revisions, source revision equality, non-regression, and a valid timestamp before applying.
- [ ] For an older backend without metadata, read authoritative meetings and require matching summary identity/content before applying its real revision. On failure preserve local state and expose retryable synchronization error.
- [ ] Apply with the captured source snapshot only; return false/recoverable conflict if local state changed. Never call `saveAiSummary`, which marks a local edit.
- [ ] Test a successful result followed by synchronization causes no AI-only revision conflict.

## Task 4: Integrate entry points and deferred recovery

Mobile files: modify `src/features/meeting/composables/useMeetingSession.ts`, `src/pages/MeetingSummaryPage.vue`, `src/pages/MeetingDetailsPage.vue`; extend relevant coordinator/session/page tests.

- [ ] Replace each generate-then-local-save pair with a single awaited shared coordinator call.

```ts
await generateMeetingSummary(completedMeeting);
// No meetingsStore.saveAiSummary call: the coordinator applies remote metadata.
```

- [ ] Preserve locally completed status when preflight fails and navigate to the summary screen with recoverable deferred state.
- [ ] Reuse localized sync/offline copy for deferred errors and ensure manual retry repeats preflight. Do not introduce an automatic retry loop.
- [ ] Verify all three callers use the common sequence; existing allowance gates remain outside this AI-02 change.
- [ ] Run focused mobile tests, full tests, app typecheck, build, and check. Report unrelated baseline failures without rewriting unrelated files.

## Task 5: Verify and document completion

- [ ] Regenerate OpenAPI with `npm run openapi:generate`, then run `npm run openapi:check`.
- [ ] Run backend `npm run typecheck`, `npm test`, and `npm run build`.
- [ ] Run mobile `npm test`, explicit app `vue-tsc`, `npm run build`, and `npm run check`.
- [ ] Inspect diffs for unrelated edits, secret exposure, and weakened conflict/ownership guards.
- [ ] Update AI-02 status in the root review/checklist with actual checks, limitations, and rollout order. Do not mark real-device or funded staging checks complete without executing them.

## Plan self-review

The five tasks cover all eleven design verification cases. Source revisions and persisted timestamps use the same `meetingSync` names across API/store tests. Database credit finalization, provider policy, allowance fixes, and unrelated localization remain out of scope.

## Execution result

Tasks 1 through 4 and the automated portions of Task 5 were completed on 2026-09-03. See `AI_02_SYNC_DESIGN.md` for exact results and remaining manual/deployment checks. Checkboxes above remain the implementation recipe rather than being rewritten as a release-signoff record.
