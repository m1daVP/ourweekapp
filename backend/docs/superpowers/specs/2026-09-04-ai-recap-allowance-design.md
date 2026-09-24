# AI-03: Recap Allowance and Saved-Summary Access

Date: 2026-09-04.

Status: implemented in the mobile working tree; automated verification recorded below, device/staging release QA pending.

References: [AI_READINESS_REVIEW.md](../../../AI_READINESS_REVIEW.md), AI-03 and AI-04; [AI_RELEASE_CHECKLIST.md](../../../AI_RELEASE_CHECKLIST.md), steps 7 and 8. Implementation plan: [AI recap allowance](../plans/2026-09-04-ai-recap-allowance.md).

## Goal and approved scope

Eligible Free adults can use backend-provided starter recaps, and eligible Premium adults can use their remaining allowance. Every generation entry point uses the same permission. Spending the last credit must not hide the recap that was just generated.

The user approved AI-03 together with the narrow AI-04 safeguard: separate existing-summary visibility from permission to generate. Preserve existing meeting/workspace access and independent export permissions.

An AI-03-only implementation was considered but rejected because correcting allowance mapping alone exposes the last-credit visibility bug.

## Current evidence

- `src/features/subscription/types.ts` defines `assistantRecap` inside `SubscriptionEntitlementStatus`, not `SubscriptionSnapshot`.
- `src/features/subscription/services/backendSubscriptionProvider.ts` maps the backend allowance into the Premium entitlement only. The RevenueCat provider also uses this shared mapper.
- `src/app/stores/subscription.ts` reads `snapshot.assistantRecap`, which is absent from the declared snapshot and returned object.
- `MeetingSummaryPage.vue` falls back to the Premium feature flag when allowance is missing; it checks generation permission before rendering a saved insight and removes insights from share text when generation is blocked.
- `MeetingDetailsPage.vue` and `useMeetingSession.ts` still gate generation with `canUseFeature('aiSummary')`. The details page wraps the entire AI panel in `PremiumLock`.
- Only manual generation on the summary page refreshes the subscription afterward. Exhaustion responses do not refresh it centrally.
- The backend already returns allowance and role-aware `canGenerate`; this change does not alter credit policy or backend billing enforcement.

All source paths in this document refer to `D:/Projects/myself/weekly-us` unless explicitly identified as backend documentation.

## Contract and ownership

Introduce one named `AssistantRecapAllowance` type with `limit`, `used`, `remaining`, `periodEndsAt`, and `canGenerate`. Expose `assistantRecap: AssistantRecapAllowance | null` at the top level of every subscription snapshot. The subscription API DTO may keep the field optional for older backend responses, but the mapper normalizes missing data to `null`.

The shared backend mapper carries allowance for both Free and Premium users. Native purchase, restore, and refresh flows continue to obtain it through the backend mapper; RevenueCat Premium status alone never implies recap credits. Pending activation snapshots with no backend allowance yield `null`.

Remove the misplaced nested allowance after checking its consumers. Update typed fixtures accordingly. Do not change unrelated feature-access mappings or billing behavior.

The subscription store owns current allowance and exposes one generation permission. Unknown, loading, or failed-refresh allowance must not unlock generation, including for Premium. A failed refresh invalidates recap permission without discarding saved meetings or unrelated subscription data. Do not display an unavailable allowance as zero credits or unlimited usage.

Do not derive credits from plan name, decrement a local counter, or assume three credits merely because a user is Free. The backend remains authoritative and still validates every generation request. Existing session resets must clear allowance; tests must ensure a late allowance refresh cannot re-enable it after session reset.

## Generation flow

Use the existing shared `generateMeetingSummary` coordinator and retain AI-02 synchronization and revision safeguards.

