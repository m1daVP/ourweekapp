# AI Participant Reference Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure an AI-generated recap cannot persist task-owner IDs outside the authorized participants of its meeting.

**Architecture:** Keep provider parsing transport-focused and enforce ownership at the AI service boundary. The service will construct an allow-list from the workspace-scoped, non-deleted participants already fetched for the meeting, sanitize model task owner references before the existing Zod validation, and pass that same sanitized object into the atomic finalization path.

**Tech Stack:** Node.js, TypeScript, Fastify, Zod, Vitest, Supabase-backed repositories.

## Global Constraints

- Do not add dependencies, migrations, endpoints, or response-schema fields.
- Preserve workspace scoping and do not use participant IDs from the raw model output as database lookup inputs.
- Retain valid meeting participant IDs only once, in their original order.
- Remove invalid task owner IDs; if none remain, omit `responsibleParticipantIds` so the task is unassigned.
- Do not invent replacement owners, fail an otherwise valid recap for this condition, or rewrite existing summaries.
- Leave provider-client responsibility and atomic finalization behavior unchanged.
- Do not stage or commit without explicit user authorization.

---

## File map

- Modify `src/modules/ai/ai.service.ts`: add a small local sanitizer and invoke it between provider-output normalization and `meetingSummarySchema.parse`.
- Modify `tests/ai.service.test.ts`: add service-level regression coverage for invalid, cross-workspace, valid, and mixed owner references; assert both the response and finalization payload.

### Task 1: Sanitize generated task owner references at the AI service boundary

**Files:**

- Modify: `tests/ai.service.test.ts:602-627`
- Modify: `src/modules/ai/ai.service.ts:76-95,346-362`

**Interfaces:**

- Consumes: `normalizeSummaryProviderOutput(value: unknown): unknown`, `meetingSummarySchema`, and the existing `participants` result from `listParticipantNamesForWorkspace(workspaceId, meeting.participantIds)`.
- Produces: a local `sanitizeSummaryTaskOwnerReferences(value: unknown, allowedParticipantIds: ReadonlySet<string>): Record<string, unknown>` helper. It returns a summary-shaped record, except that task owner arrays contain unique allow-listed IDs only and are omitted when empty.

- [x] **Step 1: Write the failing unknown-reference test**

Add this test adjacent to the existing null-field normalization test:

```ts
it('removes unknown generated task owner IDs before finalization', async () => {
  const unknownParticipantId = '99999999-9999-4999-8999-999999999999';
  const { ai, service } = createHarness({
    providerOutput: providerOutput({
      tasks: [{ title: 'Book dentist', responsibleParticipantIds: [unknownParticipantId] }],
    }),
  });

  const response = await service.generateMeetingSummary(auth, { meetingId }, new Date(now));

  expect(response.summary.tasks).toEqual([{ title: 'Book dentist' }]);
  expect(ai.finalizeSummaryGeneration).toHaveBeenCalledWith(expect.objectContaining({
    generatedSummary: expect.objectContaining({ tasks: [{ title: 'Book dentist' }] }),
  }));
});
```

- [x] **Step 2: Run the focused test to verify it fails**

Run:

```powershell
npm test -- tests/ai.service.test.ts -t "removes unknown generated task owner IDs before finalization"
```

Expected: FAIL because the existing service returns and finalizes `unknownParticipantId` unchanged.

- [x] **Step 3: Add the local sanitizer**

In `src/modules/ai/ai.service.ts`, add this helper near `durationMsSince`:

```ts
function sanitizeSummaryTaskOwnerReferences(
  value: unknown,
  allowedParticipantIds: ReadonlySet<string>,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  const output = value as Record<string, unknown>;

  if (!Array.isArray(output.tasks)) {
    return output;
  }

  return {
    ...output,
    tasks: output.tasks.map((task) => {
      if (typeof task !== 'object' || task === null || Array.isArray(task)) {
        return task;
      }

      const taskRecord = task as Record<string, unknown>;

      if (!Array.isArray(taskRecord.responsibleParticipantIds)) {
        return taskRecord;
      }

      const responsibleParticipantIds = [
        ...new Set(
          taskRecord.responsibleParticipantIds.filter(
            (participantId): participantId is string =>
              typeof participantId === 'string' && allowedParticipantIds.has(participantId),
          ),
        ),
      ];
      const { responsibleParticipantIds: _discardedOwnerIds, ...taskWithoutOwners } = taskRecord;

      return responsibleParticipantIds.length > 0
        ? { ...taskWithoutOwners, responsibleParticipantIds }
        : taskWithoutOwners;
    }),
  };
}
```

