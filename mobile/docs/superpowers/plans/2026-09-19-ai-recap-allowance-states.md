# AI Recap Allowance States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render dynamic Free and Premium AI recap allowance states, including exhausted upgrade actions, consistently inside every shared AI summary card.

**Architecture:** Extend `RecapAllowanceStatus.vue` into the single plan-aware allowance panel. It reads existing Pinia subscription/workspace state, derives Free/Premium visual state from the live allowance snapshot, and emits only generate or upgrade intents. `AiSummaryCard.vue` forwards those intents; the two pages retain router ownership and navigate an eligible owner to the existing named `upgrade` route.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, Vue Router, vue-i18n, Vitest, CSS custom properties, Vite.

## Global Constraints

- The app is mobile-only; preserve large touch targets and narrow, safe-area-compatible layouts.
- Use Vue 3 `<script setup lang="ts">`, typed props/emits, and computed state instead of template business logic.
- Use the existing `AssistantRecapAllowance` snapshot as the source of truth; do not add frontend entitlement overrides.
- Use existing OurWeek cream, amber, green, and neutral design tokens; do not introduce screenshot-specific hex colors.
- Every counter and progress value must derive from `remaining` and `limit`; do not hardcode only 0, 1, 3, 5, or 20.
- Preserve existing viewer/restricted, checking, unavailable, refresh, retry, generation, and saved-summary behavior.
- Exhausted actions only navigate to the existing `upgrade` route; they do not call billing APIs or native purchase flows directly.
- Keep English, Ukrainian, and Spanish message catalogs structurally aligned.
- Do not edit the existing user-owned `package.json` change.
- Do not commit changes unless the user explicitly requests commits.

---

## File map

- Modify `src/features/meeting/components/RecapAllowanceStatus.vue`: derive allowance view state, render Free/Premium counters and exhausted messages, and emit generate/upgrade intents.
- Modify `src/features/meeting/components/AiSummaryCard.vue`: pass action visibility and generation props through to the allowance panel; forward its emits and remove the duplicate local Generate button.
- Modify `src/pages/MeetingSummaryPage.vue`: handle the card's upgrade intent with the existing router.
- Modify `src/pages/MeetingDetailsPage.vue`: handle the card's upgrade intent with the existing router.
- Modify `src/features/localization/messages.ts`: add aligned dynamic allowance labels/actions in English, Ukrainian, and Spanish.
- Modify `src/styles/main.css`: replace the generic allowance strip/dots with Free and Premium panel styles, responsive counter layout, dots, progress bar, exhausted copy, divider, and full-width primary action.
- Modify `src/features/meeting/components/__tests__/RecapAllowanceStatus.test.ts`: test dynamic Free/Premium counts, arbitrary intermediate values, exhausted state, upgrade event, and fallback behavior.
- Modify `src/features/meeting/components/__tests__/AiSummaryCard.test.ts`: test that the shared card forwards generation and upgrade actions from the allowance panel.
- Modify `src/pages/__tests__/MeetingRecapPages.test.ts`: verify both page consumers route an exhausted eligible account to the named upgrade route without triggering AI generation.

## Component contract

`RecapAllowanceStatus.vue` should accept and emit the following contract:

```ts
interface RecapAllowanceStatusProps {
  showAction: boolean;
  canGenerate: boolean;
  generating: boolean;
  generateLabel: string;
}

const emit = defineEmits<{
  generate: [];
  upgrade: [];
}>();
```

It should derive the following computed state from `useSubscriptionStore()` and `useWorkspaceStore()`:

```ts
const recap = computed(() => subscription.assistantRecap);
const isPremium = computed(() => subscription.currentPlan === 'premium');
const remaining = computed(() => Math.max(0, recap.value?.remaining ?? 0));
const limit = computed(() => Math.max(0, recap.value?.limit ?? 0));
const isExhausted = computed(
  () => Boolean(recap.value) && remaining.value === 0
);
const progressPercent = computed(() => {
  if (!limit.value) return 0;
  return Math.min(100, Math.max(0, (remaining.value / limit.value) * 100));
});
```

`AiSummaryCard.vue` should add `upgrade: []` to its own emits, pass `showAction`, `canGenerate`, `generating`, and `generateLabel` to `RecapAllowanceStatus`, and forward `@generate` and `@upgrade`. The local card button must be removed so every action state has one source of markup and behavior.

### Task 1: Add failing allowance-state tests

**Files:**

- Modify: `src/features/meeting/components/__tests__/RecapAllowanceStatus.test.ts`
- Reference: `src/features/meeting/__tests__/recapFixtures.ts`
- Reference: `src/features/subscription/types.ts`

**Interfaces:**

