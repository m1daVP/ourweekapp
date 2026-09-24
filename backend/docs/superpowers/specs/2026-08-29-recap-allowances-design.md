# Recap Allowances Design

## Goal

Show each household’s remaining AI recap allowance and enforce predictable plan limits: three lifetime starter recaps and four signed-in members for Free, or 20 new recaps per subscription renewal period and eight signed-in members for Premium.

## Scope

This change covers the backend entitlement and reservation flow, workspace-member capacity enforcement, the subscription status API contract, and the mobile recap and member-management UI. It does not introduce recap add-ons, per-seat billing, rollover credits, or changes to the existing Premium feature catalogue.

## Product Rules

- Allowances belong to a workspace (household), never to an individual user.
- Free workspaces receive three total recap credits. They never expire and do not reset.
- Premium workspaces receive 20 recap credits for each current subscription period.
- A Premium allowance resets at the workspace subscription renewal date. Unused credits do not roll over.
- A request consumes one credit only when the service begins a new provider generation.
- Viewing a saved recap, retrieving a cached recap for identical input, or retrying after a provider failure consumes no additional credit.
- If a summary save fails after a credit was reserved, the reservation is released.
- Only adult workspace roles can generate recaps. Viewers may receive the status payload but cannot generate.
- Premium expiry immediately prevents new Premium allowance usage. Existing completed meetings and stored recaps remain readable.

## Household Member Limits

- Limits apply to active, signed-in workspace members and include the workspace owner.
- Free workspaces allow four active members. Premium workspaces allow eight.
- Pending invitations do not consume a member slot.
- The server enforces the limit both before an invitation is created and when an invite is accepted, so concurrent invitation flows cannot overfill a workspace.
- A Premium workspace that expires while it has five to eight active members retains every member and all data. It cannot invite or accept any additional members until its count is at or below four or Premium returns.
- The API reports a safe `409 household_member_limit_reached` error with `limit` and `currentCount`. It never reveals user details beyond the requester’s existing membership visibility.

## API Contract

Replace the current plan-dependent `assistantRecap` shape with a single explicit allowance DTO:

```ts
{
  limit: number,
  used: number,
  remaining: number,
  periodEndsAt: string | null,
  canGenerate: boolean,
}
```

For a Free workspace, `limit` is `3`, `periodEndsAt` is `null`, and `used` includes all settled or active starter-credit reservations. For Premium, `limit` is `20`, `periodEndsAt` is the current trusted subscription expiry/renewal timestamp, and `used` includes reservations in that subscription period. The response omits no fields based on plan, so mobile clients need no nullable or inferred branch.

`canGenerate` is true only when the current role is eligible and at least one credit remains. A depleted allowance produces a safe `429` response with the allowance values and `resetAt` equal to `periodEndsAt` for Premium, or `null` for Free.

## Persistence And Service Design

Reuse the existing recap reservation lifecycle rather than counting completed AI rows. Extend the persisted reservation record with allowance scope and period information needed to count only the active Premium subscription period while retaining existing Free reservations.

The database reservation operation remains the concurrency authority. It must atomically reject a request after the applicable limit is reached, reserve before a provider call, settle only after the generated recap has been safely written, and release on every failed path. The service resolves the allowance from trusted subscription data immediately before reserving.

The hourly anti-abuse rate limit is five new provider generations per adult user and 20 per workspace in a rolling hour. It is independent of the subscription allowance. Completed cache hits and identical pending requests do not consume an hourly slot; failed requests no longer count after they are marked failed. A rate-limit response reports the expiry of the oldest qualifying slot, rather than a newly calculated hour from the rejection.

## Mobile Presentation

The recap surface obtains allowance data from the subscription snapshot and displays one compact status message near the generation control:

- Free: `3 free recaps left`.
- Premium: `12 of 20 recaps available until 29 September`.

The date is rendered in the user locale without a time. The UI must treat an absent or stale API allowance conservatively: do not promise a recap until fresh subscription status is available. A viewer sees an unavailable, role-restricted state rather than an upgrade prompt. A Free workspace with no credits sees the existing owner-aware Premium upgrade path.

The member-management flow displays the household capacity near member invitations. When the limit is reached, it prevents submission and shows calm copy: Free owners can upgrade to invite up to eight people; non-owners receive a capacity message without a purchase action. A Premium workspace that is above the Free cap after expiry sees its existing members normally but cannot add more.

## Errors And Edge Cases

- A missing or expired Premium subscription is Free for allowance purposes; it cannot use a prior Premium window.
- A cached, valid same-input recap returns before any allowance reservation.
- A failed provider call or failed database save releases its pending reservation.
- Two simultaneous generation attempts cannot collectively reserve more credits than the workspace allowance.
- Subscription status and generation service both derive the current allowance from the same trusted plan and expiry data.
- Invitations created before the capacity is reached still re-check capacity at acceptance; a stale invitation cannot add a ninth Premium or fifth Free member.

## Verification

- Repository/service tests cover Free total credits, Premium current-period credits, expiry, no rollover, atomic concurrent reservations, release-on-failure, and cached reads.
- Route tests cover adult generation, viewer rejection, depleted Free/Premium allowance responses, and status DTO serialization.
- Mobile tests cover Free copy, Premium localized end date, zero allowance, role restriction, and old API fallback behavior.
- Run the affected backend and mobile test suites, backend typecheck, and regenerate/validate OpenAPI documentation if the repository convention requires it.
