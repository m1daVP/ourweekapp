# AI Summary Card Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI summary card use one shared mobile-first design and consistent state layout on the meeting summary and saved meeting detail screens.

**Architecture:** Add `AiSummaryCard.vue` as a presentation component that receives already-derived meeting/AI state and emits generate, regenerate, and retry actions. Keep stores, API calls, subscription checks, route handling, and persistence in the two page consumers; compose the existing follow-through, allowance, and recovery components inside the shared card.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, vue-i18n, Vitest, CSS custom properties, Vite.

## Global Constraints

- The app is mobile-only; keep layouts narrow, touch-friendly, and safe-area compatible.
- Use Vue 3 `<script setup lang="ts">` and typed props/emits.
- Keep user-facing strings translation-ready through `vue-i18n`.
- Use existing OurWeek color and typography tokens; do not add screenshot-specific hex colors.
- Keep AI calls behind the existing backend service and do not change AI, subscription, storage, or sync behavior.
- Do not store secrets or introduce a new dependency.
- Preserve calm, practical, neutral wording and existing accessibility behavior.
- Do not commit changes unless the user explicitly requests commits.

---

## File map

- Create `src/features/meeting/components/AiSummaryCard.vue`: shared AI card shell, state presentation, allowance/recovery composition, and action emits.
- Create `src/features/meeting/components/__tests__/AiSummaryCard.test.ts`: focused component coverage for shared markup and state/action behavior.
- Modify `src/pages/MeetingSummaryPage.vue`: replace the page-local AI card markup with the shared component while keeping current state derivation and handlers.
- Modify `src/pages/MeetingDetailsPage.vue`: replace the saved-meeting AI card markup with the shared component and keep its legacy-summary fallback slot.
- Modify `src/styles/main.css`: style the shared card to match the approved reference hierarchy using existing design tokens, including the full-width primary action and allowance strip.
- Modify `src/pages/__tests__/MeetingRecapPages.test.ts`: retain page-level behavior assertions and add shared-structure assertions for both consumers where the current tests do not cover them.

## Component contract

`AiSummaryCard.vue` should expose this typed contract:

```ts
export type AiSummaryCardState = 'empty' | 'loading' | 'available' | 'error';

interface AiSummaryCardProps {
  meeting: Meeting | null;
  state: AiSummaryCardState;
  canGenerate: boolean;
  canRegenerate: boolean;
  generating: boolean;
  recovery: AiRecapRecovery | null;
  errorMessage: string;
  emptyMessage: string;
  loadingMessage: string;
  title: string;
  disclaimer: string;
  generateLabel: string;
}

const emit = defineEmits<{
  generate: [];
  regenerate: [];
  retry: [];
}>();
```

The component should render `MeetingFollowThrough` when `meeting.aiSummary` exists, render `RecapAllowanceStatus` for all relevant states, render `AiRecapRecoveryPanel` for a supplied recovery, and expose a `legacy` slot after follow-through for the saved-meeting detail page's old summary shape. The action button keeps `data-testid="generate-meeting-recap"` so existing page tests and automation remain stable.

### Task 1: Add failing tests for the shared component

**Files:**

- Create: `src/features/meeting/components/__tests__/AiSummaryCard.test.ts`
- Reference: `src/features/meeting/components/RecapAllowanceStatus.vue`
- Reference: `src/features/meeting/components/AiRecapRecoveryPanel.vue`
- Reference: `src/features/meeting/components/MeetingFollowThrough.vue`

**Interfaces:**

- Consumes the `AiSummaryCardProps` and emits defined above.
- Produces a test contract for the shared shell that page integrations can rely on.

- [ ] **Step 1: Add a minimal meeting fixture and mount helper.**

Use the existing `meetingFixture()` and `meetingFixture(false)` helpers from `src/features/meeting/__tests__/recapFixtures.ts` for a completed meeting with and without a saved AI summary. Mount with the existing project i18n and Pinia test setup; stub `MeetingFollowThrough`, `RecapAllowanceStatus`, and `AiRecapRecoveryPanel` where the test is checking only the shared card structure.

