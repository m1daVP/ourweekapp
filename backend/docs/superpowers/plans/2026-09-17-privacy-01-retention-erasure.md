# Account Retention and Erasure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. If unavailable, follow the tasks directly; see the index for execution constraints.

**Goal:** Make verified account deletion, restoration, retained household data, and published retention commitments agree and be demonstrably enforceable.

**Architecture:** Keep immediate access revocation and household ownership transfer in the atomic account-deletion RPC. Add a durable, retryable erasure lifecycle only after the owner resolves its interaction with restoration. Provider cleanup and backup enforcement are separate responsibilities, with explicit evidence and bounded retention.

**Tech Stack:** Node.js, TypeScript, Fastify, Supabase/PostgreSQL, Vitest; Vue and Astro legal content.

## Global Constraints

- Read the [handoff index](2026-09-17-privacy-remediation-index.md). No production data mutations or deployment from this plan alone.
- Preserve the `DELETE /v1/account` successful `204` response unless a separate API migration is approved.
- Never equate `deleted_at` with erasure or irreversibly anonymous data.
- Never replace a documented retention deadline with indefinite retention just to match incomplete code.
- Existing restoration is intentional and must be resolved explicitly before irreversible implementation.

## Evidence and file map

Read/modify as needed:

- `API/src/modules/account/account.service.ts`, `account.repository.ts`, `account.routes.ts`: deletion orchestration, DB boundary, stable HTTP contract.
- `API/supabase/migrations/20260607143100_create_account_delete_rpc.sql`: read-only baseline; marks users/workspaces deleted, revokes sessions, clears calendar tokens.
- `API/supabase/migrations/20260912120000_create_account_restore_rpc.sql`: read-only restoration baseline.
- `API/scripts/restore-deleted-account.ts`, `API/docs/account-restoration.md`: current support workflow.
- `API/src/shared/jobs/job.queue.ts`, `job.schema.ts`, `job.worker.ts`, `API/src/worker.ts`, `API/src/config/worker-env.ts`: existing job infrastructure; current worker has an empty handler map, so availability of an actual deployed handler cannot be assumed.
- `API/src/modules/calendar/calendar.service.ts`, `google-oauth.client.ts`: provider cleanup; coordinate with Plan 02.
- Existing tests: `API/tests/account-deletion.integration.test.ts`, `account.service.test.ts`, `account.repository.test.ts`, `account.routes.test.ts`, `account.migration.test.ts`, `account-restore.migration.test.ts`, `restore-deleted-account.script.test.ts`.
- Legal publication: `MOBILE/src/features/legal/productionLegalContent.ts`, its test, `MOBILE/src/pages/__tests__/LegalPages.test.ts`; `LANDING/src/pages/privacy.astro`, `terms.astro`, `delete-account.astro`.
- Create `API/docs/account-retention-runbook.md` for the decisions, inventory, operational evidence, exceptions, and recovery process.
- Proposed new code after Task 1: `API/src/modules/account/account-erasure.service.ts`, `account-erasure.repository.ts`, `API/tests/account-erasure.service.test.ts`, `account-erasure.integration.test.ts`, and a fresh timestamped migration for the approved lifecycle. Do not reserve an old/applied migration filename.

### Task 1: Establish the deletion contract and inventory

**Deliverable:** an actionable runbook, with owner-approved lifecycle and a complete dependency inventory. This is required before writing destructive SQL.

- [ ] Read all schema migrations referencing users, workspaces, participants, creators, subscriptions, AI records, invitations, auth identities, and queued payloads. Supplement source inspection with local PostgreSQL FK metadata:

```sql
select conrelid::regclass as child_table,
       confrelid::regclass as parent_table,
       pg_get_constraintdef(oid) as relationship
from pg_constraint
where contype = 'f'
  and confrelid in ('public.users'::regclass, 'public.workspaces'::regclass)
order by child_table::text;
```

- [ ] Document each table's deletion/anonymization action and why retained rows are needed. Inspect non-FK identity copies: invitation email, participant email/name, JSON, provider IDs, webhook records, generated exports, error/support logs. Do not print real data.
- [ ] Separate three cases: sole owner without eligible successor; owner with eligible successor; non-owner member. Preserve other people's legitimate shared records and transferred ownership. A pseudonymous user ID or retained identifiable note is not automatically anonymous.
- [ ] Obtain the lifecycle decision: recommended default is immediate access revocation followed by prompt irreversible erasure, with 30 days a maximum completion deadline rather than a default holding period. If the owner retains restoration, require an explicitly selected, disclosed grace period and a purge deadline inside the commitment. Do not invent a duration or silently remove the restoration feature.
- [ ] Define how verified email requests enter the same workflow, how identity is checked without passwords/tokens in support messages, and how requests concerning retained shared content are handled.
- [ ] Record an action for already soft-deleted accounts. Produce a count-only dry run and rollout proposal; do not automatically bulk-purge legacy records.
- [ ] Confirm backup expiry start event: request receipt, verified request, live-data removal, or backup creation. The existing unqualified 90-day sentence is ambiguous. List PITR, snapshots, manual exports, third-party copies, and restoration suppression requirements.

### Task 2: Implement and prove the approved database lifecycle

**Interfaces:** proposed internal contract (no new public endpoint):