1. Automatic completion and both manual entry points use the store's recap permission instead of Premium-only checks.
2. If allowance is unknown/unavailable, finish the meeting locally without automatic AI. Manual screens offer a deliberate allowance refresh; generation remains disabled until a successful status response permits it. Do not introduce automatic generation retries.
3. The coordinator also checks permission before synchronization/generation, so a caller cannot accidentally bypass the UI gate. The backend remains the security boundary.
4. Preserve the acknowledged completion -> generation -> authoritative result application sequence from AI-02.
5. After a successful generation response, refresh allowance centrally, including when subsequent local application detects a conflict. Remove the duplicate page-owned refresh.
6. On `recap_allowance_exhausted`, invalidate stale permission immediately and refresh status. Preserve the original generation failure if refresh also fails.
7. A failed allowance refresh after successful recap persistence must not turn that recap into a generation failure or discard it. Keep the recap visible, mark allowance unavailable, and let the user refresh deliberately.

Retain hourly anti-abuse error handling separately from recap-credit exhaustion. Do not add provider retries, change timeouts, or change credit settlement.

## Saved recap display and sharing

- On the summary page, render an existing authorized insight before considering generation availability. Keep it in ordinary share text regardless of remaining credits or Premium expiry.
- On the details page, remove the AI panel's blanket Premium lock. Render saved content and the existing inaccuracy disclaimer; condition only generation controls on allowance.
- Preserve existing meeting lookup/access checks and route guards. This does not unlock meetings the user cannot otherwise access, change history policy, or broaden workspace membership.
- Keep export's independent entitlement checks. Removing the AI-specific display lock does not grant paid export access.
- Do not replace canonical tasks/agreements in this task; the separate AI-09 finding remains tracked.

## Recovery copy

Use concise localized states in English, Ukrainian, and Spanish: checking allowance, allowance unavailable with a refresh action, Free credits remaining/exhausted, and Premium credits remaining/renewal date. A viewer must not be encouraged to upgrade as a way to bypass their role restriction.

Use existing localization mechanisms, retaining unrelated strings. Localize the touched hard-coded allowance count/date copy. Do not redesign the screens or expand into the full provider-error taxonomy from AI-08/AI-14.

## Affected files and responsibilities

- `src/features/subscription/types.ts`: shared allowance and snapshot contracts.
- `src/shared/api/subscriptionsApi.ts`: reuse the typed allowance shape at the API boundary.
- `src/features/subscription/services/backendSubscriptionProvider.ts`: normalize top-level allowance for all backend statuses.
- `src/app/stores/subscription.ts`: permission, allowance freshness, refresh/reset behavior.
- `src/features/meeting/aiSummaryService.ts`: common generation permission check and post-request allowance refresh.
- `src/features/meeting/composables/useMeetingSession.ts`: automatic generation gate without losing completion.
- `src/pages/MeetingSummaryPage.vue`: generation gate, saved-insight precedence, sharing, recovery states.
- `src/pages/MeetingDetailsPage.vue`: generation gate, saved-summary visibility, recovery states.
- `src/features/meeting/components/RecapAllowanceStatus.vue`: small shared allowance/recovery display used by both pages; permission stays in the subscription store.
- `src/features/localization/messages.ts`: localized allowance/recovery copy.
- Provider/store/coordinator/session/page tests: contract and user-visible regressions. Extend existing suites; add focused test files where absent.
- Backend root readiness/checklist documents: record actual implementation and verification results after completion.

## Verification and acceptance

Write regression tests before changing behavior. Cover:

1. Free with three credits and exhausted Free; Premium with credits and exhausted Premium; viewer with credits but `canGenerate: false`.
2. Both providers preserve backend allowance; missing legacy data and pending activation remain unavailable.
3. The store starts unavailable, blocks while checking, invalidates permission after refresh failure, and clears allowance on reset without accepting a late response from the prior session.
4. Every generation entry point uses allowance; no Premium fallback unlocks unknown/exhausted state. The shared coordinator rejects unavailable permission before an AI call.
5. Successful generation refreshes allowance once; exhaustion refreshes it while retaining the original error. A failed post-success refresh preserves the result.
6. The final credit produces a visible saved recap on summary/details screens and in permitted share text; expired Premium does not hide it. No meeting or export access boundary is weakened.
7. Offline/deferred completion and AI-02 revision/conflict tests remain green.
8. Localized copy and catalogue completeness tests cover all supported languages.