```ts
const props = {
  meeting: meetingFixture(false),
  state: 'empty' as const,
  canGenerate: true,
  canRegenerate: false,
  generating: false,
  recovery: null,
  errorMessage: 'The recap failed.',
  emptyMessage: 'No recap yet.',
  loadingMessage: 'Preparing the recap...',
  title: 'AI summary',
  disclaimer: 'Review before relying on it.',
  generateLabel: 'Generate',
};
```

- [ ] **Step 2: Write failing tests for the reference layout.**

Cover these behaviors:

```ts
it('renders the shared header, allowance slot, and full-width generate action', () => {
  const wrapper = render({ ...props, state: 'empty' });

  expect(wrapper.find('.ai-summary-card').exists()).toBe(true);
  expect(wrapper.find('.ai-summary-card__icon').exists()).toBe(true);
  expect(wrapper.text()).toContain('AI summary');
  expect(wrapper.text()).toContain('No recap yet.');
  expect(
    wrapper.get('[data-testid="generate-meeting-recap"]').text()
  ).toContain('Generate');
});

it.each(['loading', 'error'] as const)(
  'renders the %s state in the shared shell',
  (state) => {
    const wrapper = render({ ...props, state, canGenerate: false });

    expect(wrapper.find('.ai-summary-card').exists()).toBe(true);
    expect(
      wrapper.find('[data-testid="generate-meeting-recap"]').exists()
    ).toBe(false);
  }
);

it('emits explicit generate, regenerate, and retry actions', async () => {
  const wrapper = render({ ...props, state: 'empty' });
  await wrapper.get('[data-testid="generate-meeting-recap"]').trigger('click');
  expect(wrapper.emitted('generate')).toHaveLength(1);

  await wrapper.setProps({
    state: 'available',
    canGenerate: false,
    canRegenerate: true,
  });
  await wrapper
    .get('[data-testid="regenerate-meeting-recap"]')
    .trigger('click');
  expect(wrapper.emitted('regenerate')).toHaveLength(1);
});
```

Add a recovery fixture and assert a retryable recovery renders the existing retry test id and emits `retry`; assert a non-retryable recovery does not show a retry button. Add a slot assertion to prove legacy content can be rendered in the shared card.

- [ ] **Step 3: Run the focused component test and confirm it fails.**

Run: `npm test -- src/features/meeting/components/__tests__/AiSummaryCard.test.ts`

Expected: FAIL because `AiSummaryCard.vue` and its shared selectors do not exist yet.

### Task 2: Implement the shared card and token-based styling

**Files:**

- Create: `src/features/meeting/components/AiSummaryCard.vue`
- Modify: `src/styles/main.css:5634-5732` and nearby recap styles

**Interfaces:**

- Consumes the props and emits from the component contract.
- Produces `.ai-summary-card`, `.ai-summary-card__header`, `.ai-summary-card__icon`, `.ai-summary-card__allowance`, `.ai-summary-card__action`, and `.ai-summary-card__content` selectors for page-level visual consistency.

- [ ] **Step 1: Implement the shared template.**

Use a semantic `<section>` with `aria-labelledby`, a header containing the icon tile and title, a state content region, the allowance component, and a bottom action area. Keep the action full width and use the existing `meeting-summary-ai-card__button` behavior only through shared styling or a compatibility class.

The state branch should follow this structure:

```vue
<template>
  <section
    class="ai-summary-card meeting-summary-ai-card"
    :aria-labelledby="titleId"
  >
    <header class="ai-summary-card__header">
      <span
        class="ai-summary-card__icon material-symbols-outlined"
        aria-hidden="true"
      >
        auto_awesome
      </span>
      <h2 :id="titleId">{{ title }}</h2>
    </header>

    <div class="ai-summary-card__content">
      <p v-if="state === 'empty'">{{ emptyMessage }}</p>
      <p v-else-if="state === 'loading'">{{ loadingMessage }}</p>
      <AiRecapRecoveryPanel
        v-else-if="state === 'error' && recovery"
        :recovery="recovery"
        @retry="emit('retry')"
      />
      <p v-else-if="state === 'error'">{{ errorMessage }}</p>
      <template v-else>
        <MeetingFollowThrough
          v-if="meeting?.aiSummary"
          :meeting="meeting"
          :can-regenerate="canRegenerate"
          :generating="generating"
          @regenerate="emit('regenerate')"
        />
        <slot name="legacy" />
        <p class="ai-summary-card__disclaimer">{{ disclaimer }}</p>
      </template>
    </div>

    <div class="ai-summary-card__allowance"><RecapAllowanceStatus /></div>
    <button
      v-if="state === 'empty' && canGenerate"
      data-testid="generate-meeting-recap"
      class="ai-summary-card__action meeting-summary-ai-card__button"
      type="button"
      :disabled="generating"
      @click="emit('generate')"
    >
      <span class="material-symbols-outlined" aria-hidden="true">
        auto_awesome
      </span>
      {{ generateLabel }}
    </button>
  </section>
</template>
```

Generate the title id with a stable local id so multiple cards remain accessible if mounted together. Preserve the existing recovery component's retry behavior and do not expose raw provider errors.

- [ ] **Step 2: Add token-based styles matching the approved reference.**

Replace the page-specific differences with shared styles: `surface-lowest` background, amber border from `--color-secondary-container`, existing `--shadow-card`, a 12px-ish icon tile, display font title, muted rounded allowance strip, and a `--color-primary` full-width pill button. Keep the card readable for long localized text, allow generated content to grow naturally, and retain the existing 44/48px touch targets. Add a reduced-motion-safe transition only if one already exists for the button; do not add decorative animation.

Add a narrow-width rule that reduces horizontal padding without changing the full-width action. Remove or supersede the old top gradient and page-specific header/button alignment so both consumers use the same shell.

- [ ] **Step 3: Run the component tests and fix only shared-card failures.**

Run: `npm test -- src/features/meeting/components/__tests__/AiSummaryCard.test.ts`

Expected: PASS for shared empty/loading/error/generated action behavior and legacy slot rendering.

### Task 3: Integrate the meeting summary page

**Files:**

- Modify: `src/pages/MeetingSummaryPage.vue:527-581`
- Modify: `src/pages/__tests__/MeetingRecapPages.test.ts`

**Interfaces:**

- Consumes the shared `AiSummaryCard` props and emits.
- Produces the same existing page-level generation and recovery behavior under the shared markup.

- [ ] **Step 1: Replace the page-local AI card template.**

Import `AiSummaryCard`, remove the duplicated title/state/allowance/button markup, and pass:

```vue
<AiSummaryCard
  :meeting="accessibleMeeting"
  :state="aiInsightState"
  :can-generate="canGenerateAiSummary"
  :can-regenerate="
    Boolean(
      accessibleMeeting &&
      accessibleMeeting.status === 'completed' &&
      subscriptionStore.canGenerateAssistantRecap
    )
  "
  :generating="isGeneratingSummary"
  :recovery="aiSummaryRecovery"
  :error-message="aiSummaryErrorMessage"
  :empty-message="meetingSummaryText('aiEmpty')"
  :loading-message="meetingSummaryText('aiGenerating')"
  :title="t('meetingSummary.aiInsight')"
  :disclaimer="meetingSummaryText('aiDisclaimer')"
  :generate-label="meetingSummaryText('aiGenerate')"
  @generate="handleGenerateSummary"
  @regenerate="handleGenerateSummary"
  @retry="handleGenerateSummary"
/>
```

Keep the page's existing `aiInsightState`, route quota message, content-readiness guard, and generation handler unchanged. Preserve the existing generated follow-through output through the shared component.

- [ ] **Step 2: Update page tests for the shared selector without weakening behavior checks.**