```ts
export type ErasureResult = 'erased' | 'already_erased' | 'not_eligible';
export interface AccountErasureRepository {
  eraseEligibleAccount(requestId: string): Promise<ErasureResult>;
}
```

The database owns eligibility and timestamps. Do not trust client dates or allow a public caller to select a purge time. The durable request is keyed by a non-secret UUID; any retained account linkage requires a documented retention purpose and expiry.

- [ ] Add a new migration recording verified requests, states, approved eligibility time, attempt metadata, completion time, and narrowly defined holds if actually required. State transitions and enqueue/durable dispatch intent must be atomic with `account_delete`; a process crash between deletion and queuing must not orphan erasure.
- [ ] Use existing queue infrastructure when suitable; otherwise a bounded scanner over durable requests is sufficient. Do not add a second queue framework. Secure new tables with RLS/deny-client access and service-role-only RPC grants.
- [ ] Write failing local DB tests using the fixture helpers in `account-deletion.integration.test.ts`. Prove actual row outcomes rather than only searching migration SQL. Add these independent scenarios:
  - sole-owner content is removed according to the approved inventory;
  - surviving household content/ownership remain correct;
  - account email, credentials, reset tokens, auth identities, sessions and unnecessary identifying metadata are gone;
  - unrelated users/workspaces are untouched;
  - anonymous/authenticated roles cannot invoke erasure;
  - repeated calls are safe;
  - simultaneous restoration and purge cannot restore a partially erased account;
  - interrupted transactions leave no partially deleted household;
  - a genuine scoped legal hold retains only specified records and does not block unrelated erasure;
  - late billing/provider callbacks cannot resurrect deleted identities or entitlements.
- [ ] Lock the request/user and affected workspace rows in a consistent order. Recheck eligibility after acquiring locks. Apply the table inventory in safe FK order; do not blindly cascade a deleted owner into a surviving household.
- [ ] Update restoration SQL in a NEW migration and its CLI/tests for the selected lifecycle: reject after erasure, prevent bypass of pending irreversible deletion, or atomically cancel an eligible grace-period request where the approved policy permits this.
- [ ] Keep sessions and provider credentials revoked even if an approved restoration succeeds. Update `docs/account-restoration.md` with the exact limits.

### Task 3: Add reliable dispatch, external cleanup, and evidence

**Interfaces:** job envelope reuses the existing schema:

```ts
const job = {
  type: 'account.erase',
  version: 1 as const,
  idempotencyKey: `account.erase:${requestId}`,
  payload: { requestId },
};
```

`requestId` is the durable request UUID produced by Task 2. Never put email, passwords, raw tokens, or notes into the queue or dead-letter records.

- [ ] Add a handler that validates a strict UUID payload, invokes the repository, acknowledges idempotent outcomes, and retries transient failures through existing worker behavior. Register it in `src/worker.ts` and ensure the scheduler/scanner actually dispatches all due requests.
- [ ] Unit-test the handler/service with the proposed result contract:

```ts
it('treats replay after completed erasure as successful', async () => {
  const repository = { eraseEligibleAccount: vi.fn().mockResolvedValue('already_erased') };
  const service = new AccountErasureService(repository);
  await expect(service.erase('11111111-1111-4111-8111-111111111111'))
    .resolves.toBe('already_erased');
});
```

Implement `AccountErasureService.erase(requestId: string): Promise<ErasureResult>` as a narrow orchestration method. Test malformed IDs, provider timeouts, retries, and no sensitive logging separately.
- [ ] Coordinate Google revocation before credentials are irretrievably discarded. If durable retry needs an encrypted credential, store it in a tightly scoped cleanup record with expiry, never a general queue payload. Do not block immediate account/session revocation indefinitely on provider availability.
- [ ] Define and implement approved cleanup/request procedures for RevenueCat, AI/support/log providers where applicable. Do not cancel a store subscription by implication; cancellation remains separate and clearly disclosed.
- [ ] Produce counts and oldest-outstanding-request age for operational monitoring, with alerts before the promised deadline. Check paused workers, failures, and dead letters; a unit test alone does not prove operational delivery.
- [ ] Document backup configuration evidence and a backup-restore drill that reapplies deletion records before restored data serves traffic. Define retention for the deletion ledger itself.

### Task 4: Align documents and validate rollout

- [ ] Replace the repeated 30/90-day language only with the verified contract, naming exceptions and retained household records precisely. Update mobile, all three website pages, and any maintained root legal Markdown copies together.
- [ ] Replace tests that merely require `30 days`/`90 days` with checks for the approved policy sections; retain DB/operational evidence separately. Set an actual publication effective date during release, not an invented retroactive one.
- [ ] Run in API: `npm run typecheck`, focused erasure/deletion/restoration tests, `npm test`, and `npm run build`. Run local DB migrations with `npm run db:migrate:local`, then `npm run db:verify:local` against isolated fixtures. Never substitute remote `db:migrate` for a local command.
- [ ] Record whether DB integration tests executed or skipped. For risky migration rollout require staging fixtures, backup/recovery plan, DB review, migration-before-code ordering and worker deployment evidence.
- [ ] Run mobile legal tests and `npm run build`/`npm run check` if source changed; run landing `npm run build` if Astro changed.

**Acceptance:** deletion is more than access removal; approved restoration rules cannot bypass erasure; no unrelated household loss; retries are safe; published deadlines have a working mechanism and production evidence. If infrastructure evidence is missing, report the release blocker without claiming completion.
