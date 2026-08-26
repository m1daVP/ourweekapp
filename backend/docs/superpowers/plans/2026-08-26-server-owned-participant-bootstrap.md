# Server-Owned Participant Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make participant initialization backend-owned so signup creates the initial pair and login or reinstall hydrates existing participants without generating duplicates.

**Architecture:** Registration inserts the initial participant pair inside the existing guarded account-creation sequence. A new authenticated participant-list endpoint supports pull-before-push hydration; the Vue app treats empty participant state as valid, hydrates server participants before sync, and no longer manufactures defaults from pages or stores.

**Tech Stack:** Node.js 24, Fastify 5, TypeScript, Zod, Supabase/PostgreSQL, Vitest, Vue 3, Pinia, Vite, npm.

## Global Constraints

- The backend is the only source of initial participant data.
- Password signup and first-time Google signup create exactly `Me` and `Partner` with the existing default initials and colors.
- Login, session restoration, and reinstall never create participant records.
- All participant database access is scoped by authenticated `workspaceId`.
- Preserve later local-first participant creation and sync behavior.
- Do not add dependencies or a database migration.
- Do not automatically delete existing duplicate rows.
- Do not stage or commit changes without explicit user authorization.

## File Map

### Backend repository: `D:/Projects/myself/weekly-us-api`

- Modify `src/modules/auth/auth.service.ts`: insert server-owned initial participants during both new-account flows.
- Modify `tests/auth.service.test.ts`: verify password/Google initialization and cleanup on initialization failure.
- Modify `src/modules/participants/participants.schema.ts`: define the participant list response DTO.
- Modify `src/modules/participants/participants.service.ts`: list active workspace participants and map them to public DTOs.
- Modify `src/modules/participants/participants.routes.ts`: expose authenticated `GET /v1/participants/`.
- Modify `tests/participants.service.test.ts`: test workspace-scoped participant listing.
- Modify `tests/api-contract.routes.test.ts`: test list-route authentication, context forwarding, and response serialization.
- Regenerate `docs/openapi.json`: record the additive endpoint.

### Frontend repository: `D:/Projects/myself/weekly-us`

- Create `src/shared/api/participantsApi.ts`: typed wrapper for participant hydration.
- Modify `src/shared/api/__tests__/apiWrappers.test.ts`: verify the wrapper's URL and auth requirement.
- Modify `src/app/stores/participants.ts`: allow empty initial state and apply hydrated participant collections.
- Modify `src/app/stores/__tests__/participants.test.ts`: test empty initialization and hydrated current-participant selection.
- Modify `src/shared/services/syncService.ts`: hydrate participants before any participant push.
- Modify `src/shared/services/__tests__/syncService.test.ts`: reproduce fresh-login/reinstall behavior and hydration failure safety.
- Modify `src/pages/HomePage.vue`, `src/pages/MeetingTemplatesPage.vue`, `src/pages/TasksPage.vue`, `src/app/stores/meetings.ts`, `src/features/meeting/composables/useMeetingSession.ts`, and `src/features/participants/components/HouseholdMembersSettings.vue`: remove local default creation calls.
- Modify focused tests only if those callers currently assert seeded defaults.

---

### Task 1: Create initial participants during backend registration

**Files:**

- Modify: `src/modules/auth/auth.service.ts`
- Test: `tests/auth.service.test.ts`

**Interfaces:**

- Consumes: existing `registerUser(supabase, body)` and new-user `registerGoogleUser(supabase, identity)` registration sequences.
- Produces: internal `createInitialParticipants(supabase: SupabaseClient, workspaceId: string): Promise<void>`.

- [ ] **Step 1: Extend the auth test Supabase harness to record table and insert payloads**

Record each `from(table)` call together with the payload passed to `insert(payload)` while preserving the existing sequential-result behavior. This lets tests assert participant values without coupling to unrelated query chaining.

- [ ] **Step 2: Write failing password-signup and Google-signup initialization tests**

For password signup, supply successful rows in this order: user, workspace, member, participant insert, session. For first-time Google signup, add the participant insert between member and session. Assert one insert into `participants` with:

