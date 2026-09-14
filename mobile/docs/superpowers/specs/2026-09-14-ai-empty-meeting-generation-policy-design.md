# Empty Meeting AI Generation Policy Design

## Goal

Prevent AI recap generation for completed meetings with no recorded discussion signals, while preserving the existing explicit low-content override for meetings that contain at least one signal.

## Scope

The policy applies to notes and agreements, which are the existing AI summary discussion signals. Tasks alone do not make a meeting eligible because the existing summary-readiness calculation intentionally counts notes and agreements only.

No migration, new endpoint, payload field, or change to meeting sync is required.

## Behavior

1. A completed meeting with zero discussion signals cannot generate an AI recap.
2. The recap screen does not render a Generate AI insight action for such a meeting.
3. The backend rejects a recap request with zero discussion signals even when the caller sends `allowLowContent: true`. This protects the policy for older clients and direct API callers.
4. A completed meeting with one or more discussion signals remains eligible for the existing flow. If it misses the normal readiness threshold, the user may explicitly confirm low-content generation, which sends `allowLowContent: true`.
5. Meetings that meet the existing readiness threshold continue to generate without the low-content confirmation.

## Architecture

The existing `getSummaryContentReadiness` result already exposes `discussionSignalCount`. Both layers will use that established value rather than duplicating note/agreement counting:

- The frontend derives AI-action visibility from `discussionSignalCount > 0` as well as the current completion, entitlement, and generation-state checks.
- The backend checks `discussionSignalCount === 0` before evaluating the `allowLowContent` override and returns a stable conflict error.

The current low-content confirmation remains unchanged for non-empty meetings. The frontend uses the existing generation request shape; the backend does not introduce a new contract field.

## Error Handling

The backend returns a `409` application error with code `ai_summary_no_recorded_content` for zero-signal completed meetings. It does not reserve quota, create an AI request, load participants, or call the provider.

The frontend prevents the normal user path to that error. If an older client still sends the request, its existing recap error recovery displays the safe backend error rather than exposing implementation details.

## Tests

- Frontend recap-page tests cover zero-signal action suppression, one-signal low-content confirmation, and ready-content generation.
- Backend AI service tests cover rejection of an empty meeting with and without `allowLowContent`, asserting no quota reservation or provider call.
- Existing low-content and completed-meeting tests remain the regression guard for non-empty behavior.

## Self-Review

This design uses the established discussion-signal definition consistently in both layers. It is limited to AI eligibility, does not alter completion or sync behavior, and makes the low-content override unambiguous: it applies only to non-empty meetings.
