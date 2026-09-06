# Soft-deleted meeting task references Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve workspace-owned soft-deleted meetings as valid historical references during task synchronization.

**Architecture:** Extend the task module's local meeting-repository port to expose the existing optional `includeDeleted` argument. The task sync lookup will pass `true`, preserving workspace scoping while accepting a soft-deleted source meeting. Focused service tests will prove task and review-decision sync behavior.

**Tech Stack:** Node.js, TypeScript, Fastify, Vitest, Supabase repository abstraction.

## Global Constraints

- Keep the existing `workspaceId` filter as the authorization boundary.
- Do not alter API request or response schemas.
- Do not add dependencies or database migrations.
- Reject missing and cross-workspace meeting IDs exactly as before.

---

### Task 1: Validate historical meeting references during task sync

**Files:**
- Modify: `src/modules/tasks/tasks.service.ts:58-61,532-550`
- Test: `tests/tasks.service.test.ts`

**Interfaces:**
- Consumes: `MeetingsRepository.findMeetingByIdForWorkspace(workspaceId, meetingId, includeDeleted?)`.
- Produces: task-sync reference validation that resolves a meeting with `includeDeleted: true` while retaining the supplied `workspaceId`.

- [ ] **Step 1: Write the failing tests**

Add a service test that makes the meeting mock return a result only for the
expected ID when its third argument is `true`:

```ts
repos.meetings.findMeetingByIdForWorkspace.mockImplementation(
  async (_workspaceId: string, meetingId: string, includeDeleted?: boolean) => (
    includeDeleted && meetingId === sourceMeetingId ? { id: meetingId, deletedAt: now } : null
  ),
);
```

Call `syncTasks` with `reviewDecisions: []` and a task created by `apiTask()`.
Assert that `insertTask` is called and the lookup receives
`('workspace_1', sourceMeetingId, true)`.

Add a second test using the same mock behavior with a review decision whose
`meetingId` is `reviewMeetingId` and `sourceMeetingId` is `sourceMeetingId`.
Return a soft-deleted result for either expected ID when `includeDeleted` is
true. Assert `createReviewDecision` is called and both lookups include `true`.

- [ ] **Step 2: Run the focused test file to verify the new tests fail**

Run:

```powershell
npm test -- tests/tasks.service.test.ts
```

Expected: the new cases fail because `meetingExists` invokes the repository
with only `workspaceId` and `meetingId`.

- [ ] **Step 3: Implement the minimal reference-lookup change**

Change the local port to mirror the repository's optional third parameter:

```ts
type MeetingRepositoryPort = {
  findMeetingByIdForWorkspace(
    workspaceId: string,
    meetingId: string,
    includeDeleted?: boolean,
  ): Promise<unknown | null>;
};
```

Then call it from `meetingExists` with `true`:

```ts
const meeting = await this.meetingsRepository.findMeetingByIdForWorkspace(
  workspaceId,
  meetingId,
  true,
);
```

Do not change the cache key or remove workspace scoping.

- [ ] **Step 4: Run focused verification**

Run:

```powershell
npm test -- tests/tasks.service.test.ts
npm run typecheck
```

Expected: both commands pass. The existing invalid-review-decision test still
passes because it returns `null` for its missing meeting ID regardless of the
third argument.

- [ ] **Step 5: Review the diff**

Run:

```powershell
git diff -- src/modules/tasks/tasks.service.ts tests/tasks.service.test.ts
```

Expected: only the local repository-port signature, the `includeDeleted: true`
lookup, and the two focused regression tests change.
