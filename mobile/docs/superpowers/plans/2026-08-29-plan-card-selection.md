# Premium Plan Card Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a household owner select Monthly or Yearly on the upgrade page and purchase exactly that selected RevenueCat package.

**Architecture:** Keep package lookup and purchasing in the existing subscription provider. Add page-local selection state that prefers Yearly when it is available, renders each live plan as an accessible choice, and sends the selected plan ID to the existing store `purchasePlan` action. CSS only changes the card selection treatment; the RevenueCat offering and backend activation flow are untouched.

**Tech Stack:** Vue 3 Composition API, Pinia, Vue Test Utils, Vitest, CSS.

## Global Constraints

- Yearly is selected by default only when it is among the live store plans; otherwise select the first live plan.
- Selecting a card must not initiate a purchase.
- The primary button must call `subscriptionStore.purchasePlan(selectedPlan.id)` rather than the generic RevenueCat paywall path.
- Cards must remain keyboard-accessible and expose their selected state to assistive technology.
- Keep the existing unavailable, owner-only, restore, and active-Premium states unchanged.
- Do not change RevenueCat products, offerings, entitlements, API keys, or backend subscription validation.
- Do not stage or commit files.

---

## File Map

- Modify `src/pages/UpgradePage.vue`: hold the selected plan, make cards selectable, and purchase the selected ID.
- Modify `src/styles/main.css`: distinguish the selected card from the Yearly recommendation card and expose an interactive focus state.
- Modify `src/pages/__tests__/UpgradePage.test.ts`: cover default selection, switching selection, and purchasing the chosen plan.

### Task 1: Specify and test selectable live plans

**Files:**
- Modify: `src/pages/__tests__/UpgradePage.test.ts`

**Interfaces:**
- Consumes rendered card controls with `data-testid="plan-premium_monthly"` and `data-testid="plan-premium_yearly"`.
- Produces required behavior: the Yearly plan is initially selected when both plans are live; selecting Monthly changes the active choice; the primary action invokes `purchasePlan('premium_monthly')`.

- [ ] **Step 1: Extend the subscription-store mock with purchase support**

Add `purchasePlan: vi.fn()` to the hoisted mock state, expose it from the `useSubscriptionStore` mock, and reset it in `beforeEach`.

```ts
purchasePlan: vi.fn(),

purchasePlan: state.purchasePlan,

state.purchasePlan.mockReset();
```

- [ ] **Step 2: Provide both live plans in the test fixture**

Replace the one-plan default fixture with these two options so the preference and switching behavior are observable.

```ts
availablePlans: [
  {
    id: 'premium_monthly',
    name: 'Monthly',
    priceLabel: '$4.99',
    description: 'Monthly Premium',
    cadence: 'monthly',
    planType: 'premium',
    entitlementKey: 'premium',
    productIds: { android: 'monthly' },
  },
  {
    id: 'premium_yearly',
    name: 'Yearly',
    priceLabel: '$39.99',
    description: 'Yearly Premium',
    cadence: 'yearly',
    planType: 'premium',
    entitlementKey: 'premium',
    productIds: { android: 'yearly' },
  },
],
```

- [ ] **Step 3: Add failing selection and purchase tests**

```ts
it('selects Yearly by default and lets the owner switch to Monthly', async () => {
  const wrapper = mountUpgradePage();

  expect(
    wrapper.get('[data-testid="plan-premium_yearly"]').attributes('aria-pressed')
  ).toBe('true');

  await wrapper.get('[data-testid="plan-premium_monthly"]').trigger('click');

  expect(
    wrapper.get('[data-testid="plan-premium_monthly"]').attributes('aria-pressed')
  ).toBe('true');
  expect(
    wrapper.get('[data-testid="plan-premium_yearly"]').attributes('aria-pressed')
  ).toBe('false');
});

it('purchases the selected plan instead of opening the generic paywall', async () => {
  const wrapper = mountUpgradePage();

  await wrapper.get('[data-testid="plan-premium_monthly"]').trigger('click');
  await wrapper.get('[data-testid="start-premium"]').trigger('click');

  expect(state.purchasePlan).toHaveBeenCalledWith('premium_monthly');
  expect(state.presentPremiumPaywall).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Run the focused test to verify failure**

Run: `npm test -- src/pages/__tests__/UpgradePage.test.ts`

Expected: FAIL because cards have no test IDs or selected state and the primary button still calls `presentPremiumPaywall()`.

### Task 2: Implement selection and exact-package purchase

**Files:**
- Modify: `src/pages/UpgradePage.vue`
- Modify: `src/styles/main.css`

**Interfaces:**
- Produces `selectedPlan`, a computed `SubscriptionPlanOption | null` that uses a user selection when valid and otherwise prefers `premium_yearly`.
- Produces `selectPlan(planId: SubscriptionPlanOption['id']): void`.
- Produces `purchaseSelectedPlan(): Promise<void>` that invokes `subscriptionStore.purchasePlan(selectedPlan.value.id)` only when a live plan is selected.

- [ ] **Step 1: Add page-local selection state and derived fallback**

In `UpgradePage.vue`, import `ref`, declare `selectedPlanId`, and resolve a valid selected plan from `displayPlans` so an offering refresh cannot leave the UI pointing at a missing product.

```ts
const selectedPlanId = ref<SubscriptionPlanOption['id'] | null>(null);

