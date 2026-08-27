# Participant Email Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Associate participants with unique emails and user accounts, provide a complete emailed invitation journey, and derive access from participant type without client-controlled authorization.

**Architecture:** PostgreSQL owns participant identity, invitation state, and atomic invitation acceptance. The Fastify API derives workspace roles, issues and hashes invitation tokens, and uses the existing SMTP mailer. The Capacitor app captures an app-link token across authentication; the Astro landing page only hands that token to the app.

**Tech Stack:** PostgreSQL/Supabase, Fastify 5, TypeScript, Zod, Vitest, Nodemailer, Vue 3/Pinia/Capacitor 8, Astro 6.

## Global Constraints

- A normalized email belongs to only one active, non-deleted participant per workspace.
- Participant `email`, `email_normalized`, and `user_id` are server-owned; participant sync must neither accept nor overwrite them.
- Ordinary password and Google signup creates the owner participant bound to the new user email and ID; invitation-aware signup creates neither a personal workspace nor bootstrap participants.
- `adult` maps to `adult_member`; `child` and `other` map to `viewer`; clients never submit a role for a participant invitation.
- Invitation tokens are cryptographically random, single-use, expiry-bound, and stored only as hashes.
- The Astro landing page only opens `weeklyus://invite?token=...`; validation and consumption remain backend-only.
- Do not infer historical associations from names or local storage.
- Do not stage or commit changes without explicit user authorization.

---

### Task 1: Add durable participant identity and invitation-delivery storage

**Files:**

- Create: `supabase/migrations/20260826180000_add_participant_identity_invitations.sql`
- Modify: `src/config/env.ts`
- Modify: `.env.example`
- Test: `tests/env.test.ts`
- Test: create `tests/participant-email-access.migration.test.ts`

**Interfaces:**

- Produces nullable `participants.email`, `participants.email_normalized`, and `participants.user_id`.
- Produces `workspace_invitations.participant_id`, `delivery_status`, `delivery_attempted_at`, and `delivery_sent_at`.
- Produces SQL RPCs `create_participant_invitation`, `accept_participant_invitation`, and `revoke_participant_invitation` for workspace-scoped atomic state changes.
- Produces `env.INVITATION_HANDOFF_URL` and `env.INVITATION_HANDOFF_CONFIGURED`.

- [ ] **Step 1: Write migration assertions before adding the migration**

Create `tests/participant-email-access.migration.test.ts` that reads the new migration and asserts it contains all of the following:

```ts
expect(sql).toContain('add column email text');
expect(sql).toContain('add column email_normalized text');
expect(sql).toContain('add column user_id uuid');
expect(sql).toContain('add column participant_id uuid');
expect(sql).toContain('participants_workspace_email_normalized_unique_idx');
expect(sql).toContain('create or replace function public.create_participant_invitation');
expect(sql).toContain('create or replace function public.accept_participant_invitation');
expect(sql).toContain('create or replace function public.revoke_participant_invitation');
```

- [ ] **Step 2: Run the migration assertion and confirm it fails**

Run:

```bash
npx vitest run tests/participant-email-access.migration.test.ts
```

Expected: failure because the migration file does not exist.

- [ ] **Step 3: Add the additive schema and atomic RPCs**

Create the migration with these database rules:

```sql
alter table public.participants
  add column email text,
  add column email_normalized text,
  add column user_id uuid references public.users(id) on delete set null;

create unique index participants_workspace_email_normalized_unique_idx
  on public.participants (workspace_id, email_normalized)
  where deleted_at is null and is_active and email_normalized is not null;

alter table public.workspace_invitations
  add column participant_id uuid,
  add column delivery_status text not null default 'pending',
  add column delivery_attempted_at timestamptz,
  add column delivery_sent_at timestamptz,
  add constraint workspace_invitations_delivery_status_check
    check (delivery_status in ('pending', 'sent', 'failed')),
  add constraint workspace_invitations_participant_fk
    foreign key (workspace_id, participant_id)
    references public.participants(workspace_id, id);
```

Use `create_participant_invitation` to lock the target participant, reject a conflicting active participant email, set the participant email, and insert the pending invitation in one transaction. Use `accept_participant_invitation` to lock the pending invitation, verify the provided token hash, normalized email, and expiry, create or activate one workspace membership with the stored role, link `participants.user_id`, and mark the invitation accepted. Use `revoke_participant_invitation` to mark only a pending invitation revoked and clear identity fields only when they still match that invitation email and have no linked user.

