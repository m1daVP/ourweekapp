# AI stale reservation recovery design

Date: 2026-09-04.

References: [AI_READINESS_REVIEW.md](../../../AI_READINESS_REVIEW.md), AI-06; [AI_RELEASE_CHECKLIST.md](../../../AI_RELEASE_CHECKLIST.md), step 4.

## Goal

Recover recap allowance consumed by a process-interrupted AI generation without
releasing live or completed work. The next eligible request and the
subscription-status response must observe the same recovered allowance.

## Scope

This work addresses AI-06 only. It does not make summary persistence, request
completion, and credit settlement atomic; that is AI-07. It does not change
allowance limits, provider behavior, request authorization, public response
DTOs, or the 15-minute reservation lifetime already used by the current
reservation function.

## Chosen approach

Add a dedicated, service-role-only reconciliation RPC in a new Supabase
migration. It uses the established workspace advisory lock and treats a
request as abandoned only when all of these are true:

- the request belongs to the supplied workspace;
- it is still `pending`;
- it is older than 15 minutes; and
- it has no linked recap credit, or its linked recap credit is still
  `reserved` and older than 15 minutes.

For a qualifying request, reconciliation records durable diagnostic history by
setting `status = 'failed'`, `completed_at` to the reconciliation time, and
`error_code = 'ai_summary_request_abandoned'`. It changes a linked qualifying
credit to `released` and records `released_at` in the same database operation.
No request or reservation row is deleted.

The operation is idempotent: a later call finds no pending stale request or
reserved stale credit, so it makes no additional accounting change. It never
changes a request that is still within the 15-minute timeout, a completed or
failed request, or a settled/released credit. A completed request that still
has a reserved credit is deliberately out of scope for this recovery; AI-07
will reconcile that finalization inconsistency without risking a lost charge
for an already saved recap.

The timeout is a recovery boundary, not an automatic provider retry. A caller
receiving the former pending request's conflict can make a fresh generation
request after recovery, which creates a new request and re-applies ordinary
authorization, rate-limit, and allowance checks.

## Components and data flow

### Database

Create a new migration; do not edit
`20260829120000_add_recap_allowances_and_member_caps.sql`. The migration adds
`public.reconcile_abandoned_assistant_recap_requests(p_workspace_id uuid)`
returning `void`. It must validate its workspace argument, acquire the existing
workspace credit advisory lock, and run as `security definer` with an empty
search path. It marks each qualifying workspace-scoped stale pending request
as failed; when such a request has a linked stale reserved credit, it releases
that exact credit in the same operation. A linked settled or released credit
excludes a pending request from recovery, preserving that anomaly for AI-07
rather than misclassifying completed work. Revoke public, anonymous, and
authenticated execution and grant only `service_role`.

The migration redefines `reserve_assistant_recap_credit` to invoke the
reconciliation function before its existing reservation count and insert
logic. This is a defensive backstop for future call sites; the application
still invokes reconciliation before a generation claim so that a stale pending
request does not block the AI-05 claim RPC. The reservation operation remains
the concurrency authority for allocating a credit.

The reconciliation query scopes every request and credit to the supplied
workspace and updates a linked credit only through the same
`ai_summary_request_id`. Its row already retains the period-end value, so the
operation cannot make a Free reservation count toward Premium or vice versa.
The status calculation continues to count only `reserved` and `settled`
credits in the selected allowance period, now after reconciliation.

### Repository and services

`AssistantRepository` gains a typed
`reconcileAbandonedRecaps(workspaceId): Promise<void>` wrapper for the new RPC.
It throws the existing safe repository error shape on a database failure; raw
database details never reach a client or log.

`AiSummaryService` invokes this wrapper after verifying an eligible completed
meeting and before `claimSummaryGeneration`. A reconciliation failure stops
generation before any provider call, new claim, or new reservation.

The billing subscription-status service invokes the same wrapper immediately
before `countUsedRecaps` in each Free and Premium allowance branch. Thus an
eligible caller sees a recovered balance before deciding whether to generate.
Authorization remains at the existing route/service boundaries; recovery is
always scoped to the authenticated caller's workspace.

## Failure behavior

- Reconciliation database/RPC failures are safe backend failures. The service
  does not report recovered allowance or start provider work unless the RPC
  completed successfully.
- The existing safe allowance-exhausted response remains unchanged when active
  or settled credits genuinely consume the limit.
- The recovery operation does not call OpenAI, log meeting content, modify
  provider state, or retry an abandoned request automatically.
- The original AI-07 catch/finalization behavior is unchanged by this scoped
  work. A completed request with a still-reserved credit stays visible for the
  later atomic-finalization/reconciliation design rather than being released.

## Verification

Automated regression tests will establish the intended behavior before the
implementation:

- repository tests assert the workspace-scoped reconciliation RPC contract and
  safe error mapping;
- AI service tests prove reconciliation precedes a generation claim, stale
  pending work no longer returns an in-progress conflict, and a recovery
  failure prevents provider work;
- billing tests prove status counts after recovery for both Free and Premium;
- migration tests cover service-role-only access, advisory locking, 15-minute
  boundary, request failure history, idempotency, workspace scoping, and the
  preservation of active, completed, settled, released, and cross-period
  records.

The existing 15-minute threshold must remain safely above the configured
end-to-end provider request timeout before release. If a later provider budget
could reach that threshold, increase the recovery threshold in a dedicated
follow-up rather than risking recovery of live work.

If a local Supabase database is available, a separate integration test will
seed Free and Premium reservations, execute the RPC repeatedly, and verify
the resulting rows. It must use an isolated local database, never staging or
production credentials. Absence of that environment blocks only the
integration test, not the unit/migration checks.

## Manual release checks

Before release, simulate a process interruption after a request has claimed
and reserved a credit. At the 15-minute boundary, confirm status shows the
recovered allowance, an identical retry can obtain a fresh claim, and no
provider call was made for the abandoned request. Repeat for a Premium period,
alongside a live reservation and a settled credit; neither must change.

## Implementation result

Implemented on 2026-09-04. The new migration creates the locked,
service-role-only recovery RPC and routes the existing reservation RPC through
it. Repository, AI-generation, and subscription-status callers use the same
recovery policy. Focused tests, the full backend suite, `npm run typecheck`,
and `npm run build` pass. The guarded local-Supabase integration test skipped
because local credentials are absent; no migration was applied outside this
workspace, and staging/manual/release checks remain open.
