# AI atomic recap finalization design

Date: 2026-09-04.

References: [AI_READINESS_REVIEW.md](../../../AI_READINESS_REVIEW.md), AI-07;
[AI_RELEASE_CHECKLIST.md](../../../AI_RELEASE_CHECKLIST.md), step 5.

## Goal

Make a successful meeting-summary generation internally consistent: the saved
meeting summary, completed AI request (including its validated output and usage
metadata), and settled recap-credit reservation must either all persist or none
of them persists. A caller must be able to retry an uncertain finalization
without attaching a duplicate summary or charging another credit.

## Scope

This work addresses AI-07 only. It builds on the existing AI-02 revision
protection, AI-05 request claim/cache identity, and AI-06 stale-request
recovery. It does not change provider error classification (AI-08), allowance
limits, rate limits, request authorization, provider prompts, or the public
successful response DTO.

The external provider request remains outside every database transaction. If
the meeting changes after the provider returns, generation fails with the
existing retryable `meeting_update_conflict`; the server does not attach output
based on the earlier input to the changed meeting and does not automatically
make a second provider call.

## Chosen approach

Add a service-role-only PostgreSQL finalization RPC in a new, additive Supabase
migration. The operation owns all three durable success writes and executes
them in its single PostgreSQL transaction:

1. verify the pending request, its workspace/meeting identity, source meeting
   revision, and its recap reservation;
2. persist the generated summary to the matching non-deleted meeting while
   incrementing its server revision;
3. set the request to `completed`, store completion time, token usage, and the
   internal generated-summary cache snapshot; and
4. change the linked reservation from `reserved` to `settled`.

The RPC returns an explicit result state and authoritative updated-meeting
metadata. The repository maps only valid result states to typed values and
does not expose raw database errors.

Calling the RPC again with the same workspace, request, source revision,
summary, and usage is idempotent. If that request was already completed by a
prior call, it returns its persisted outcome without modifying the meeting or
reservation. This handles an application timeout or lost response after the
database committed. It does not call the provider or create a new reservation.

## Components and data flow

### Database

The new RPC accepts a workspace ID, request ID, meeting ID, expected source
revision, validated JSONB summary, completion timestamp, and nullable token
usage fields. It validates required arguments before modifying data, runs as
`security definer` with `search_path` set to empty, and is executable only by
`service_role`.

It uses the existing workspace credit advisory lock so finalization and credit
reservation/recovery cannot disagree. It locks the request and its linked
credit row, scopes each lookup and update by `workspace_id`, and verifies that
the request is pending, belongs to the supplied meeting, and has a `reserved`
credit. It then conditionally updates the meeting with the expected source
revision and `deleted_at is null`. A missing conditional update produces the
revision-conflict result before request or credit state changes.

Once the meeting update succeeds, the RPC updates the request and credit in
the same transaction. Any validation, revision, constraint, or write failure
rolls back every finalization write. The request stays pending and the credit
stays reserved for the existing recovery path; no partial saved summary can
coexist with a failed request and released credit.

For a repeated call, the RPC recognizes the same completed request and returns
its finalization result only if the stored summary and meeting relationship are
consistent. A terminal failed request is not finalized. An inconsistent
completed request/reservation state is surfaced as a safe internal error rather
than silently repairing or double-charging; it remains observable for recovery
and diagnosis.

No existing applied migration is edited. The migration is compatible with a
rolling deployment when applied before backend code that invokes the new RPC.

### Repository and service

`AiRepository` gains a typed `finalizeSummaryGeneration` RPC wrapper and its
claim/complete methods remain available only where still needed by unrelated
code. The finalization result includes the updated meeting DTO or the minimum
authoritative sync fields necessary for the existing response.

`AiSummaryService` retains its current order through claim, allowance,
reservation, secondary rate-limit check, provider call, output normalization,
and schema validation. After provider success it invokes the single
finalization method instead of separately calling `updateMeetingSummary`,
`markSummaryRequestCompleted`, and `settleRecap`.

- An `applied` or idempotent `completed` finalization returns the existing
  success DTO using the authoritative meeting revision and timestamp from the
  RPC.
- A revision mismatch returns `409 meeting_update_conflict`. The service makes
  no second provider request. It marks the pending request failed and releases
  the reservation as cleanup, preserving the conflict as the primary error.
- A finalization database failure is a safe generation failure. The request
  and reservation are deliberately left for AI-06 recovery if the service
  cannot establish whether finalization committed. The service must not mark a
  potentially completed request failed or release a potentially settled credit.

Provider/validation errors before finalization keep the existing failure path:
mark the newly created request failed and release its reservation. Cleanup is
best effort. If marking failed or releasing a credit fails, the service logs a
safe cleanup-failure event with request/workspace IDs and does not replace the
original provider, validation, or revision error.

### Recovery interaction

An interruption before finalization leaves the request pending with a reserved
credit. AI-06 reconciliation can later mark that stale request failed and
release the stale credit. An interruption after atomic finalization commits
leaves a completed request, saved summary, and settled credit; reconciliation
does not modify it. These terminal states converge without a partial-success
combination.

## Failure behavior

- The API preserves the existing safe provider and validation error responses.
- A changed or deleted meeting after provider generation returns
  `meeting_update_conflict`; no old output is saved.
- If the finalization response is lost, repeating finalization is safe and does
  not create another summary revision or settle the same credit twice.
- Failed cleanup never masks the original error and never logs provider output,
  prompt content, keys, tokens, or meeting content.
- The finalization RPC is workspace-scoped and service-role-only; callers
  remain authorized by the existing service before any provider work occurs.

## Verification

Tests are written before implementation and cover:

- an ordinary success path that performs one finalization RPC after one
  provider call, without calling the three former persistence methods;
- RPC/repository argument mapping, result mapping, workspace scoping, and safe
  database error mapping;
- fault injection after provider success and at every old persistence boundary,
  proving a finalization failure does not release/mark-failed potentially
  committed work;
- revision mismatch after provider success: no summary write, request failure
  and credit release cleanup, and the original conflict survives cleanup
  failures;
- ordinary provider/validation failure cleanup, including separate safe log
  assertions when cleanup fails;
- idempotent finalization after an uncertain response, with one meeting
  revision, one completed request, and one settled credit; and
- migration tests for locking, grants, transactional shape, state validation,
  idempotence, and preservation of pending/settled work for AI-06 recovery.

An isolated local-Supabase integration test should seed a meeting, request, and
reservation; simulate each finalization result; and verify committed rows after
repeating the RPC. It must never use staging or production credentials. If the
isolated local database is unavailable, the test is explicitly skipped and
reported as unrun rather than replaced with a production-like connection.

## Manual release checks

Before release, simulate provider success followed by an application crash or
lost finalization response. Verify one saved summary, one completed audit row,
and one settled credit after a retry. Repeat with a concurrent meeting edit;
the old output must not attach, the reservation must ultimately release, and a
fresh request against the new revision must be eligible subject to ordinary
allowance/rate limits. Confirm AI-06 recovers an operation interrupted before
finalization but does not alter a fully finalized one.

## Spec self-review

No placeholders remain. The transaction boundary, idempotence key, changed
meeting behavior, cleanup rules, AI-06 interaction, permissions, deployment
ordering, and verification boundaries are explicit and mutually consistent.