- [ ] **Step 4: Add invitation-handoff environment validation**

In `src/config/env.ts`, add `INVITATION_HANDOFF_URL` as an optional URL in development and require it when SMTP is configured or in production. Export:

```ts
INVITATION_HANDOFF_CONFIGURED: Boolean(value.INVITATION_HANDOFF_URL),
```

Document `INVITATION_HANDOFF_URL=https://ourweekapp.com/invite` in `.env.example`. Add env tests for complete production SMTP/handoff configuration and for rejecting production configuration without the URL.

- [ ] **Step 5: Run focused migration and environment tests**

Run:

```bash
npx vitest run tests/participant-email-access.migration.test.ts tests/env.test.ts
```

Expected: both files pass and the migration contains no destructive statements.

---

### Task 2: Extend participant and authentication contracts with server-owned identity

**Files:**

- Modify: `src/modules/participants/participants.schema.ts`
- Modify: `src/modules/participants/participants.repository.ts`
- Modify: `src/modules/participants/participants.service.ts`
- Modify: `src/modules/auth/auth.schema.ts`
- Modify: `src/modules/auth/auth.routes.ts`
- Modify: `src/modules/auth/auth.service.ts`
- Test: `tests/auth.service.test.ts`
- Test: `tests/participants.service.test.ts`

**Interfaces:**

- `ParticipantDto` responses gain `email?: string`; sync request DTO remains profile-only.
- `RegisterRequestDto` and Google-sign-in request DTO gain optional `invitationToken?: string`.
- `createInitialParticipants(supabase, workspaceId, ownerDisplayName, ownerEmail, ownerUserId)` persists owner identity.
- `registerUser` and `signInWithGoogle` return an invited-workspace `AuthSessionDto` when passed a valid invitation token.

- [ ] **Step 1: Write failing auth and participant service tests**

Add tests that prove ordinary registration inserts this owner row without exposing user ID to clients:

```ts
expect(participantInsert[0]).toMatchObject({
  workspace_id: 'workspace-1',
  name: 'Rita',
  email: 'rita@example.com',
  email_normalized: 'rita@example.com',
  user_id: 'user-1',
});
```

Add password and Google invitation-aware registration tests that pass `invitationToken`, assert no `workspaces` or bootstrap `participants` inserts occur, and assert the returned session is for `workspace-invited`. Add a participant-list assertion that includes `email` but never `userId`, and a sync-schema assertion rejecting `email`, `emailNormalized`, or `userId` in participant payloads.

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```bash
npx vitest run tests/auth.service.test.ts tests/participants.service.test.ts
```

Expected: failures because registration does not accept invitation tokens or persist owner identity.

- [ ] **Step 3: Implement repository mappings and response/request schemas**

Extend `PARTICIPANT_COLUMNS`, `ParticipantRow`, and repository DTO mapping with `email` and `email_normalized`, but not `user_id` in public DTOs. Add optional `email` to `participantSchema` response fields only. Define a separate `participantSyncProfileSchema` with only profile fields and call `.strict()` on each sync participant item, so identity values are rejected instead of silently stripped at the HTTP boundary.

- [ ] **Step 4: Implement ordinary and invitation-aware signup branches**

Refactor the initial participant helper to accept the owner user ID and normalized email:

```ts
await createInitialParticipants(
  supabase,
  workspace.id,
  body.displayName,
  email,
  user.id,
);
```

Before ordinary workspace creation, resolve a supplied invitation token by hash and verify its pending status, expiry, and invited email. For a valid token, create the user, call the acceptance RPC, load its resulting membership, and call the existing session issuer with that membership. Do not call workspace bootstrap or `createInitialParticipants` in this branch. Preserve registration cleanup for any newly created user if acceptance fails.

- [ ] **Step 5: Run focused auth and participant checks**

Run:

```bash
npx vitest run tests/auth.service.test.ts tests/participants.service.test.ts
npm run typecheck
```

Expected: ordinary signup binds the owner participant; invitation signup joins the invited workspace without extra rows.

---

### Task 3: Create, deliver, resend, accept, and revoke participant invitations

**Files:**

