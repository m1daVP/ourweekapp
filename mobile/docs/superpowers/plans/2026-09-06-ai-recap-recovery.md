# AI Recap Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give both mobile recap entry points localized, actionable recovery states for allowance, synchronization, temporary backend, and connection failures.

**Architecture:** Keep error interpretation in the meeting AI service, preserving a small typed recovery DTO that pages and a shared recovery panel can consume without inspecting raw exceptions. Preserve the existing backend contract; the shared HTTP client captures the existing `x-request-id` response header only on HTTP errors, so the mobile UI can display a safe support reference where one exists.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, vue-i18n, Vitest, Vue Test Utils.

## Global Constraints

- Change only `D:/Projects/myself/weekly-us`; AI-14 does not change backend API, allowance policy, provider handling, or database schema.
- Keep the completed meeting unchanged on every failed sync or generation path.
- Never auto-retry, poll, or expose provider request IDs, provider bodies, prompts, tokens, auth data, or raw exception messages.
- Re-run the existing completion-sync and entitlement checks on every explicit retry by calling the current `generateMeetingSummary` flow again.
- Add all user-visible recovery and allowance text to English, Ukrainian, and Spanish vue-i18n messages; format reset/renewal dates through the active locale.
- Do not stage, commit, push, or otherwise modify Git history without explicit user authorization.

---

## File structure

| File                                                       | Responsibility                                                                                      |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/shared/api/httpClient.ts`                             | Retain the safe HTTP `x-request-id` on `ApiClientError` instances.                                  |
| `src/features/meeting/aiSummaryService.ts`                 | Convert known recap failures into typed, localized recovery states.                                 |
| `src/features/meeting/components/AiRecapRecoveryPanel.vue` | Render one accessible inline recovery message, optional support reference, and manual retry action. |
| `src/pages/MeetingSummaryPage.vue`                         | Hold and render recovery state for the summary-page generation entry point.                         |
| `src/pages/MeetingDetailsPage.vue`                         | Hold and render recovery state for the details-page generation entry point.                         |
| `src/features/localization/messages.ts`                    | Supply equivalent recovery and allowance copy for all supported locales.                            |
| Focused tests                                              | Prove header safety, classification, localization, and explicit retry behavior.                     |

### Task 1: Preserve the backend correlation header safely

**Files:**

- Modify: `src/shared/api/httpClient.ts`
- Modify: `src/shared/api/__tests__/httpClient.test.ts`

**Interfaces:**

- Produces: `ApiClientError.requestId?: string`, populated only from the failed HTTP response's `x-request-id` header.
- Consumes: `Response.headers` after `fetch` has returned a non-OK response.

- [ ] **Step 1: Write the failing regression test**

Extend `jsonResponse` to accept optional headers, then add a non-OK request fixture that proves the error contains the opaque header value and not arbitrary response headers:

```ts
it('keeps the safe backend request ID on a structured HTTP error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      jsonResponse(
        {
          message: 'Please try again.',
          code: 'ai_summary_generation_failed',
        },
        503,
        { 'x-request-id': 'req_mobile_support_123' }
      )
    )
  );
  const { apiRequest } = await loadHttpClient();

  await expect(apiRequest('/ai/meeting-summary')).rejects.toMatchObject({
    status: 503,
    code: 'ai_summary_generation_failed',
    requestId: 'req_mobile_support_123',
  });
});
```

Add a companion assertion that a response without `x-request-id` has `requestId: undefined`.

- [ ] **Step 2: Run the focused test to verify failure**

Run: `npm test -- src/shared/api/__tests__/httpClient.test.ts`

Expected: FAIL because `ApiClientError` has no `requestId` property.

- [ ] **Step 3: Add the minimal transport metadata**

Extend the error options and class, then capture only the named response header on the existing non-OK path:

```ts
interface ApiClientErrorOptions {
  status?: number;
  code?: string;
  details?: unknown;
  requestId?: string;
}