- Consumes the `RecapAllowanceStatusProps` and emits defined above.
- Produces regression coverage for dynamic plan counters, progress, exhausted actions, and safe fallback states.

- [ ] **Step 1: Update the mount helper to pass the new props.**

Use these default props and keep the existing Pinia/i18n setup:

```ts
const defaultProps = {
  showAction: true,
  canGenerate: true,
  generating: false,
  generateLabel: 'Generate',
};

function render(props: Partial<typeof defaultProps> = {}) {
  wrapper = mount(RecapAllowanceStatus, {
    props: { ...defaultProps, ...props },
    global: { plugins: [context.pinia, context.i18n] },
  });
}
```

- [ ] **Step 2: Write failing Free-state tests for full, intermediate, last, and exhausted allowance.**

Set `context.subscription.currentPlan = 'free'` and use `allowance(3)`, `allowance(2)`, `allowance(1)`, and `allowance(0)`. Assert the counter always includes the data-derived values and that Last appears only at one remaining:

```ts
it.each([
  [3, 'Free summaries remaining: 3 of 3', false],
  [2, 'Free summaries remaining: 2 of 3', false],
  [1, 'Free summaries remaining: 1 of 3', true],
] as const)(
  'renders Free remaining count %i dynamically',
  (remaining, text, isLast) => {
    context.subscription.currentPlan = 'free';
    context.subscription.assistantRecap = allowance(remaining);
    render();

    expect(
      wrapper.get('[data-testid="recap-allowance-counter"]').text()
    ).toContain(text);
    expect(wrapper.find('[data-testid="recap-allowance-last"]').exists()).toBe(
      isLast
    );
    expect(
      wrapper.get('[data-testid="recap-allowance-generate"]').text()
    ).toContain('Generate');
  }
);

it('renders Free exhaustion and emits an explicit upgrade intent', async () => {
  context.subscription.currentPlan = 'free';
  context.subscription.assistantRecap = allowance(0);
  render({ canGenerate: false });

  expect(
    wrapper.get('[data-testid="recap-allowance-counter"]').text()
  ).toContain('0 of 3');
  expect(wrapper.text()).toContain('Free recap limit has been reached');
  await wrapper.get('[data-testid="recap-allowance-upgrade"]').trigger('click');
  expect(wrapper.emitted('upgrade')).toHaveLength(1);
});
```

Use the actual localized English strings after adding them in Task 2. Assert the generate action does not exist in the exhausted state.

- [ ] **Step 3: Write failing Premium-state tests for full, arbitrary intermediate, and exhausted allowance.**

Set `context.subscription.currentPlan = 'premium'` and use allowance snapshots with `periodEndsAt: '2026-10-04T10:00:00.000Z'`. Cover `20`, `7`, and `0` remaining rather than only screenshot values:

```ts
it.each([
  [20, '20 / 20', '20 summaries', '100'],
  [7, '7 / 20', '7 summaries remaining', '35'],
] as const)(
  'renders Premium remaining count %i dynamically',
  (remaining, counter, label, progress) => {
    context.subscription.currentPlan = 'premium';
    context.subscription.assistantRecap = {
      ...allowance(remaining),
      limit: 20,
      used: 20 - remaining,
      periodEndsAt: '2026-10-04T10:00:00.000Z',
    };
    render();

    expect(
      wrapper.get('[data-testid="recap-allowance-counter"]').text()
    ).toContain(counter);
    expect(
      wrapper
        .get('[data-testid="recap-allowance-progress"]')
        .attributes('aria-valuenow')
    ).toBe(progress);
    expect(wrapper.text()).toContain(label);
  }
);
```

For zero remaining, assert the panel contains Limit reached, the plan-limit explanation, no generate control, and the `recap-allowance-upgrade` event after tapping its action.

- [ ] **Step 4: Preserve fallback-state tests.**

Keep and adapt the existing checking, unavailable, refresh, viewer, and positive-but-restricted tests. Assert they use the fallback status content, do not expose a primary upgrade action to non-owners, and do not emit generate.

- [ ] **Step 5: Run the focused component test and confirm it fails.**

Run: `npm test -- src/features/meeting/components/__tests__/RecapAllowanceStatus.test.ts`

Expected: FAIL because the existing component has no structured counters, progress element, action test ids, or emits.

### Task 2: Implement the dynamic allowance panel and localized copy

**Files:**

- Modify: `src/features/meeting/components/RecapAllowanceStatus.vue`
- Modify: `src/features/localization/messages.ts`
- Modify: `src/styles/main.css`

**Interfaces:**

- Consumes the props/emits and store-derived computed state described in the component contract.
- Produces semantic Free/Premium panel markup with stable test ids and no direct billing calls.