- Modify: `src/shared/mailer/mailer.ts`
- Modify: `src/modules/workspace/workspace.schema.ts`
- Modify: `src/modules/workspace/workspaces.repository.ts`
- Modify: `src/modules/workspace/workspace.service.ts`
- Modify: `src/modules/workspace/workspace.routes.ts`
- Modify: `src/modules/auth/auth.routes.ts`
- Modify: `src/modules/auth/auth.service.ts`
- Test: `tests/workspace.service.test.ts`
- Test: `tests/workspace.repository.test.ts`
- Test: `tests/api-contract.routes.test.ts`
- Test: create `tests/workspace-invitation-acceptance.service.test.ts`

**Interfaces:**

- `POST /v1/workspace/invitations` requires `{ participantId, email }` and derives its role from the stored participant type.
- `POST /v1/workspace/invitations/:invitationId/resend` rotates the token and returns delivery state.
- `POST /v1/auth/invitations/accept` requires authentication plus `{ token }` and returns `AuthSessionDto` scoped to the invited workspace.
- Invitation DTOs gain `participantId` and `deliveryStatus`; they never return token hashes or user IDs.
- `sendWorkspaceInvitationEmail(to, { participantName, invitationUrl })` uses the existing SMTP transporter.

- [ ] **Step 1: Add failing service and route contract tests**

Test creation for adult, child, and other participants. Assert only `adult` requests an `adult_member` invitation role at the repository boundary; child and other request `viewer`. Assert the create request rejects a missing participant ID, a cross-workspace participant, and duplicate participant email. Add tests that SMTP failure leaves a pending invitation with `deliveryStatus: 'failed'` and causes a stable `503 invitation_delivery_failed` response.

Test resend rotates the token hash and sends a fresh URL. Test acceptance rejects a mismatched signed-in email and a consumed/expired token, then succeeds with a member role and participant user link. Assert its new auth response uses `workspace-invited`, not the caller's old workspace.

- [ ] **Step 2: Run the invitation tests and confirm they fail**

Run:

```bash
npx vitest run tests/workspace.service.test.ts tests/workspace.repository.test.ts tests/api-contract.routes.test.ts tests/workspace-invitation-acceptance.service.test.ts
```

Expected: failures because invitations are email-only and no delivery/acceptance routes exist.

- [ ] **Step 3: Add mailer support without logging tokens**

Add this narrow public mailer contract:

```ts
export async function sendWorkspaceInvitationEmail(
  to: string,
  input: { participantName: string; invitationUrl: string },
): Promise<void>
```

Use the existing transport and `EMAIL_FROM`. The message must identify the participant and state the seven-day expiry, but must not include user IDs, hashes, or raw token values in logs. Compose the link from `new URL(env.INVITATION_HANDOFF_URL)` and put the raw token in the `token` query parameter only.

- [ ] **Step 4: Replace email-only workspace invitation creation with participant-scoped operations**

Update workspace request/response Zod schemas and repository types with `participantId` and `deliveryStatus`. In `WorkspaceService.createInvitation`, load the participant using the authenticated workspace ID, normalize the email, derive the role, issue `{ rawToken, tokenHash }`, and call `create_participant_invitation` through the repository. Send the email after the RPC commits; on delivery failure, persist `failed` status, log only invitation ID/error metadata, and throw `ApiError(503, 'invitation_delivery_failed', ...)`.

Add resend through the same authorization check and a new token/hash update, and change revoke to call `revoke_participant_invitation` so it cannot clear an accepted member's association.

- [ ] **Step 5: Add authenticated acceptance that switches the active workspace session**

Add `acceptWorkspaceInvitation(supabase, auth, { token })` in `auth.service.ts`. It loads the authenticated user, passes `hashInvitationToken(token)`, user ID, normalized user email, and current time to the acceptance RPC, then issues an `AuthSessionDto` with the accepted membership. Route it under `/v1/auth/invitations/accept` with the existing auth prehandler and response schema. It must reject nonmatching email with `403 invitation_email_mismatch` and invalid, expired, revoked, or consumed invitations with `422 invitation_invalid_or_expired`.

- [ ] **Step 6: Run focused backend verification and regenerate the contract**

Run:

```bash
npx vitest run tests/workspace.service.test.ts tests/workspace.repository.test.ts tests/api-contract.routes.test.ts tests/workspace-invitation-acceptance.service.test.ts
npm run openapi:generate
npm run openapi:check
npm run typecheck
```

Expected: invitation requests are participant-scoped, delivery is observable, and acceptance returns a session for the invited workspace.

---

### Task 4: Replace mobile local invitation links with server-backed identity and acceptance

**Files:**

- Modify: `D:/Projects/myself/weekly-us/src/features/participants/types.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/workspace/types.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/participantsApi.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/workspaceApi.ts`
- Modify: `D:/Projects/myself/weekly-us/src/shared/api/authApi.ts`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/participants.ts`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/workspace.ts`
- Modify: `D:/Projects/myself/weekly-us/src/app/stores/auth.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/participants/participantInvitationEligibility.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/participants/components/HouseholdMembersSettings.vue`
- Modify: `D:/Projects/myself/weekly-us/src/shared/services/deepLinkService.ts`
- Modify: `D:/Projects/myself/weekly-us/src/app/router/index.ts`
- Create: `D:/Projects/myself/weekly-us/src/pages/InvitationAcceptancePage.vue`
- Modify: `D:/Projects/myself/weekly-us/android/app/src/main/AndroidManifest.xml`
- Modify: `D:/Projects/myself/weekly-us/ios/App/App/Info.plist`
- Test: `D:/Projects/myself/weekly-us/src/app/stores/__tests__/workspace.test.ts`
- Test: create `D:/Projects/myself/weekly-us/src/shared/services/__tests__/deepLinkService.test.ts`
- Test: create `D:/Projects/myself/weekly-us/src/pages/__tests__/InvitationAcceptancePage.test.ts`

**Interfaces:**

- `Participant` gains optional `email`; `WorkspaceInvitation` gains `participantId` and `deliveryStatus`.
- `createWorkspaceInvitation({ participantId, email })` no longer accepts `displayName` or `role`.
- `acceptWorkspaceInvitation({ token })` returns a session consumed by `authStore`.
- `resolveDeepLinkRoute('weeklyus://invite?token=abc')` returns `/invitations/accept?token=abc`.

- [ ] **Step 1: Write failing API/store/deep-link tests**

Replace tests that assert persisted `participantInvitationLinks` with server-state assertions. Use participants with `email` and invitations with `participantId` to assert these states:

```ts
expect(store.getParticipantAccessState('adult-1')).toEqual({
  status: 'pending',
  email: 'alex@example.com',
});
expect(store.getParticipantAccessState('child-1')).toEqual({
  status: 'active',
  email: 'sam@example.com',
});
```

Add an API-wrapper expectation that invitation creation posts `{ participantId, email }`. Add deep-link tests for valid invite links, missing tokens, and unrelated schemes. Add page tests for sign-in redirect, invitation-aware signup payload, acceptance success, and an email-mismatch error.

- [ ] **Step 2: Run focused mobile tests and confirm they fail**

Run from `D:/Projects/myself/weekly-us`:

```bash
npx vitest run src/app/stores/__tests__/workspace.test.ts src/shared/services/__tests__/deepLinkService.test.ts src/pages/__tests__/InvitationAcceptancePage.test.ts
```

Expected: failures because invitation association remains local-only and invite deep links are unsupported.

- [ ] **Step 3: Make server responses the single source of participant access state**

Extend participant and workspace API DTO converters with `email`, `participantId`, and `deliveryStatus`. Remove `participantInvitationLinks`, its persisted storage migration, and its normalization helpers from the workspace store. Derive pending state from `workspace.invitations` by participant ID and active state from a participant email matching an active workspace member email. Keep email comparison normalized and do not retain stale status after `applyWorkspace` or participant hydration.

Update invitation eligibility to allow any non-current active participant with no current association. The UI must show SMTP delivery failure and call resend for the returned pending invitation rather than pretending that an email was delivered.

- [ ] **Step 4: Preserve and consume an invitation token across mobile authentication**

Map `weeklyus://invite?token=<token>` in `deepLinkService.ts`, add the matching Android intent filter and iOS URL scheme, and route to `/invitations/accept`. Persist the token only in secure app storage while authentication is pending. The acceptance page redirects signed-out users to sign-in/sign-up with the full invitation route as `redirect`.