The casts are localized because raw provider output is intentionally `unknown`; all public DTO validation remains with Zod immediately afterward.

- [x] **Step 4: Call the sanitizer before schema validation**

Replace the current summary construction with this sequence:

```ts
const allowedParticipantIds = new Set(participants.map((participant) => participant.id));
const normalizedProviderOutput = normalizeSummaryProviderOutput(providerOutput);
const sanitizedProviderOutput = sanitizeSummaryTaskOwnerReferences(
  normalizedProviderOutput,
  allowedParticipantIds,
);
const summary = meetingSummarySchema.parse({
  ...sanitizedProviderOutput,
  id: randomUUID(),
  meetingId: meeting.id,
  createdAt,
});
```

Keep the raw model data typed as `unknown` at the provider boundary; this helper is the explicit object guard. Do not loosen the summary schema or use `any`.

- [x] **Step 5: Run the focused test to verify it passes**

Run:

```powershell
npm test -- tests/ai.service.test.ts -t "removes unknown generated task owner IDs before finalization"
```

Expected: PASS. The response and `generatedSummary` finalization payload both omit `responsibleParticipantIds`.

- [x] **Step 6: Add cross-workspace, valid, and mixed-reference tests**

Add these three tests next to the unknown-reference case:

```ts
it('removes a generated owner ID that belongs to another workspace', async () => {
  const otherWorkspaceParticipantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const { service } = createHarness({
    providerOutput: providerOutput({
      tasks: [{ title: 'Book dentist', responsibleParticipantIds: [otherWorkspaceParticipantId] }],
    }),
    participants: [{ id: 'participant_1', name: 'Rita' }],
  });

  await expect(service.generateMeetingSummary(auth, { meetingId }, new Date(now)))
    .resolves.toMatchObject({ summary: { tasks: [{ title: 'Book dentist' }] } });
});

it('retains a generated owner ID for an authorized meeting participant', async () => {
  const { service } = createHarness({
    providerOutput: providerOutput({
      tasks: [{ title: 'Book dentist', responsibleParticipantIds: ['participant_1'] }],
    }),
  });

  await expect(service.generateMeetingSummary(auth, { meetingId }, new Date(now)))
    .resolves.toMatchObject({
      summary: { tasks: [{ title: 'Book dentist', responsibleParticipantIds: ['participant_1'] }] },
    });
});

it('retains unique authorized owners and removes invalid owners from mixed output', async () => {
  const secondParticipantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const invalidParticipantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const { ai, service } = createHarness({
    meeting: meeting({ participantIds: ['participant_1', secondParticipantId] }),
    participants: [
      { id: 'participant_1', name: 'Rita' },
      { id: secondParticipantId, name: 'Sam' },
    ],
    providerOutput: providerOutput({
      tasks: [{
        title: 'Book dentist',
        responsibleParticipantIds: [invalidParticipantId, 'participant_1', secondParticipantId, 'participant_1'],
      }],
    }),
  });

  const response = await service.generateMeetingSummary(auth, { meetingId }, new Date(now));

  expect(response.summary.tasks[0]?.responsibleParticipantIds)
    .toEqual(['participant_1', secondParticipantId]);
  expect(ai.finalizeSummaryGeneration).toHaveBeenCalledWith(expect.objectContaining({
    generatedSummary: expect.objectContaining({
      tasks: [{ title: 'Book dentist', responsibleParticipantIds: ['participant_1', secondParticipantId] }],
    }),
  }));
});
```

- [x] **Step 7: Run the focused owner-reference cases**

Run:

```powershell
npm test -- tests/ai.service.test.ts -t "generated.*owner|mixed output"
```

Expected: PASS for unknown, cross-workspace, valid, and mixed owner-reference cases; existing malformed structured-output behavior remains unchanged.

- [x] **Step 8: Run regression verification**

Run:

```powershell
npm test -- tests/ai.service.test.ts
npm run typecheck
npm test
npm run build
```

Expected: all commands exit successfully. If an unrelated baseline failure occurs, record its exact command and failure without modifying unrelated code.

## Plan self-review

- Spec coverage: the sole implementation task covers allow-list construction, invalid-reference removal, unassigned fallback, duplicate removal, unchanged provider/finalization boundaries, and each required test case.
- Placeholder scan: no unfinished implementation markers or unspecified test cases remain.
- Type consistency: `participants` supplies `{ id, name }` records; the new `ReadonlySet<string>` is local to `AiSummaryService`; the finalization payload remains the existing validated `MeetingSummaryDto` object.
