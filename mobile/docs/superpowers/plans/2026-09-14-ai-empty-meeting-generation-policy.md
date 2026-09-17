# Empty Meeting AI Generation Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent AI recap generation for completed meetings with zero recorded discussion signals, while keeping explicit low-content generation for meetings with at least one signal.

**Architecture:** Reuse the established `discussionSignalCount` returned by the readiness helpers. The backend makes zero-signal rejection authoritative before applying `allowLowContent`; the recap page uses its matching readiness helper to avoid rendering a generation action for zero-signal meetings. No meeting schema, sync DTO, migration, or new request field is needed.

**Tech Stack:** Vue 3, TypeScript, Vitest, Fastify, Zod, Supabase-backed repositories.

## Global Constraints

- Count only notes and agreements, consistent with the existing summary-readiness contract; tasks alone do not make a meeting eligible.
- `allowLowContent: true` remains valid only when `discussionSignalCount >= 1`.
- The backend must reject zero signals before quota reservation, AI-request creation, participant lookup, or provider invocation.
- Do not add a migration, endpoint, DTO field, dependency, or automatic recap generation.
- Do not stage or commit changes without the user's explicitly approved numbered commit list.

---

### Task 1: Make zero-signal AI generation impossible at the backend boundary

**Files:**

- Modify: `D:\Projects\myself\weekly-us-api\src\modules\ai\ai.service.ts:239-270`
- Test: `D:\Projects\myself\weekly-us-api\tests\ai.service.test.ts:234-302`

**Interfaces:**

- Consumes: `getSummaryContentReadiness(meeting.sections)`, returning `discussionSignalCount` and `sectionCount`.
- Produces: `ApiError(409, 'ai_summary_no_recorded_content', 'Record a note or agreement before generating a recap.', { discussionSignalCount: 0, sectionCount: 0 })` for a completed zero-signal meeting.
- Preserves: `ApiError(422, 'ai_summary_insufficient_content', ...)` when a non-empty meeting is below normal readiness and has not sent `allowLowContent: true`.

- [ ] **Step 1: Add the failing service test for an empty meeting request with the override.**

  Add directly before the existing low-content confirmation test:

  ```ts
  it('rejects an empty meeting even when low-content generation is explicitly allowed', async () => {
    const { ai, assistant, participants, provider, service } = createHarness({
      meeting: meeting({
        sections: [
          {
            id: 'section_1',
            title: 'Planning',
            prompt: 'Plan together',
            notes: [],
            tasks: [],
            agreements: [],
          },
        ],
      }),
      withAssistantRepository: true,
    });

    await expect(
      service.generateMeetingSummary(
        auth,
        { meetingId, allowLowContent: true },
        new Date(now)
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'ai_summary_no_recorded_content',
      details: { discussionSignalCount: 0, sectionCount: 0 },
    });
    expect(
      participants.listParticipantNamesForWorkspace
    ).not.toHaveBeenCalled();
    expect(ai.claimSummaryGeneration).not.toHaveBeenCalled();
    expect(assistant.reserveRecap).not.toHaveBeenCalled();
    expect(provider.generateMeetingSummary).not.toHaveBeenCalled();
  });
  ```

- [ ] **Step 2: Run the focused test and verify it fails because the override currently bypasses readiness.**

  Run: `npm test -- tests/ai.service.test.ts`

  Expected: the new test fails because generation proceeds after `allowLowContent: true`.

- [ ] **Step 3: Add the authoritative zero-signal guard immediately after readiness is calculated.**

  In `AiSummaryService.generateMeetingSummary`, insert this before the existing insufficient-content condition:

  ```ts
  if (contentReadiness.discussionSignalCount === 0) {
    throw new ApiError(
      409,
      'ai_summary_no_recorded_content',
      'Record a note or agreement before generating a recap.',
      {
        discussionSignalCount: contentReadiness.discussionSignalCount,
        sectionCount: contentReadiness.sectionCount,
      }
    );
  }
  ```

  Add the matching structured warning immediately before this throw. It must include only request metadata plus the numeric signal counts, and must not log meeting content.