export class ApiClientError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
  requestId?: string;

  constructor(message: string, options: ApiClientErrorOptions = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

throw new ApiClientError(
  errorBody?.message ?? translate('api.backendContactFailed'),
  {
    status: response.status,
    code: errorBody?.code,
    details: errorBody?.details,
    requestId: response.headers.get('x-request-id') ?? undefined,
  }
);
```

Do not attach the ID to success DTOs or development logs, and do not read any provider header.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/shared/api/__tests__/httpClient.test.ts`

Expected: PASS, including the existing auth-refresh and structured-error tests.

### Task 2: Classify recap failures without exposing raw errors

**Files:**

- Modify: `src/features/meeting/aiSummaryService.ts`
- Modify: `src/features/meeting/__tests__/aiSummaryService.test.ts`
- Modify: `src/features/meeting/__tests__/aiGenerationFlow.test.ts`

**Interfaces:**

- Consumes: `ApiClientError`, `AiMeetingSyncRequiredError`, aborted fetch errors, and the current `AiQuotaInfo` parser.
- Produces: `AiRecapRecovery` with `kind`, `messageKey`, `messageParams`, `retryable`, and optional `requestId`.
- Produces: `getAiRecapRecovery(error: unknown): AiRecapRecovery`.

- [ ] **Step 1: Write failing classifier tests**

Add table-driven tests that construct these errors and assert only the recovery DTO, never the raw message:

```ts
expect(
  getAiRecapRecovery(new AiMeetingSyncRequiredError('offline'))
).toMatchObject({
  kind: 'offline',
  messageKey: 'ai.recap.recovery.offline',
  retryable: true,
});

expect(
  getAiRecapRecovery(
    new ApiClientError('raw provider text', {
      status: 503,
      code: 'ai_summary_generation_failed',
      requestId: 'req_mobile_support_123',
    })
  )
).toMatchObject({
  kind: 'providerUnavailable',
  messageKey: 'ai.recap.recovery.providerUnavailable',
  retryable: true,
  requestId: 'req_mobile_support_123',
});
```

Cover all five `AiMeetingSyncRequiredError` reasons (`offline`, `conflict`, `missing`, `changed`, `failed`), `meeting_update_conflict`, a valid `ai_summary_rate_limited` DTO, `recap_allowance_exhausted`, `AbortError`, a generic network `TypeError`, and an unknown error. Assert allowance and hourly quota remain different kinds, neither is retryable, and the raw provider text is absent from every returned value.

Extend the existing failed-sync generation test to use `AiMeetingSyncRequiredError` and prove the completed source meeting is still unchanged.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npm test -- src/features/meeting/__tests__/aiSummaryService.test.ts src/features/meeting/__tests__/aiGenerationFlow.test.ts`

Expected: FAIL because `getAiRecapRecovery` does not exist.

- [ ] **Step 3: Implement the recovery DTO and classifier**

Add narrow public types and a classifier next to the existing quota helpers:

```ts
export type AiRecapRecoveryKind =
  | 'allowanceExhausted'
  | 'hourlyLimit'
  | 'syncRequired'
  | 'offline'
  | 'revisionConflict'
  | 'providerUnavailable'
  | 'configurationUnavailable'
  | 'timeout'
  | 'unknown';

export interface AiRecapRecovery {
  kind: AiRecapRecoveryKind;
  messageKey: string;
  messageParams: Record<string, string | number>;
  retryable: boolean;
  requestId?: string;
}

export function getAiRecapRecovery(error: unknown): AiRecapRecovery {
  if (isRecapAllowanceExhausted(error)) {
    return allowanceExhaustedRecovery;
  }
  const quota = parseAiQuotaError(error);
  if (quota) return quotaRecovery(quota);
  if (error instanceof AiMeetingSyncRequiredError) {
    return syncRecovery(error.reason);
  }
  if (
    error instanceof ApiClientError &&
    error.code === 'meeting_update_conflict'
  ) {
    return recovery(
      'revisionConflict',
      'ai.recap.recovery.revisionConflict',
      true,
      error
    );
  }
  if (
    error instanceof ApiClientError &&
    error.code === 'ai_provider_not_configured'
  ) {
    return recovery(
      'configurationUnavailable',
      'ai.recap.recovery.configurationUnavailable',
      false,
      error
    );
  }
  if (error instanceof ApiClientError && error.status === 503) {
    return recovery(
      'providerUnavailable',
      'ai.recap.recovery.providerUnavailable',
      true,
      error
    );
  }
  if (isAbortError(error))
    return recovery('timeout', 'ai.recap.recovery.timeout', true);
  if (isOfflineOrNetworkError(error))
    return recovery('offline', 'ai.recap.recovery.offline', true);
  return recovery('unknown', 'ai.recap.recovery.unknown', false);
}
```

Implement `allowanceExhaustedRecovery`, `quotaRecovery`, `syncRecovery`, `recovery`, `isAbortError`, and `isOfflineOrNetworkError` as private helpers in this module. `quotaRecovery` must format `resetAt` using the active locale before supplying `{ count, resetTime }`. Map API `503` codes `ai_summary_generation_failed` and `ai_provider_not_configured` to distinct safe, localized server-unavailable copy; a configuration error is not retryable. Map `meeting_update_conflict` to the retryable conflict state. Do not change `generateMeetingSummary`; it continues to throw so pages decide what to render.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- src/features/meeting/__tests__/aiSummaryService.test.ts src/features/meeting/__tests__/aiGenerationFlow.test.ts`

Expected: PASS; no provider text is present in a recovery DTO and no failure mutates the completed meeting.

### Task 3: Add complete localized recovery and allowance text

**Files:**

- Modify: `src/features/localization/messages.ts`
- Modify: `src/features/localization/__tests__/messages.test.ts`
- Modify: `src/features/meeting/components/__tests__/RecapAllowanceStatus.test.ts`

**Interfaces:**

- Consumes: the `ai.recap` message namespace and active `vue-i18n` locale.
- Produces: equivalent `ai.recap.recovery.*` and `ai.recap.supportReference` messages in `en`, `uk`, and `es`.

- [ ] **Step 1: Write failing localization tests**

Add a parameterized test that sets each supported locale and asserts recovery keys resolve to user-facing text rather than the key itself. Extend the allowance component test to cover both remaining and exhausted Premium allowance in Ukrainian and Spanish, asserting the rendered text does not contain English renewal or remaining-credit fragments.

```ts
it.each(['en', 'uk', 'es'] as const)(
  'localizes recap recovery in %s',
  (locale) => {
    context.i18n.global.locale.value = locale;
    expect(context.i18n.global.t('ai.recap.recovery.offline')).not.toBe(
      'ai.recap.recovery.offline'
    );
  }
);
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npm test -- src/features/localization/__tests__/messages.test.ts src/features/meeting/components/__tests__/RecapAllowanceStatus.test.ts`

Expected: FAIL because the recovery namespace does not exist in every locale.

- [ ] **Step 3: Add message parity for all locales**

Under each existing `ai.recap` object, add the same key shape:

```ts
recovery: {
  syncRequired: 'Sync this completed meeting, then try the recap again.',
  offline: 'Reconnect to the internet, then try the recap again.',
  revisionConflict: 'This meeting changed elsewhere. Sync it, then try the recap again.',
  providerUnavailable: 'Recaps are temporarily unavailable. Please try again later.',
  configurationUnavailable: 'Recaps are unavailable right now. Please try again later.',
  timeout: 'The recap took too long. Please try again when your connection is stable.',
  unknown: 'The recap could not be prepared right now. Please try again later.',
},
retry: 'Retry recap',
supportReference: 'Support reference: {requestId}',
```

Translate the Ukrainian and Spanish values rather than reusing English. Retain the existing `freeRemaining`, `freeExhausted`, `premiumRemaining`, `premiumExhausted`, `quotaUserLimitReached`, and `quotaWorkspaceLimitReached` keys; adjust them only if the new localized tests reveal an actual remaining-credit or renewal-date gap.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- src/features/localization/__tests__/messages.test.ts src/features/meeting/components/__tests__/RecapAllowanceStatus.test.ts`

Expected: PASS for every supported locale and all existing allowance states.

### Task 4: Render one deliberate recovery action on both recap pages

**Files:**

- Create: `src/features/meeting/components/AiRecapRecoveryPanel.vue`
- Create: `src/features/meeting/components/__tests__/AiRecapRecoveryPanel.test.ts`
- Modify: `src/pages/MeetingSummaryPage.vue`
- Modify: `src/pages/MeetingDetailsPage.vue`
- Modify: `src/pages/__tests__/MeetingRecapPages.test.ts`

**Interfaces:**

- Consumes: `AiRecapRecovery` from `aiSummaryService.ts`.
- Produces: `AiRecapRecoveryPanel` with `recovery` prop and `retry` event.
- Produces: one `data-testid="retry-meeting-recap"` button only when `recovery.retryable` is true.

- [ ] **Step 1: Write failing component and page-flow tests**

Create a panel test that passes a retryable recovery with a request ID and asserts:

```ts
expect(wrapper.get('[role="alert"]').text()).toContain(
  'Recaps are temporarily unavailable'
);
expect(wrapper.text()).toContain('Support reference: req_mobile_support_123');
await wrapper.get('[data-testid="retry-meeting-recap"]').trigger('click');
expect(wrapper.emitted('retry')).toHaveLength(1);
```

Add a non-retryable allowance fixture and assert no retry button is rendered. In the existing `describe.each` page test, make the mocked `generateMeetingSummary` reject once with a retryable recovery source, assert a localized inline alert and one retry button, then tap it and assert the mocked generation function is called exactly twice. Add an hourly-limit fixture that renders the reset-time message and no retry control. Assert the completed meeting's status remains `completed` after the rejected call.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npm test -- src/features/meeting/components/__tests__/AiRecapRecoveryPanel.test.ts src/pages/__tests__/MeetingRecapPages.test.ts`

Expected: FAIL because the component and retry UI do not exist.

- [ ] **Step 3: Implement the shared panel and integrate both pages**

Create the small accessible component:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { AiRecapRecovery } from '../aiSummaryService';

defineProps<{ recovery: AiRecapRecovery }>();
const emit = defineEmits<{ retry: [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="ai-recap-recovery" role="alert">
    <p>{{ t(recovery.messageKey, recovery.messageParams) }}</p>
    <p v-if="recovery.requestId" class="ai-recap-recovery__reference">
      {{ t('ai.recap.supportReference', { requestId: recovery.requestId }) }}
    </p>
    <button
      v-if="recovery.retryable"
      data-testid="retry-meeting-recap"
      type="button"
      @click="emit('retry')"
    >
      {{ t('ai.recap.retry') }}
    </button>
  </div>
</template>
```

Give the button the project-standard 48px minimum touch target. In each page, replace its string-only `aiSummaryError` state with `AiRecapRecovery | null`; on failure assign `getAiRecapRecovery(error)`. Extract the existing guarded generation body into one local handler and wire the panel's `retry` event to that same handler. Clear recovery before each manual attempt and leave the original disabled/loading guard in place. Keep `RecapAllowanceStatus` visible so non-retryable allowance states retain its explicit refresh path.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- src/features/meeting/components/__tests__/AiRecapRecoveryPanel.test.ts src/pages/__tests__/MeetingRecapPages.test.ts`

Expected: PASS; retry occurs only after a tap, allowance/hourly-limit states have no retry control, and the completed meeting remains intact.

### Task 5: Run feature and release checks

**Files:**

- Verify only: the files from Tasks 1-4.

**Interfaces:**

- Consumes: completed focused tests and the mobile app's existing build/check scripts.
- Produces: verification evidence for AI-14 without a backend change or deployment.

- [ ] **Step 1: Run all AI-14-focused tests together**

Run:

```powershell
npm test -- src/shared/api/__tests__/httpClient.test.ts src/features/meeting/__tests__/aiSummaryService.test.ts src/features/meeting/__tests__/aiGenerationFlow.test.ts src/features/localization/__tests__/messages.test.ts src/features/meeting/components/__tests__/RecapAllowanceStatus.test.ts src/features/meeting/components/__tests__/AiRecapRecoveryPanel.test.ts src/pages/__tests__/MeetingRecapPages.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run production build and static checks**

Run:

```powershell
npm run build
npm run check
```

Expected: both commands pass. If unrelated baseline failures remain, record their exact command, file, and diagnostic without suppressing them.

- [ ] **Step 3: Perform targeted manual mobile QA**

Verify on a narrow browser viewport and Android device when available:

1. Finish a meeting offline; its completed state remains saved and the recovery panel gives a reconnect-and-retry action.
2. Simulate a revision conflict; the panel requires manual retry and does not call generation until tapped.
3. Simulate a `503` response with `x-request-id`; the safe support reference is visible without provider text.
4. Confirm allowance exhaustion and hourly user/workspace limits show their distinct localized messages and no retry button.
5. Confirm English, Ukrainian, and Spanish display remaining-credit, reset-time, and Premium renewal date correctly.

Expected: one clear recovery path per scenario, no automatic second request, and no lost completed meeting.

## Plan self-review

- Spec coverage: Tasks 1-4 implement every approved behavior: typed safe classification, manual retry, localized copy, allowance/hourly distinction, support IDs, and preserved completion. Task 5 verifies them.
- Completeness scan: each code and test step has concrete file paths, commands, expected results, and interfaces.
- Type consistency: `ApiClientError.requestId` feeds `AiRecapRecovery.requestId`; pages pass the same `AiRecapRecovery` shape to the panel; the panel emits only `retry`.