```ts
[
  {
    workspace_id: 'workspace-1',
    name: 'Me',
    initials: 'M',
    avatar_color: '#496a8f',
    type: 'adult',
    is_active: true,
  },
  {
    workspace_id: 'workspace-1',
    name: 'Partner',
    initials: 'P',
    avatar_color: '#6b8f71',
    type: 'adult',
    is_active: true,
  },
]
```

Also assert that existing Google-account sign-in does not call `participants`.

- [ ] **Step 3: Run the focused auth tests and confirm they fail**

Run:

```bash
npm test -- tests/auth.service.test.ts
```

Expected: the new tests fail because registration does not insert participants.

- [ ] **Step 4: Implement the shared registration helper and invoke it from both new-account flows**

Add constants for the two rows and an internal helper shaped as:

```ts
async function createInitialParticipants(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { error } = await supabase.from('participants').insert(
    INITIAL_PARTICIPANTS.map((participant) => ({
      workspace_id: workspaceId,
      ...participant,
    })),
  );

  if (error) {
    throw new ApiError(
      500,
      'participant_create_failed',
      'Something went wrong. Please try again.',
    );
  }
}
```

Call it after owner membership creation and before session creation in `registerUser` and `registerGoogleUser`. Keep it inside the existing `try/catch`, so `cleanupFailedRegistration` removes the cascaded workspace participants if the insert fails.

- [ ] **Step 5: Add and pass the initialization-failure cleanup test**

Return an error from the participant insert and successful cleanup results afterward. Assert `registerUser` rejects with `participant_create_failed`, no session insert occurs, and cleanup targets the newly created workspace and user.

- [ ] **Step 6: Run focused backend checks**

Run:

```bash
npm test -- tests/auth.service.test.ts
npm run typecheck
```

Expected: both commands pass.

---

### Task 2: Add the authenticated participant hydration endpoint

**Files:**

- Modify: `src/modules/participants/participants.schema.ts`
- Modify: `src/modules/participants/participants.service.ts`
- Modify: `src/modules/participants/participants.routes.ts`
- Test: `tests/participants.service.test.ts`
- Test: `tests/api-contract.routes.test.ts`

**Interfaces:**

- Consumes: `ParticipantsRepository.listParticipantsForWorkspace(workspaceId, false)` and `requireAuthenticatedContext(request.auth)`.
- Produces: `listParticipants(repository, { workspaceId }): Promise<ListParticipantsResponseDto>` and `listParticipantsWithSupabase(supabase, input)`; HTTP `GET /v1/participants/` returns `{ participants: ParticipantDto[] }`.

- [ ] **Step 1: Write a failing participant service list test**

Add a fake-repository call log and assert:

```ts
const response = await listParticipants(repository, {
  workspaceId: 'workspace-1',
});

expect(repository.listCalls).toEqual([
  { workspaceId: 'workspace-1', includeDeleted: false },
]);
expect(response).toEqual({
  participants: [expect.objectContaining({ id: participantOneId, name: 'Rita' })],
});
expect(response.participants[0]).not.toHaveProperty('workspaceId');
```

- [ ] **Step 2: Run the service test and confirm it fails**

Run:

```bash
npm test -- tests/participants.service.test.ts
```

Expected: failure because `listParticipants` is not exported.

- [ ] **Step 3: Add the response schema and service functions**

In `participants.schema.ts`, define and export:

```ts
export const listParticipantsResponseSchema = z.object({
  participants: z.array(participantSchema),
});

export type ListParticipantsResponseDto = z.infer<
  typeof listParticipantsResponseSchema
>;
```

In `participants.service.ts`, use the existing `toParticipantDto` mapping and call the repository with `includeDeleted` set to `false`.

- [ ] **Step 4: Add failing route contract tests**

Extend the participant service mock with `listParticipantsWithSupabase`. Add tests that:

- unauthenticated `GET /v1/participants/` returns `401` without calling the service;
- authenticated GET passes `authContext.workspaceId`;
- a successful response contains public camelCase participant fields and excludes `workspaceId`.

- [ ] **Step 5: Register the GET route**

Add a route before the sync route:

```ts
app.get('/', {
  config: { authRequired: true },
  preHandler: requireAuth(app),
  schema: {
    response: {
      200: listParticipantsResponseSchema,
      ...participantErrorResponses,
    },
  },
}, async (request) => {
  const auth = requireAuthenticatedContext(request.auth);

  return listParticipantsWithSupabase(app.supabase, {
    workspaceId: auth.workspaceId,
  });
});
```

- [ ] **Step 6: Run focused backend tests and typecheck**

Run:

```bash
npm test -- tests/participants.service.test.ts tests/api-contract.routes.test.ts
npm run typecheck
```

Expected: all checks pass.

---

### Task 3: Remove client-generated participant bootstrap state

**Files:**

- Modify: `D:/Projects/myself/weekly-us/src/app/stores/participants.ts`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/__tests__/participants.test.ts`
- Modify: `D:/Projects/myself/weekly-us/src/pages/HomePage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/pages/MeetingTemplatesPage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/pages/TasksPage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/meetings.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/meeting/composables/useMeetingSession.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/participants/components/HouseholdMembersSettings.vue`

**Interfaces:**

- Consumes: persisted participant state and existing `Participant` DTOs.
- Produces: `applyParticipants(participants: Participant[]): void`, which selects a valid `currentParticipantId` and persists the collection.

- [ ] **Step 1: Replace the seeded-state test with failing empty-state and hydration-application tests**

Assert that absent storage yields:

```ts
expect(store.participants).toEqual([]);
expect(store.currentParticipantId).toBeNull();
```

Then call:

```ts
store.applyParticipants([
  participant('self-1', 'Rita'),
  participant('adult-2', 'Alex'),
]);
```

Assert the collection is stored, `currentParticipantId` becomes `self-1`, and no generated `Me` or `Partner` record exists.

- [ ] **Step 2: Run the participant store test and confirm it fails**

Run from `D:/Projects/myself/weekly-us`:

```bash
npm test -- src/app/stores/__tests__/participants.test.ts
```

Expected: fresh state still contains generated defaults and `applyParticipants` is missing.

- [ ] **Step 3: Make empty state valid and add `applyParticipants`**

Remove `createDefaultParticipantsState`, the store's `ensureDefaultParticipants` action, and any helper used only for generating initial records. Make both absent storage and an empty persisted array return:

```ts
{
  participants: [],
  currentParticipantId: null,
}
```

Implement:

```ts
applyParticipants(participants: Participant[]) {
  this.participants = participants;
  this.currentParticipantId = selectCurrentParticipantId(
    participants,
    this.currentParticipantId,
  );
  this.persist();
}
```

Keep placeholder-deduplication display logic for already affected accounts; it is not a source of new rows.

- [ ] **Step 4: Remove every `ensureDefaultParticipants()` caller**

Delete calls from the six listed page/store/composable files. Preserve their existing empty-state behavior and validation messages. Do not replace the calls with local participant creation.

- [ ] **Step 5: Run focused frontend tests**

Run:

```bash
npm test -- src/app/stores/__tests__/participants.test.ts src/features/meeting/composables/__tests__/useMeetingSession.test.ts
```

Expected: tests pass; update only assertions that explicitly depended on automatic seeding.

---

### Task 4: Hydrate participants before participant sync

**Files:**

- Create: `D:/Projects/myself/weekly-us/src/shared/api/participantsApi.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/__tests__/apiWrappers.test.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/services/syncService.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/services/__tests__/syncService.test.ts`

**Interfaces:**

- Consumes: backend `GET /v1/participants/`, `ParticipantDto`, `fromParticipantDto`, and `mergeSyncItems`.
- Produces: `listParticipants(): Promise<{ participants: ParticipantDto[] }>`.

- [ ] **Step 1: Write the failing API-wrapper test**

Mock a participant response, call `listParticipants()`, and assert:

```ts
expect(lastApiCall()).toEqual([
  '/participants/',
  { requiresAuth: true },
]);
```

Also assert a missing/non-array `participants` value normalizes to `[]`.

- [ ] **Step 2: Implement the typed participant API wrapper**

Create `participantsApi.ts` with:

```ts
interface ListParticipantsResponseDto {
  participants: ParticipantDto[];
}