- [ ] **Step 4: Run the focused backend suite and verify the old non-empty override still passes.**

  Run: `npm test -- tests/ai.service.test.ts`

  Expected: PASS; the new empty-meeting rejection passes and `allows a low-content recap after explicit confirmation` remains green.

- [ ] **Step 5: Run static verification.**

  Run: `npm run typecheck`

  Expected: PASS.

### Task 2: Hide the AI action for zero-signal recorded recaps

**Files:**

- Modify: `D:\Projects\myself\weekly-us\src\pages\MeetingSummaryPage.vue:128-137,412-440`
- Modify: `D:\Projects\myself\weekly-us\src\pages\MeetingDetailsPage.vue:69-77,280-296`
- Test: `D:\Projects\myself\weekly-us\src\pages\__tests__\MeetingRecapPages.test.ts:135-170`

**Interfaces:**

- Consumes: `getAiRecapContentReadiness(meeting)`, including `discussionSignalCount` and `isReady`.
- Produces: `canGenerateAiSummary === false` for a completed eligible meeting with `discussionSignalCount === 0`.
- Preserves: one or more signals with `isReady === false` opens the existing low-content confirmation; ready content calls `generateMeetingSummary(meeting)` without an override.

- [ ] **Step 1: Add a failing recap-page test for a completed empty meeting.**

  Create a completed eligible test meeting with no notes, tasks, or agreements, set `aiSummary = undefined`, render the recap page, then assert:

  ```ts
  expect(wrapper.find('[data-testid="generate-meeting-recap"]').exists()).toBe(
    false
  );
  expect(document.body.textContent).not.toContain('Add a little more context?');
  expect(generateMeetingSummary).not.toHaveBeenCalled();
  ```

- [ ] **Step 2: Run the focused page test and verify it fails because the current action is visible.**

  Run: `npm test -- src/pages/__tests__/MeetingRecapPages.test.ts`

  Expected: the new assertion fails; the current page exposes the generation button and routes an empty meeting into low-content confirmation.

- [ ] **Step 3: Derive AI eligibility from the existing readiness result and guard the handler.**

  Introduce a computed readiness value once:

  ```ts
  const aiRecapReadiness = computed(() =>
    accessibleMeeting.value
      ? getAiRecapContentReadiness(accessibleMeeting.value)
      : null
  );
  ```

  Require `aiRecapReadiness.value?.discussionSignalCount > 0` in each page's `canGenerateAiSummary`. In `handleGenerateSummary` and `generateSummary`, return early when that same condition is false. Use `aiRecapReadiness.value?.isReady` for the existing low-content confirmation decision so each page has one source of truth.

- [ ] **Step 4: Run the page suite and verify all three eligibility paths.**

  Run: `npm test -- src/pages/__tests__/MeetingRecapPages.test.ts`

  Expected: PASS; empty meetings expose no action, the existing one-signal test still opens confirmation and sends `{ allowLowContent: true }`, and ready content generates normally.

- [ ] **Step 5: Run frontend verification.**

  Run: `npm run typecheck && npm run build`

  Expected: both commands PASS; record any pre-existing bundle-size warning separately.

### Task 3: Run the cross-layer regression set

**Files:**

- No production file changes.

**Interfaces:**

- Verifies the frontend action policy matches the backend authorization policy for the same discussion-signal definition.

- [ ] **Step 1: Run focused behavior tests from both projects.**

  Run in `D:\Projects\myself\weekly-us-api`:

  ```powershell
  npm test -- tests/ai.service.test.ts
  ```

  Run in `D:\Projects\myself\weekly-us`:

  ```powershell
  npm test -- src/pages/__tests__/MeetingRecapPages.test.ts src/features/meeting/__tests__/aiRecapContentReadiness.test.ts
  ```

  Expected: PASS. Confirm these cases explicitly: zero signals cannot generate even with override; one signal can be explicitly forced; normal ready content remains available.

- [ ] **Step 2: Inspect the final diff for scope.**

  Verify only the backend AI service/test and frontend recap page/test changed. Confirm no meeting sync schema, migration, API DTO, or dependency changed.

- [ ] **Step 3: Leave commits unstaged pending explicit approval.**

  Report the changed files and verification results. If the user requests commits, first use the required commit-proposal/approval workflow.
