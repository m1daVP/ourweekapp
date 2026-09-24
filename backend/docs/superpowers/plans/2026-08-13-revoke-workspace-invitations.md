# Revoke Workspace Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a workspace owner revoke a pending invitation through `DELETE /v1/workspace/invitations/:invitationId`.

**Architecture:** Add a UUID route parameter and a thin authenticated Fastify route. The workspace service applies the existing owner-only authorization guard, then delegates to a repository method that updates only the matching pending invitation in the authenticated workspace to `revoked`; absence maps to a safe 404.

**Tech Stack:** Node.js 24, TypeScript 6, Fastify 5, Zod 4, Supabase/PostgreSQL, Vitest 4.

## Global Constraints

- The endpoint is owner-only; reuse `requireManageWorkspace`.
- Scope every invitation update by the authenticated `workspaceId` and require `status = 'pending'`.
- Preserve invitation rows by changing the status to `revoked`; do not hard-delete data or add a migration.
- Return `204` for success and `workspace_invitation_not_found` with `404` when no pending invitation matches.
- Do not add dependencies or modify generated `AGENTS.md`.
- Do not stage or commit changes without the user's explicit approved commit list.

---

### Task 1: Add the scoped Supabase revocation update

**Files:**
- Modify: `src/modules/workspace/workspaces.repository.ts`
- Test: `tests/workspace.repository.test.ts`

**Interfaces:**
- Consumes: `workspaceId: string` and `invitationId: string` from the workspace service added in Task 2.
- Produces: `WorkspacesRepository.revokePendingInvitation(workspaceId: string, invitationId: string): Promise<WorkspaceInvitationDto>`.

- [ ] **Step 1: Write the failing repository tests**

  Enhance `FakeFromQuery` so `update()` returns the query, `maybeSingle<T>()` returns the configured result, and it records the update payload plus each `eq` filter. Add a success test that sets `data` to `{ ...invitationRow, status: 'revoked' }` and asserts:

  ```ts
  expect(calls).toEqual([
    { table: 'workspace_invitations' },
    { update: { status: 'revoked' } },
    { eq: ['workspace_id', 'workspace-1'] },
    { eq: ['id', 'invitation-1'] },
    { eq: ['status', 'pending'] },
  ]);
  expect(result).toMatchObject({
    id: 'invitation-1',
    workspaceId: 'workspace-1',
    status: 'revoked',
  });
  ```

  Add a second test with `data: null` and `error: null`; it must reject with:

  ```ts
  {
    statusCode: 404,
    code: 'workspace_invitation_not_found',
    details: {},
  }
  ```

- [ ] **Step 2: Run the repository tests to verify they fail**

  Run:

  ```powershell
  npm test -- tests/workspace.repository.test.ts
  ```

  Expected: failures because the query fake and `revokePendingInvitation` method do not yet exist.

- [ ] **Step 3: Implement the repository method**

  Add this method next to `listPendingInvitationsForWorkspace` in `src/modules/workspace/workspaces.repository.ts`:

  ```ts
  async revokePendingInvitation(workspaceId: string, invitationId: string) {
    const { data, error } = await this.supabase
      .from('workspace_invitations')
      .update({ status: 'revoked' })
      .eq('workspace_id', workspaceId)
      .eq('id', invitationId)
      .eq('status', 'pending')
      .select(INVITATION_COLUMNS)
      .maybeSingle<WorkspaceInvitationRow>();

    throwOnSupabaseError(
      error,
      'workspace_invitation_revoke_failed',
      'Unable to revoke the workspace invitation.',
    );

    if (!data) {
      throw new ApiError(
        404,
        'workspace_invitation_not_found',
        'Pending workspace invitation not found.',
      );
    }

    return mapWorkspaceInvitationRowToDto(data);
  }
  ```

  Keep the `workspace_id`, `id`, and `status = 'pending'` filters in that order. Do not expose or select `token_hash`.

- [ ] **Step 4: Run the repository tests to verify they pass**

  Run:

  ```powershell
  npm test -- tests/workspace.repository.test.ts
  ```

  Expected: the repository maps a revoked row to its DTO and maps an unmatched pending row to the safe 404 error.

- [ ] **Step 5: Leave changes unstaged for review**

  Do not run `git add` or `git commit`; this project requires an explicitly approved commit list before creating commits.

### Task 2: Implement the workspace invitation revocation contract

**Files:**
- Modify: `src/modules/workspace/workspace.schema.ts`
- Modify: `src/modules/workspace/workspace.routes.ts`
- Modify: `src/modules/workspace/workspace.service.ts`
- Test: `tests/workspace.service.test.ts`
- Test: `tests/api-contract.routes.test.ts`

**Interfaces:**
- Consumes: `requireManageWorkspace(auth)` and `WorkspacesRepository.revokePendingInvitation(workspaceId, invitationId)` from Task 1.
- Produces: `workspaceInvitationParamsSchema`, `WorkspaceService.revokeInvitation(auth, invitationId): Promise<void>`, and `DELETE /v1/workspace/invitations/:invitationId`.