Run focused mobile suites, full `npm test`, explicit app TypeScript checking, `npm run build`, and `npm run check`. Record unrelated pre-existing failures separately; do not suppress them or reformat unrelated files. Run backend checks only if runtime code there changes; docs-only backend work does not require its full suite.

Manual release QA: Free adult uses the final credit; Premium allowance exhausts/renews; viewer sees no generation action; status refresh fails then recovers; saved recap remains readable after expiry; offline finish preserves completion. No real provider call is necessary for mocked regression tests.

## Constraints and rollout

No database migration, backend billing-policy change, dependency addition, funded provider call, production configuration change, deployment, or Git staging/commit/push is authorized by this design.

The user-owned P0 provider work remains separate. The mobile repository is outside the current writable root; obtain filesystem authorization through the normal tool mechanism when implementation reaches mobile writes.

Existing Premium-only wording in older mobile project guidance is superseded for this task by the explicitly approved Free recap allowance behavior. Unrelated feature gates remain unchanged.

Design self-review: the contract normalizes missing allowance to `null`; permission is separate from saved-result access; failed refresh cannot discard successful generation; export/meeting boundaries remain intact; scope excludes unrelated accounting/provider fixes.

## Implementation result

Completed 2026-09-04 in `D:/Projects/myself/weekly-us`. No backend runtime or database changes were needed.

- Added `AssistantRecapAllowance` to the top-level subscription snapshot; both providers use the existing shared backend mapper, including Free users and missing-data/pending-activation cases.
- Added unavailable/checking guards, refresh invalidation, session epochs, and response-order checks. A refresh requested while purchase/restore/paywall work is active is retained and executed after that action settles, rather than silently skipped. Late AI results also cannot be applied after a subscription/session reset.
- Updated the common generation coordinator plus automatic completion and both manual entry points. Success and exhaustion refresh allowance centrally; a failed refresh preserves the original generation result/error and leaves new generation unavailable.
- Removed the AI-specific blanket display lock, retained saved insight share text, and preserved the independent export lock. Added shared `RecapAllowanceStatus.vue` recovery/count/date UI in English, Ukrainian, and Spanish.
- Page regressions share `src/pages/__tests__/MeetingRecapPages.test.ts` and `src/features/meeting/__tests__/recapFixtures.ts` rather than duplicating separate page harnesses. Real page rendering, real subscription permissions, the real export lock, and the real meeting completion action are exercised with mocked external calls.

Verification:

| Check | Result |
| --- | --- |
| Test-first reproduction | Mapper, store/reset, coordinator, page/completion, and purchase/refresh race failures observed before their fixes |
| Full mobile `npm test` | 64 suites, 520 tests passed |
| Mobile `npm run build` | Passed; existing Vite config/chunk-size warnings remain |
| Targeted Prettier for all 19 changed/new files | Passed |
| Targeted ESLint | One existing error: unused `meetingPreview`, `MeetingDetailsPage.vue:73`; no new lint findings |
| Explicit `tsconfig.app.json` check | Existing type-error baseline remains; no missing allowance snapshot type errors or new runtime type errors |
| Mobile `npm run check` | Stops at 16 pre-existing formatting failures outside these changes |
| Git whitespace checks | Passed |
| Backend runtime tests | Skipped: backend changes are documentation-only |

The explicit typecheck used `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit -p tsconfig.app.json --ignoreDeprecations 6.0` with its build-info file directed to the OS temporary directory. Remaining errors include existing auth-token, workspace, i18n, participant settings, export-locale, summary-assignee, and shared-service typing. They were not suppressed or rewritten as part of this change.

Still required before release: real-device layout/interaction checks, funded staging generation, Free final-credit and Premium renewal/expiry scenarios through the deployed backend, and the remaining independent AI readiness findings. No provider request, native billing transaction, deployment, Git staging, commit, or push was performed by this implementation.
