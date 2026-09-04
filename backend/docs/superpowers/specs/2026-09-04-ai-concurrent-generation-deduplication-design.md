# AI concurrent generation deduplication design

## Scope

AI-05 prevents two identical concurrent meeting-summary requests from making two
provider calls or settling two recap credits. It applies only to one generation
identity:

- `workspace_id`
- `meeting_id`
- `input_hash`

`input_hash` already includes the system prompt, sanitized prompt payload, and
effective model. Therefore a changed meeting, locale-dependent payload, prompt,
or model naturally produces a different identity.

This design does not implement stale-request recovery (AI-06) or atomic summary,
audit, and credit finalization (AI-07). It preserves their current behavior and
does not treat an old pending request as failed.

## Chosen approach

Use a database-owned claim operation plus a partial unique index. Application
process locking is not safe across service instances, and a durable asynchronous
job/status API is intentionally outside this focused change.

The migration will:

1. Add a nullable internal JSONB summary snapshot to `ai_summary_requests`.
2. Add a partial unique index on `(workspace_id, meeting_id, input_hash)` where
   `status = 'pending'` and `input_hash is not null`.
3. Create a service-role-only `claim_ai_summary_generation` RPC. It accepts the
   workspace, meeting, user, provider, and nonempty input hash.

The RPC acquires a transaction-scoped advisory lock derived from the complete
generation identity. While holding the lock it returns the newest matching
completed request with a non-null summary snapshot, otherwise the matching
pending request, otherwise it inserts and returns a new pending request. The
partial unique index remains a database-level invariant if future code bypasses
the RPC.

The RPC response identifies `created`, `pending`, or `completed` and includes
the claimed/existing request record. It is not granted to public, anonymous, or
authenticated roles.

## Service behavior

After the current authorization, meeting revision, completion, rate-limit,
participant, payload, and model checks calculate the input hash, the service
uses the claim RPC instead of a completed-cache lookup followed by a separate
insert.

- `completed`: validate and return the persisted request snapshot. No provider
  call, allowance check, reservation, or new request is made.
- `pending`: return `409 ai_summary_generation_in_progress` with a safe,
  retryable message and the existing request ID in error details. The caller
  does not reserve a credit or call the provider.
- `created`: continue through the existing allowance, reservation, rate-limit,
  provider, meeting-update, request-completion, and credit-settlement flow.

On successful generation the request completion write also records the validated
summary snapshot. This makes a cache result demonstrably belong to the matching
input hash rather than treating the current `meetings.ai_summary` value as proof.
Historical completed rows without a snapshot are not cache hits; a later request
can create a new pending claim for the same input.

Failures after a new claim retain existing handling: the row becomes `failed`,
and any reserved credit is released. A later retry can create a new claim but
must still pass allowance and rate-limit enforcement and reserve its own credit.
An interrupted pending request remains pending until the separate AI-06 recovery
work, rather than being released by this feature.

## API and compatibility

The successful `POST /v1/ai/meeting-summary` response is unchanged. Add the
stable `409` error code `ai_summary_generation_in_progress`; clients should wait
briefly and retry the same request. Existing error schemas already support 409,
so the public response shape remains the standard safe error DTO.

The migration is additive and compatible with rolling deployment:

- Old code continues to create and complete requests with a null snapshot.
- New code only depends on the RPC after the migration is applied.
- New code does not return an old null-snapshot row as cached output.

The corresponding deployment order is migration first, then backend code. No
production migration, deployment, provider request, or client retry behavior is
part of this change without separate authorization.

## Tests and verification

Service tests will use a controllable provider promise so two identical calls
overlap. They will assert one owner/provider call/reservation/settlement and one
duplicate `409`; once completed, the same input returns the stored snapshot with
no additional charge.

Additional tests cover failed-attempt retry, different input hashes, and distinct
workspace IDs to ensure no accidental cross-input or cross-workspace deduplication.
Repository/RPC integration coverage will exercise concurrent claims, the unique
index invariant, and result states against an isolated local database only. If
no suitable isolated database is configured, that integration check remains
explicitly unrun; production credentials must never be used.

## Security and operational constraints

All claim and request queries remain workspace-scoped. The summary snapshot is
internal and is returned only through the existing authorized service path. The
RPC uses service-role-only grants and validates required identity inputs. Logs
will retain request IDs and safe state/error codes without prompt or meeting
content.

## Spec self-review

No placeholders remain. The input identity, duplicate semantics, cache source,
failed-retry behavior, migration ordering, testing boundary, and AI-06/AI-07
scope are explicit and internally consistent.
