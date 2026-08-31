# Invitation RPC Response Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept the successful single-object response from `create_participant_invitation` so workspace invitations can be created.

**Architecture:** Keep the database RPC and public API unchanged. Normalize its response only inside `WorkspacesRepository.createInvitation`, allowing either the provider's single composite object or a one-element array before mapping it to the existing invitation DTO.

**Tech Stack:** Node.js 24, TypeScript, Supabase JavaScript client, Vitest.

## Global Constraints

- Do not add a database migration, dependency, or public API-contract change.
- Preserve workspace scoping and the existing safe error behavior for Supabase errors and truly empty results.
- Do not stage or commit changes without explicit user authorization.

---

### Task 1: Normalize the invitation RPC result

**Files:**
- Modify: `src/modules/workspace/workspaces.repository.ts:581-610`
- Test: `tests/workspace.repository.test.ts`

**Interfaces:**
- Consumes: `create_participant_invitation` response data typed as `WorkspaceInvitationRow[]` but supplied by Supabase as either one `WorkspaceInvitationRow` composite or a `WorkspaceInvitationRow[]`.
- Produces: `WorkspacesRepository.createInvitation(input): Promise<WorkspaceInvitationDto>` for the existing workspace service.

- [ ] **Step 1: Write the failing regression test**

Add this test to `tests/workspace.repository.test.ts`:

```ts
it('maps a single-object participant invitation RPC response', async () => {
  const { client } = createRpcClient({ data: invitationRow, error: null });
  const repository = new WorkspacesRepository(client);

  await expect(repository.createInvitation({
    workspaceId: 'workspace-1',
    participantId: 'participant-1',
    email: 'alex@example.com',
    emailNormalized: 'alex@example.com',
    role: 'adult_member',
    tokenHash: 'token-hash',
    expiresAt: '2026-06-13T10:00:00.000Z',
  })).resolves.toMatchObject({
    id: 'invitation-1',
    participantId: 'participant-1',
    email: 'alex@example.com',
  });
});
```

- [ ] **Step 2: Run the focused test to verify the current failure**

Run: `npx vitest run tests/workspace.repository.test.ts`

Expected: FAIL in `maps a single-object participant invitation RPC response` with `workspace_invitation_create_failed`.

- [ ] **Step 3: Implement the minimal response normalization**

In `WorkspacesRepository.createInvitation`, replace the array-only lookup with this explicit normalization after `throwOnSupabaseError`:

```ts
const row = Array.isArray(data)
  ? data[0]
  : data as unknown as WorkspaceInvitationRow | null;
```

Keep the existing `if (!row)` safe `ApiError` branch and DTO mapping unchanged. The cast is limited to the provider boundary because the RPC's SQL return type is a single table composite while the generated client type declares an array.

- [ ] **Step 4: Run the focused test to verify the fix**

Run: `npx vitest run tests/workspace.repository.test.ts`

Expected: PASS, including the new single-object response test.

- [ ] **Step 5: Run static verification**

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Leave the change unstaged**

Do not run `git add` or `git commit`; commits require separate explicit authorization.

## Self-Review

- Spec coverage: Task 1 implements object/array response normalization, preserves safe empty-result handling, and adds the specified regression test.
- Placeholder scan: no TBDs or unspecified implementation steps remain.
- Type consistency: the new normalization returns `WorkspaceInvitationRow | undefined | null`, which is handled by the existing missing-row branch before `mapWorkspaceInvitationRowToDto` is called.