- [ ] **Step 1: Write the failing service and route-contract tests**

  Extend the workspace service test double with `revokePendingInvitation: vi.fn(async () => invitation({ status: 'revoked' }))`, then add this test to `tests/workspace.service.test.ts`:

  ```ts
  it('revokes a pending invitation through the workspace-scoped repository path', async () => {
    const { repository, service } = createRepository();

    await service.revokeInvitation(ownerAuth, 'invitation-1');

    expect(repository.revokePendingInvitation).toHaveBeenCalledWith(
      'workspace-1',
      'invitation-1',
    );
  });
  ```

  Extend the `workspaceService` mock in `tests/api-contract.routes.test.ts` with `revokeInvitation: vi.fn()`, reset it in `beforeEach`, and add the following validation test:

  ```ts
  it('returns 422 before invitation revoke service code for invalid invitation IDs', async () => {
    const app = await buildRouteApp('workspace');
    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/workspace/invitations/not-a-uuid',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'validation_failed' });
    expect(workspaceService.revokeInvitation).not.toHaveBeenCalled();
    await app.close();
  });
  ```

  Add the matching success test using the existing UUID-shaped invitation ID:

  ```ts
  it('returns 204 after revoking a workspace invitation', async () => {
    workspaceService.revokeInvitation.mockResolvedValueOnce(undefined);
    const app = await buildRouteApp('workspace');
    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/workspace/invitations/44444444-4444-4444-8444-444444444444',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(204);
    expect(workspaceService.revokeInvitation).toHaveBeenCalledWith(
      authContext,
      '44444444-4444-4444-8444-444444444444',
    );
    await app.close();
  });
  ```

- [ ] **Step 2: Run the focused tests to verify they fail**

  Run:

  ```powershell
  npm test -- tests/workspace.service.test.ts tests/api-contract.routes.test.ts
  ```

  Expected: failures because `revokeInvitation`, its route, and the invitation parameter schema do not yet exist.

- [ ] **Step 3: Add schema, service, and route implementation**

  In `src/modules/workspace/workspace.schema.ts`, add a dedicated invitation parameter schema and exported inferred type:

  ```ts
  export const workspaceInvitationParamsSchema = z.object({
    invitationId: z.uuid(),
  });

  export type WorkspaceInvitationParamsDto = z.infer<
    typeof workspaceInvitationParamsSchema
  >;
  ```

  In `WorkspaceService`, add the owner-authorized orchestration method:

  ```ts
  async revokeInvitation(auth: AuthContext | undefined, invitationId: string) {
    const context = requireManageWorkspace(auth);

    await this.repository.revokePendingInvitation(
      context.workspaceId,
      invitationId,
    );
  }
  ```

  Import `workspaceInvitationParamsSchema` in `workspace.routes.ts` and add the route adjacent to `POST /invitations`:

  ```ts
  app.delete('/invitations/:invitationId', {
    config: { authRequired: true },
    preHandler: authPreHandler,
    schema: {
      params: workspaceInvitationParamsSchema,
      response: { 204: z.null(), ...workspaceErrorResponses },
    },
  }, async (request, reply) => {
    await service.revokeInvitation(request.auth, request.params.invitationId);

    return reply.status(204).send(null);
  });
  ```

- [ ] **Step 4: Run all workspace-focused tests**

  Run:

  ```powershell
  npm test -- tests/workspace.service.test.ts tests/workspace.repository.test.ts tests/workspace.routes.test.ts tests/api-contract.routes.test.ts
  ```

  Expected: service delegation, UUID validation, 204 route behavior, repository workspace scoping, and existing workspace behavior all pass.

- [ ] **Step 5: Leave changes unstaged for review**

  Do not run `git add` or `git commit`; this project requires an explicitly approved commit list before creating commits.

### Task 3: Refresh and verify the public API contract

**Files:**
- Modify: `docs/openapi.json` (generated by the project script)

**Interfaces:**
- Consumes: the Zod route schema added in Task 2.
- Produces: an OpenAPI document containing the owner-authenticated `DELETE /v1/workspace/invitations/{invitationId}` operation with 204, 401, 403, 404, 409, 422, and 500 responses.

- [ ] **Step 1: Generate the OpenAPI document**

  Run:

  ```powershell
  npm run openapi:generate
  ```

  Expected: `docs/openapi.json` is updated from the registered route schemas and includes the new deletion operation.

- [ ] **Step 2: Verify the generated operation and response contract**

  Run:

  ```powershell
  rg -n 'workspace/invitations/\{invitationId\}|workspace_invitation_not_found' docs/openapi.json
  ```

  Expected: the endpoint path is present; error schema references remain consistent with the shared safe error response.

- [ ] **Step 3: Run project verification**

  Run:

  ```powershell
  npm run typecheck
  npm test
  npm run openapi:check
  ```

  Expected: TypeScript, the full Vitest suite, and the generated OpenAPI check all pass.

- [ ] **Step 4: Leave changes unstaged for user review**

  Do not stage or commit the source, tests, generated OpenAPI document, design, or plan without an explicitly approved commit list.

## Self-Review

- Spec coverage: Task 1 supplies the pending-only workspace-scoped update, soft revocation, and safe 404; Task 2 supplies the public endpoint, UUID validation, owner-only service authorization, and 204 response; Task 3 refreshes and verifies API documentation.
- Placeholder scan: no incomplete requirements or deferred implementation placeholders remain.
- Type consistency: `invitationId` is a UUID parameter at the route boundary, is passed as a string to `WorkspaceService.revokeInvitation`, and is passed with the authenticated `workspaceId` to `WorkspacesRepository.revokePendingInvitation`.