Extend password and Google signup API payloads with `invitationToken`; on successful invitation-aware registration, clear the stored token and hydrate the invited workspace. For an existing signed-in account, call `acceptWorkspaceInvitation`, replace auth tokens/session through the existing auth-store persistence path, clear local workspace-bound state, and hydrate the invited workspace.

- [ ] **Step 5: Run focused mobile verification**

Run:

```bash
npx vitest run src/app/stores/__tests__/workspace.test.ts src/shared/services/__tests__/deepLinkService.test.ts src/pages/__tests__/InvitationAcceptancePage.test.ts src/shared/api/__tests__/apiWrappers.test.ts
npm run build
```

Expected: server-backed invitation state survives refresh, invitation deep links survive authentication, and a newly accepted session switches workspace.

---

### Task 5: Add the static Astro invitation handoff page

**Files:**

- Create: `D:/Projects/myself/weekly-us-landing/src/pages/invite.astro`
- Modify: `D:/Projects/myself/weekly-us-landing/src/styles/global.css`
- Test: `D:/Projects/myself/weekly-us-landing` build output

**Interfaces:**

- Consumes a URL of the form `https://ourweekapp.com/invite?token=<opaque-token>`.
- Produces a client-side handoff to `weeklyus://invite?token=<opaque-token>` and an install/reopen-email fallback.

- [ ] **Step 1: Create the handoff page with no API calls or analytics of the token**

Create `src/pages/invite.astro` using the project `Layout`. Its browser-only script reads `new URLSearchParams(window.location.search).get('token')`, validates only that it is non-empty, and builds:

```ts
const appUrl = `weeklyus://invite?token=${encodeURIComponent(token)}`;
window.location.replace(appUrl);
```

Show a fallback button using the same URL and static text telling users without the app to install it and reopen the email. Do not place the token in page markup, analytics events, links to third parties, or server-rendered logs.

- [ ] **Step 2: Add focused visual styling**

Add only the page-specific classes needed for the handoff status, fallback button, and compact mobile layout. Reuse the existing colors, typography, layout, and cookie component from `Layout.astro`.

- [ ] **Step 3: Build the static landing site**

Run from `D:/Projects/myself/weekly-us-landing`:

```bash
npm run build
```

Expected: Astro generates `/invite/index.html`; no token values are embedded in build output.

---

### Task 6: Run end-to-end regression checks and document deployment configuration

**Files:**

- Modify: `docs/openapi.json`
- Modify: `.env.example`
- Verify: all backend, mobile, and landing-site files above

**Interfaces:**

- Consumes registered Fastify routes and production environment settings.
- Produces a checked-in OpenAPI document and a deployable invitation setup.

- [ ] **Step 1: Run complete backend checks**

Run from `D:/Projects/myself/weekly-us-api`:

```bash
npm run typecheck
npm test
npm run openapi:check
npm run build
```

If the known unrelated environment-test ordering issue or parallel-test timeout occurs, rerun the affected files alone and report both outcomes without changing unrelated tests.

- [ ] **Step 2: Run complete mobile and landing builds**

Run:

```bash
cd D:/Projects/myself/weekly-us
npm test
npm run build

cd D:/Projects/myself/weekly-us-landing
npm run build
```

Expected: all focused invitation tests and both production builds pass.

- [ ] **Step 3: Manually verify the production-like invitation flow**

1. Configure SMTP and `INVITATION_HANDOFF_URL=https://ourweekapp.com/invite` on the API.
2. Register a normal owner and confirm their participant has the same normalized email and user ID server-side.
3. Invite an adult, child, and other participant; confirm the stored roles are `adult_member`, `viewer`, and `viewer`.
4. Open the emailed landing URL on a device with the app installed and confirm it opens the acceptance flow.
5. Create an invited account and confirm no extra workspace or `Me`/`Partner` pair is created.
6. Sign in with an existing invited email, accept the token, and confirm the active session/workspace changes to the invited household.
7. Revoke a pending invitation and confirm only that participant email association is cleared.
8. Retry a failed SMTP delivery and confirm the prior link no longer works after token rotation.

- [ ] **Step 4: Inspect the final diff without staging or committing**

Use repository-local safe-directory overrides where required. Confirm no raw invitation token, password, SMTP credential, user ID response field, or unrelated generated mobile asset is included in the diff.
