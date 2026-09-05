# AI Rate Limits and Entitlement Freshness Design

## Goal

Make AI generation, subscription status, and the documented policy agree: a rolling hourly anti-abuse limit of five new provider generations per adult user and 20 per workspace, plus one trusted-entitlement policy for Premium recap allowances.

## Scope

This design covers AI-12 and AI-13 only. It changes server-side anti-abuse enforcement, entitlement resolution for recap allowances, test coverage, and the related readiness documentation. It does not change recap-credit amounts, mobile recovery UI, provider retry behavior, RevenueCat configuration, or existing historical-recap access.

## Product Rules

- The anti-abuse window is rolling: each eligible generation occupies a slot until one hour after its `created_at` time.
- An adult user may have at most five slots in a workspace; the workspace may have at most 20 slots across its adult users.
- A slot is created only for a new input that will call the provider. A completed cache hit and an identical request that is already pending return before the anti-abuse check and create no additional slot.
- Validation, authorization, meeting-state, allowance, and claim failures create no slot. A provider, output-validation, revision-conflict, or finalization failure is marked failed and no longer counts toward the anti-abuse window.
- Recap credits are separate from anti-abuse slots. A successful new generation settles one recap credit; a cache hit or failed generation settles no additional credit.
- The `resetAt` returned for a rate-limit rejection is the exact expiry of the oldest blocking slot, not a newly calculated hour from the rejection time.
- Existing adult-role authorization remains before any rate-limit lookup. A viewer is rejected without exposing rate-limit state.

## Trusted Subscription Policy

- Premium applies only if the stored subscription is active according to `resolveEffectivePlan`, unexpired, and was checked within the existing 24-hour trusted-entitlement cache window.
- Subscription status retains its current behavior: when RevenueCat is configured it attempts a live refresh; on a refresh failure it uses only a recently checked cached Premium record, otherwise Free.
- AI generation uses the same trusted cached-record rule. A stale, invalid, missing, or expired Premium record resolves to Free before it counts or reserves recap credits.
- The Free fallback uses the workspace's lifetime Free recap allowance. It never uses expired Premium credits.
- A newly trusted Premium record opens a fresh allowance period identified by its current `expiresAt`; only reservations in that exact period count. Prior-period credits cannot leak into the renewal period.

## Architecture

The existing service-role `claim_ai_summary_generation_v2` RPC is the concurrency boundary because it already serializes claims with a workspace advisory lock. Extend it in a new additive migration to accept the two configured limits after it has checked for completed-cache and pending-duplicate results. For a new request, it counts only `pending` and `completed` request rows whose `created_at` remains inside the rolling window, independently for the requester and workspace. It returns a typed rate-limited claim result, including the earliest applicable expiry, without inserting a request; otherwise it inserts and returns the new pending request as it does today.

`AiRepository` maps the expanded RPC result. `AiSummaryService` replaces its pre-claim and post-reservation count/recheck calls with one claim result branch, preserving the existing safe `429 ai_summary_rate_limited` API shape and releasing no credit when no new request was claimed. Marking an attempted generation failed removes it from the qualifying request states, so provider and persistence failures are not held against the user for an hour.

For entitlement freshness, a narrow billing helper will expose the trusted effective plan decision already used by feature access. `SubscriptionService` and `AiSummaryService` will use that helper before deriving recap allowance usage and `periodEndsAt`, preventing drift between status and generation. The existing RevenueCat refresh path remains in `SubscriptionService`; generation stays database-backed and never performs an unbounded provider entitlement call.

## Data Flow

1. The service authenticates the caller, checks adult role, meeting ownership/state, and builds the generation input hash.
2. The claim RPC first returns a matching completed cache result or pending duplicate without applying the hourly policy.
3. For a genuinely new input, the same workspace-locked RPC counts eligible slots and either returns a user/workspace rate-limit result with the oldest slot's expiry or inserts the pending request.
4. After a successful claim, the service resolves the workspace plan through the trusted entitlement helper, calculates the appropriate Free or Premium allowance, and reserves one recap credit.
5. The provider call and atomic finalization proceed unchanged. A failure releases the reserved credit and marks the request failed; that failed row is not a rate-limit slot.
6. Subscription status and generation both resolve stale/expired Premium to Free. A current Premium record scopes recap usage by its exact expiry timestamp.

## Error Handling and Compatibility

- Preserve `429 ai_summary_rate_limited`, its `userLimit`, `workspaceLimit`, `windowSeconds`, `scope`, `remaining`, and `resetAt` fields. Values change to 5, 20, 3,600, zero, and the actual relevant expiry respectively.
- Preserve the existing duplicate-in-progress `409`, cache response DTO, allowance-exhausted `429`, and provider error contracts.
- The expanded RPC remains `security definer`, fixes `search_path`, revokes public/anonymous/authenticated execution, and grants only `service_role`.
- Add a new migration; do not modify migrations that may have already run.
- All request and subscription queries remain workspace-scoped. The workspace advisory lock prevents concurrent users from oversubscribing the shared workspace cap.

## Verification

- Unit/service tests: exact fifth/sixth user boundary; 20th/21st workspace boundary; user and workspace scope selection; viewer denial before the claim; cache and pending duplicate exclusion; provider/persistence failure exclusion; and reset time based on the oldest qualifying request.
- Concurrency coverage: simultaneous distinct requests cannot create more than 20 workspace slots, and the atomic claim returns one clear limiting scope without provider calls for rejected work.
- Billing/AI tests: recently checked Premium; stale Premium fallback to Free; expired Premium fallback to Free; fresh renewal period with no previous-period usage; and equal status/generation allowance decisions for each case.
- Migration and repository tests verify the RPC ordering, qualifying statuses, workspace scoping, limit results, and service-role-only grants.
- Run focused tests, the full backend suite, `npm run typecheck`, `npm run build`, and `npm run openapi:check`. A local isolated-Supabase migration/integration run and staging validation remain required before release.

## Documentation Updates

Update the August 29 recap-allowance design and plan, `AI_READINESS_REVIEW.md`, and `AI_RELEASE_CHECKLIST.md` to replace the unimplemented 3/8 anti-abuse policy with 5/20 and to document the exact counting and entitlement-freshness rules above.