const selectedPlan = computed(() => {
  const explicitlySelectedPlan = displayPlans.value.find(
    (plan) => plan.id === selectedPlanId.value
  );

  return (
    explicitlySelectedPlan ??
    displayPlans.value.find((plan) => plan.id === 'premium_yearly') ??
    displayPlans.value[0] ??
    null
  );
});

function selectPlan(planId: SubscriptionPlanOption['id']) {
  selectedPlanId.value = planId;
}

async function purchaseSelectedPlan() {
  if (!selectedPlan.value) {
    return;
  }

  await subscriptionStore.purchasePlan(selectedPlan.value.id);
}
```

- [ ] **Step 2: Replace static plan articles with selectable controls**

Use a button for each card, set `data-testid`, set `aria-pressed` from `selectedPlan`, and call `selectPlan(plan.id)` on click. Move the selected modifier and the checkmark condition from `isYearlyPlan(plan)` to selection state; keep the yearly modifier only for the recommendation styling.

```vue
<button
  v-for="plan in displayPlans"
  :key="plan.id"
  class="upgrade-plan-card"
  :class="{
    'upgrade-plan-card--yearly': isYearlyPlan(plan),
    'upgrade-plan-card--selected': selectedPlan?.id === plan.id,
  }"
  type="button"
  :data-testid="`plan-${plan.id}`"
  :aria-pressed="selectedPlan?.id === plan.id"
  @click="selectPlan(plan.id)"
>
  <!-- retain the existing card content -->
</button>
```

Change the primary action to this handler:

```vue
@click="purchaseSelectedPlan"
```

- [ ] **Step 3: Add selected and focus styling**

Make the plan card visually interactive, preserve the annual recommendation styling, and use the selected modifier for the filled indicator.

```css
.upgrade-plan-card {
  width: 100%;
  cursor: pointer;
  text-align: left;
}

.upgrade-plan-card:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

.upgrade-plan-card--selected {
  border-color: #6f8f72;
  box-shadow: var(--shadow-card);
}

.upgrade-plan-card--selected .upgrade-plan-card__indicator {
  border-color: #6f8f72;
  background: #6f8f72;
}
```

Remove the current yearly-only filled-indicator selector so Monthly receives the same selected visual state.

- [ ] **Step 4: Run the focused test to verify success**

Run: `npm test -- src/pages/__tests__/UpgradePage.test.ts`

Expected: PASS, including the existing unavailable, owner-only, restoration, and status-feedback checks.

### Task 3: Verify production build behavior

**Files:**
- Verify: `src/pages/UpgradePage.vue`
- Verify: `src/styles/main.css`
- Verify: `src/pages/__tests__/UpgradePage.test.ts`

**Interfaces:**
- The native app calls the existing direct package purchase provider with the user-selected package ID.

- [ ] **Step 1: Run the mobile test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: PASS and emits the web bundle used by Capacitor.

- [ ] **Step 3: Manually verify on Android**

Open Settings → Premium on the physical device, confirm Yearly is initially selected, tap Monthly, confirm its indicator moves, then tap Start Premium and verify RevenueCat opens the Test Store purchase modal for Monthly.

### Task 4: Refine selection motion

**Files:**
- Modify: `src/styles/main.css`

**Interfaces:**
- Selected cards animate border, background, box shadow, and a 1% upward scale over `220ms cubic-bezier(0.2, 0.8, 0.2, 1)`.
- The selection indicator fades and scales over `160ms ease`.
- The existing reduced-motion media query disables these transitions.

- [ ] **Step 1: Add a failing visual regression assertion**

Extend the Upgrade page test with the existing Monthly-selection interaction and assert the selected modifier moves between cards. The interaction test from Task 1 remains the behavioral regression coverage; CSS motion is verified by code review because happy-dom does not render transitions.

- [ ] **Step 2: Add the card and indicator transitions**

```css
.upgrade-plan-card {
  transform: translateY(0) scale(1);
  transition:
    border-color 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    background-color 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.upgrade-plan-card--selected {
  transform: translateY(-2px) scale(1.01);
}
```

Use `opacity` and `transform` transitions on the indicator checkmark, then add the plan-card selectors to the existing `@media (prefers-reduced-motion: reduce)` rule with `transition: none` and `transform: none`.

- [ ] **Step 3: Run focused verification**

Run: `npm test -- src/pages/__tests__/UpgradePage.test.ts`

Expected: PASS.

## Self-Review

- Spec coverage: Task 1 verifies Yearly defaulting, Monthly selection, and exact purchase dispatch. Task 2 implements accessible selection and keeps purchase confirmation separate. Task 3 verifies the bundled Android flow.
- Placeholder scan: no incomplete implementation instructions or unspecified tests remain.
- Type consistency: `selectedPlanId`, `selectedPlan`, `selectPlan`, and `purchaseSelectedPlan` use `SubscriptionPlanOption['id']` throughout.