export async function listParticipants() {
  const response = await apiRequest<ListParticipantsResponseDto>(
    '/participants/',
    { requiresAuth: true },
  );

  return {
    participants: Array.isArray(response.participants)
      ? response.participants
      : [],
  };
}
```

- [ ] **Step 3: Add failing fresh-login and hydration-failure sync tests**

Extend the sync-service mocks with `listParticipants`. For the fresh-login case, start the store empty, return renamed server participants (`Rita` and `Alex` with server revisions), call `retrySync()`, and assert:

```ts
expect(mocks.listParticipants.mock.invocationCallOrder[0]).toBeLessThan(
  mocks.apiRequest.mock.invocationCallOrder[0],
);
expect(mocks.apiRequest).toHaveBeenCalledWith(
  '/participants/sync',
  expect.objectContaining({
    body: expect.objectContaining({
      participants: expect.arrayContaining([
        expect.objectContaining({ name: 'Rita' }),
        expect.objectContaining({ name: 'Alex' }),
      ]),
    }),
  }),
);
expect(useParticipantsStore().participants.map(({ name }) => name)).toEqual([
  'Rita',
  'Alex',
]);
```

Explicitly assert the push contains no generated `Me` or `Partner` entries. For failure safety, reject `listParticipants`, call `retrySync()`, and assert the participant sync POST, meeting sync, and task sync were not called.

- [ ] **Step 4: Implement participant hydration in `hydrateCoreDataFromBackend`**

Fetch participants alongside meetings and tasks. Merge the server DTOs with any legitimate same-owner local records, then apply through `participantsStore.applyParticipants(...)`. Mark participant hydration failures with `markSyncFailure('participants', error)` and do not call `markInitialHydrationComplete()` on failure.

The hydration sequence must remain:

```text
load workspace -> pull participants/meetings/tasks -> persist hydrated state
-> mark hydration complete -> push participants -> push meetings -> push tasks
```

- [ ] **Step 5: Add the same-owner offline-edit preservation test**

Seed one local participant for the already bound user, return a different server participant, run `retrySync()`, and assert both records are present in the participant sync payload. This protects the approved local-first behavior after initialization.

- [ ] **Step 6: Run focused frontend tests**

Run:

```bash
npm test -- src/shared/api/__tests__/apiWrappers.test.ts src/shared/services/__tests__/syncService.test.ts src/app/stores/__tests__/participants.test.ts
```

Expected: all tests pass.

---

### Task 5: Regenerate contracts and run full verification

**Files:**

- Modify: `docs/openapi.json`
- Verify: all files changed in Tasks 1-4

**Interfaces:**

- Consumes: registered Fastify routes and completed frontend/backend behavior.
- Produces: checked-in OpenAPI documentation containing `GET /v1/participants/` and verified builds.

- [ ] **Step 1: Generate the backend OpenAPI document**

Run from `D:/Projects/myself/weekly-us-api`:

```bash
npm run openapi:generate
```

Confirm `docs/openapi.json` contains the participant GET operation and its authenticated `200` response.

- [ ] **Step 2: Run the complete backend verification suite**

Run:

```bash
npm run typecheck
npm test
npm run openapi:check
npm run build
```

Expected: all commands pass.

- [ ] **Step 3: Run the complete frontend verification suite**

Run from `D:/Projects/myself/weekly-us`:

```bash
npm test
npm run build
npm run check
```

Expected: all commands pass.

- [ ] **Step 4: Inspect the final diff without changing unrelated work**

Use repository-local safe-directory overrides if Git ownership warnings recur. Verify that only the intended backend, frontend, tests, design/plan docs, and generated OpenAPI contract changed. Do not stage or commit.

- [ ] **Step 5: Report manual validation and existing-data follow-up**

Manually validate when environments are available:

1. Create a new account and confirm the API returns exactly two initial participants.
2. Rename both participants.
3. Log in from a clean browser profile and confirm only the renamed records appear.
4. Reinstall the native app, log in, and confirm the same result.
5. For the already affected test account, inspect references before deleting the two duplicate IDs; do not include that cleanup in this implementation.
