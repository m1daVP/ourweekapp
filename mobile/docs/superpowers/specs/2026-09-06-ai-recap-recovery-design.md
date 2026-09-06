# AI Recap Recovery Design

## Goal

Give people a clear, safe next step when AI recap generation cannot proceed, without losing a completed meeting, exposing provider internals, or retrying automatically.

## Scope

AI-14 changes the mobile application only. It covers both recap entry points:

- `src/pages/MeetingSummaryPage.vue`
- `src/pages/MeetingDetailsPage.vue`

It also updates the shared AI recap service, HTTP error metadata, localized messages, and focused tests. It does not change the backend API response body, provider behavior, allowance policy, or database schema.

## Existing Contract

The mobile app already:

- synchronizes a completed meeting before it asks the backend to generate a recap;
- preserves the completed local meeting when that synchronization or generation fails;
- uses backend error codes for recap allowance exhaustion and hourly anti-abuse limits;
- receives the backend's `x-request-id` response header, although the HTTP client currently drops it.

The backend already returns stable safe error codes, and sends `x-request-id` on every response. This identifier is safe to expose as a support reference; the app must never show provider request IDs, provider error bodies, prompts, tokens, or technical exception text.

## Design

### Shared recovery classification

`aiSummaryService.ts` will expose a typed recovery result for a failed recap generation. It will classify errors without parsing user-visible error messages:

| Condition                        | Detection                                                 | User action                                                                     | Retryable |
| -------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- | --------- |
| Allowance exhausted              | `recap_allowance_exhausted`                               | Refresh availability or wait for the displayed allowance period when available. | No        |
| Hourly anti-abuse limit          | `ai_summary_rate_limited` with valid quota details        | Wait until the localized reset time.                                            | No        |
| Completion not synchronized      | `AiMeetingSyncRequiredError`                              | Synchronize the completed meeting, then choose retry.                           | Yes       |
| Revision conflict                | `meeting_update_conflict`                                 | Refresh/synchronize the meeting, then choose retry.                             | Yes       |
| Provider temporarily unavailable | safe server-side generation failure (`503`)               | Try again later.                                                                | Yes       |
| Timeout or offline connection    | aborted request, network failure, or offline sync failure | Reconnect if necessary, then choose retry.                                      | Yes       |
| Unknown safe failure             | all other errors                                          | Try again later.                                                                | No        |

The classifier returns a localization key, interpolation data, an optional safe request ID, and a `retryable` flag. It does not trigger a retry itself.

### Support reference

`ApiClientError` will retain the `x-request-id` response header when the HTTP response reaches the client. The recovery result carries that identifier only for a failed API response. The UI may show a localized "Support reference: {requestId}" line beneath the actionable message. It must not invent an identifier for offline, aborted, or local synchronization failures.

### Page behavior

The two recap pages will use one focused, feature-level recovery component or equivalent shared presentation helper so the same classified state produces the same message and action.

- A retryable state shows one inline **Retry recap** button. Pressing it reruns the existing generation flow from the beginning, including completion synchronization and entitlement checks.
- It never retries automatically, schedules background attempts, or issues a provider request after a failed preflight.
- Allowance exhaustion and hourly limiting do not show retry. The existing allowance-status control remains the way to refresh availability, and the quota message states the localized reset time.
- A failed recap never resets or edits the completed meeting. Existing saved recaps remain readable under the established AI-04 behavior.

### Localization

All newly displayed recovery and support-reference copy is added to the existing English, Ukrainian, and Spanish message catalog. The message keys include the retry label and distinct copy for:

- sync required;
- revision conflict;
- temporary provider issue;
- timeout/offline;
- generic safe failure;
- hourly user and household limits;
- remaining Free credits and Premium period/renewal text;
- the optional support reference.

Date and time formatting continues to use the active `vue-i18n` locale through `Intl.DateTimeFormat`; no formatted English date string is stored in the message catalog.

## Testing

Add regression coverage before implementation for:

1. Allowance exhaustion versus hourly rate limit, proving they produce distinct recovery states and actions.
2. Each sync-required reason, a retryable server revision conflict, provider `503`, abort/network failure, and an unknown safe failure.
3. Header capture in `ApiClientError`, including absence of a support reference for non-HTTP errors.
4. Both recap pages rendering the localized recovery state and invoking generation only after an explicit retry tap.
5. English, Ukrainian, and Spanish recovery, remaining-credit, reset-time, and Premium renewal copy.

The tests must prove that a failed flow leaves the completed meeting unchanged and that raw provider or exception text is not rendered.

## Non-goals

- Changing backend error classifications or adding a new backend endpoint.
- Auto-retry, background queueing, or polling pending generations.
- Displaying provider request IDs or diagnostics.
- Changing allowance, subscription, or rate-limit policy.

## Verification

Run the affected Vitest files first, then `npm run build` and `npm run check` from `D:/Projects/myself/weekly-us`. Manual mobile QA should cover offline completion, a recovery retry after synchronization, provider outage, hourly limit reset messaging, depleted allowance, and a visible request ID on a failed server response.