Keep existing assertions for generation, low-content confirmation, retry, quota messaging, and completed-meeting safety. Add an assertion in the summary-page cases that `.ai-summary-card` exists and that the action remains `data-testid="generate-meeting-recap"` in the empty state. Assert generated summaries still render their short summary and follow-through content.

- [ ] **Step 3: Run the summary-page tests.**

Run: `npm test -- src/pages/__tests__/MeetingRecapPages.test.ts`

Expected: PASS for the summary-page scenarios; any failures should be limited to selectors intentionally replaced by the shared component and should be updated to the shared contract.

### Task 4: Integrate the saved meeting detail/history page

**Files:**

- Modify: `src/pages/MeetingDetailsPage.vue:456-520,677-742`
- Modify: `src/pages/__tests__/MeetingRecapPages.test.ts`

**Interfaces:**

- Consumes the shared `AiSummaryCard` props and `legacy` slot.
- Produces the same saved-summary, legacy-summary, regeneration, and recovery behavior under the shared layout.

- [ ] **Step 1: Derive the detail-page state explicitly.**

Import `AiSummaryCard` and its exported `AiSummaryCardState` type, then add a computed state with the same union used by the shared component:

```ts
const aiSummaryState = computed<AiSummaryCardState>(() => {
  if (isGeneratingSummary.value) return 'loading';
  if (aiSummaryRecovery.value) return 'error';
  if (aiSummary.value) return 'available';
  return 'empty';
});
```

Do not change the existing `canGenerateAiSummary` guard or the async `generateSummary` handler. If the existing page has a non-recovery error path, pass its already-safe localized text as `errorMessage`.

- [ ] **Step 2: Replace the saved-meeting AI card and preserve legacy content in the slot.**

Import `AiSummaryCard` and pass the detail-page meeting, state, permission flags, recovery, disclaimer, and labels. Wire all three events to `generateSummary`. Move the existing `saved-meeting-ai-card__legacy` block into the component's `#legacy` slot. Keep its data and markup intact except for selector names required by the shared shell.

Remove the old page-local card header styles and the `:deep(.ai-summary-panel__header)` override after the template no longer uses those classes. Retain legacy list styles if still needed.

- [ ] **Step 3: Extend page tests to confirm history/detail consistency.**

For the detail-page cases, assert `.ai-summary-card` exists, generation uses the shared test id, generated follow-through content remains visible, and the legacy summary fixture still renders all legacy sections. Keep the existing inert/access, recovery, and allowance assertions.

- [ ] **Step 4: Run the focused recap suite.**

Run: `npm test -- src/features/meeting/components/__tests__/AiSummaryCard.test.ts src/features/meeting/components/__tests__/AiRecapRecoveryPanel.test.ts src/features/meeting/components/__tests__/RecapAllowanceStatus.test.ts src/pages/__tests__/MeetingRecapPages.test.ts`

Expected: PASS with both pages using the shared card and all existing recap behavior covered.

### Task 5: Format, build, lint, and perform the mobile visual check

**Files:**

- Modify only files already listed above if formatting or test fixes are required.

**Interfaces:**

- Consumes the completed shared component and page integrations.
- Produces verified source with no behavior regressions.

- [ ] **Step 1: Run formatting.**

Run: `npm run format`

Review the diff to confirm formatting did not modify unrelated files. If it did, revert only unrelated formatting changes with a targeted patch; do not use destructive Git commands.

- [ ] **Step 2: Run the production build.**

Run: `npm run build`

Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Run repository checks.**

Run: `npm run check`

Expected: format check and ESLint pass. If an unrelated baseline lint failure remains, record its exact file and diagnostic in the handoff rather than changing unrelated code.

- [ ] **Step 4: Inspect the card at narrow mobile widths.**

Use the existing Vite preview/dev flow or the project’s available browser/device tooling to inspect both meeting summary routes. Confirm the icon/title alignment, explanatory copy wrapping, allowance strip, full-width green action, generated content, retry state, and bottom safe-area spacing. Confirm the page never exposes raw technical errors and that interactive controls remain keyboard/focus reachable.

No commit step is included because the project instructions require explicit user authorization before committing.