- [ ] **Step 1: Add aligned localization messages.**

Under `ai.recap` in English, Ukrainian, and Spanish, add these keys with the same placeholders in every locale:

```ts
freeCounter: 'Free summaries remaining: {remaining} of {limit}',
freeLast: 'Last',
freeExhaustedTitle: 'Free recap limit has been reached.',
freeExhaustedBody: 'Your free recap limit will renew next period. Upgrade to continue now.',
premiumAvailable: 'Available in your plan',
premiumCounter: '{remaining} / {limit}',
premiumFull: '{limit} summaries',
premiumRemaining: '{remaining} summaries remaining',
premiumExhaustedLabel: 'Limit reached',
premiumExhaustedBody: 'Your plan recap limit has been reached. Update your plan to continue using AI summaries.',
upgradeToPremium: 'Upgrade to Premium',
updatePlan: 'Update plan',
```

Use calm translations in Ukrainian and Spanish. Keep the existing `freeRemaining`, `freeExhausted`, `premiumRemaining`, `premiumExhausted`, `premiumNoDate`, `checking`, `unavailable`, `restricted`, and `refresh` keys for fallback compatibility until no other consumer needs them.

- [ ] **Step 2: Implement Free and Premium view branches.**

In `RecapAllowanceStatus.vue`, use a single `v-if` branch for a usable, non-restricted allowance snapshot and a fallback branch for viewer/checking/unavailable/restricted states. For Free, render a dynamic counter, up to three decorative dots, an optional Last badge only at one remaining, and the generate/upgrade action. For Premium, render a plan icon, dynamic `{remaining} / {limit}` counter, a native progressbar with `aria-valuemin="0"`, `aria-valuemax="100"`, `:aria-valuenow="String(progressPercent)"`, dynamic width from `progressPercent`, and the generate/upgrade action.

Use these action guards:

```ts
const canOfferUpgrade = computed(
  () => isExhausted.value && canPurchasePremium(workspace.currentUserRole)
);
const canShowGenerate = computed(
  () =>
    props.showAction &&
    !isExhausted.value &&
    props.canGenerate &&
    recap.value?.canGenerate === true
);
```

Emit `generate` only from the enabled generation button. Emit `upgrade` only from the eligible exhausted action. Keep refresh as `subscription.refreshCurrentPlan()` in the fallback state.

- [ ] **Step 3: Add token-based panel styles.**

Replace the current generic status grid styles with semantic classes:

```css
.recap-allowance-status--panel {
  display: grid;
  gap: 12px;
  border: 1px solid var(--color-outline-variant);
  border-radius: var(--radius-md);
  background: var(--color-surface-low);
  padding: 16px;
}

.recap-allowance-status__counter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.recap-allowance-status__dots {
  display: inline-flex;
  gap: 6px;
  color: var(--color-secondary);
}

.recap-allowance-status__progress {
  height: 8px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-surface-container);
}

.recap-allowance-status__progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--color-secondary-container);
}

.recap-allowance-status__exhausted-copy {
  border-top: 1px solid var(--color-outline-variant);
  padding-top: 12px;
}

.recap-allowance-status__action {
  width: 100%;
  min-height: 48px;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-on-primary);
}
```

Use `--color-surface-low`, `--color-secondary`, `--color-secondary-container`, `--color-primary`, `--color-on-primary`, `--color-outline-variant`, `--radius-md`, and the existing spacing tokens. Cap the Free dot group at three indicators even if the configured limit differs; the numeric counter remains authoritative. Ensure counters and explanatory text wrap safely at 320px viewport width.

- [ ] **Step 4: Run allowance tests and fix only allowance-panel failures.**

Run: `npm test -- src/features/meeting/components/__tests__/RecapAllowanceStatus.test.ts`

Expected: PASS for Free/Premium full, arbitrary intermediate, last, exhausted, and fallback states.

### Task 3: Forward allowance actions through the shared card and both page consumers

**Files:**

- Modify: `src/features/meeting/components/AiSummaryCard.vue`
- Modify: `src/pages/MeetingSummaryPage.vue`
- Modify: `src/pages/MeetingDetailsPage.vue`
- Modify: `src/features/meeting/components/__tests__/AiSummaryCard.test.ts`
- Modify: `src/pages/__tests__/MeetingRecapPages.test.ts`

**Interfaces:**

- Consumes `RecapAllowanceStatus` `generate` and `upgrade` events.
- Produces `AiSummaryCard` `generate`, `regenerate`, `retry`, and `upgrade` events.

- [ ] **Step 1: Update the shared-card tests before implementation.**

Change the `RecapAllowanceStatus` test stub to accept props and emit actions:

```ts
RecapAllowanceStatus: {
  emits: ['generate', 'upgrade'],
  template: `
    <button data-testid="recap-allowance-generate" @click="$emit('generate')">Generate</button>
    <button data-testid="recap-allowance-upgrade" @click="$emit('upgrade')">Upgrade</button>
  `,
},
```

Assert the card forwards each event once and does not render the removed local `generate-meeting-recap` button.

- [ ] **Step 2: Implement event forwarding in `AiSummaryCard.vue`.**

Add `upgrade: []` to `defineEmits`. Replace the standalone button with:

```vue
<RecapAllowanceStatus
  :show-action="state === 'empty'"
  :can-generate="canGenerate"
  :generating="generating"
  :generate-label="generateLabel"
  @generate="emit('generate')"
  @upgrade="emit('upgrade')"
/>
```

Keep the allowance panel in the same card location for all states but render its primary action only while the AI state is empty. Do not alter recovery, follow-through, legacy-summary, or disclaimer behavior.

- [ ] **Step 3: Wire both pages to the existing named route.**

Both pages already have `router`. Add the same event binding to their `AiSummaryCard` instances:

```vue
@upgrade="router.push({ name: 'upgrade' })"
```

Do not call purchase or manage-subscription actions in either page. Preserve their existing `@generate`, `@regenerate`, and `@retry` handlers.

- [ ] **Step 4: Extend page tests for exhausted-route behavior.**

Make the mocked `useRouter` return a shared `push` spy. In the `describe.each` recap-page cases, set an owner, a completed meeting with no AI summary, and an exhausted allowance. Tap `[data-testid="recap-allowance-upgrade"]`, then assert:

```ts
expect(push).toHaveBeenCalledWith({ name: 'upgrade' });
expect(generateMeetingSummary).not.toHaveBeenCalled();
```

Keep the existing generation test id assertions only where the generated button still comes from the allowance panel; update its selector from `generate-meeting-recap` to `recap-allowance-generate` without weakening the behavior assertions.

- [ ] **Step 5: Run shared-card and page tests.**

Run: `npm test -- src/features/meeting/components/__tests__/AiSummaryCard.test.ts src/pages/__tests__/MeetingRecapPages.test.ts`

Expected: PASS with both pages forwarding allowed exhausted actions to the upgrade route and positive allowances still generating through the existing handlers.

### Task 4: Run regression and quality gates

**Files:**

- Modify only files listed above if test, formatting, or lint corrections are needed.

**Interfaces:**

- Consumes the completed dynamic allowance panel and page integrations.
- Produces a verified UI change with unchanged backend/billing behavior.

- [ ] **Step 1: Format only files changed by this task.**

Run:

```powershell
npx prettier --write src/features/meeting/components/RecapAllowanceStatus.vue src/features/meeting/components/AiSummaryCard.vue src/features/meeting/components/__tests__/RecapAllowanceStatus.test.ts src/features/meeting/components/__tests__/AiSummaryCard.test.ts src/pages/MeetingSummaryPage.vue src/pages/MeetingDetailsPage.vue src/pages/__tests__/MeetingRecapPages.test.ts src/features/localization/messages.ts src/styles/main.css docs/superpowers/specs/2026-09-18-ai-recap-allowance-states-design.md docs/superpowers/plans/2026-09-19-ai-recap-allowance-states.md
```

Do not format or alter the user-owned `package.json` change.

- [ ] **Step 2: Run the complete test suite.**

Run: `npm test`

Expected: PASS, including existing recap recovery, allowance refresh, and page-flow tests.

- [ ] **Step 3: Run the production build.**

Run: `npm run build`

Expected: TypeScript and Vite production build pass.

- [ ] **Step 4: Run repository checks.**

Run: `npm run check`

Expected: Prettier and ESLint pass. If an unrelated baseline error occurs, record its exact diagnostic without modifying unrelated code.

- [ ] **Step 5: Review the final diff.**

Run: `git -c safe.directory=D:/Projects/myself/weekly-us diff -- src/features/meeting/components/RecapAllowanceStatus.vue src/features/meeting/components/AiSummaryCard.vue src/pages/MeetingSummaryPage.vue src/pages/MeetingDetailsPage.vue src/features/localization/messages.ts src/styles/main.css src/features/meeting/components/__tests__/RecapAllowanceStatus.test.ts src/features/meeting/components/__tests__/AiSummaryCard.test.ts src/pages/__tests__/MeetingRecapPages.test.ts docs/superpowers/specs/2026-09-18-ai-recap-allowance-states-design.md docs/superpowers/plans/2026-09-19-ai-recap-allowance-states.md`

Confirm the diff contains only the allowance-state work and leaves `package.json` untouched. No commit step is included because the project requires explicit user authorization before committing.
