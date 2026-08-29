# Settings Premium Benefit State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Premium feature rows as locked for Free households and enabled for active Premium households.

**Architecture:** Reuse the Settings page’s existing `hasPremium` computed entitlement state. Bind icon text and a state class to that value for every benefit row; existing CSS colors the enabled icon green, while a small locked modifier gives Free users a muted icon. No billing state or feature-access logic changes.

**Tech Stack:** Vue 3 Composition API, Vue Test Utils, Vitest, CSS.

## Global Constraints

- Free households show a muted `lock` icon for each Premium benefit.
- Active Premium households show the existing green `check` icon for each Premium benefit.
- Entitlement state comes only from `subscriptionStore.hasPremiumEntitlement`.
- Benefit text, upgrade actions, and subscription/feature-access logic remain unchanged.
- Icons are decorative with `aria-hidden="true"`.
- Do not stage or commit files.

---

## File Map

- Modify `src/pages/SettingsPage.vue`: derive each feature-row icon from `hasPremium`.
- Modify `src/styles/main.css`: add muted locked-icon styling without affecting enabled checks.
- Modify `src/pages/__tests__/SettingsPage.test.ts`: verify Free locks and Premium checks.

### Task 1: Add entitlement-state regression coverage

**Files:**
- Modify: `src/pages/__tests__/SettingsPage.test.ts`

**Interfaces:**
- Consumes the existing mock field `state.subscription.hasPremiumEntitlement`.
- Produces tests for `[data-testid="subscription-benefit-icon"]` values and state classes.

- [ ] **Step 1: Add a failing Free-state icon test**

```ts
it('shows locked Premium benefits for a Free household', () => {
  const wrapper = mountSettingsPage();
  const icons = wrapper.findAll('[data-testid="subscription-benefit-icon"]');

  expect(icons).toHaveLength(3);
  expect(icons.every((icon) => icon.text() === 'lock')).toBe(true);
  expect(
    icons.every((icon) => icon.classes('settings-subscription-benefit__icon--locked'))
  ).toBe(true);
});
```

- [ ] **Step 2: Add a failing Premium-state icon test**

```ts
it('shows enabled Premium benefits for an active Premium household', () => {
  state.subscription.hasPremiumEntitlement = true;

  const icons = mountSettingsPage().findAll(
    '[data-testid="subscription-benefit-icon"]'
  );

  expect(icons).toHaveLength(3);
  expect(icons.every((icon) => icon.text() === 'check')).toBe(true);
  expect(
    icons.some((icon) => icon.classes('settings-subscription-benefit__icon--locked'))
  ).toBe(false);
});
```

- [ ] **Step 3: Run the focused test to verify failure**

Run: `npm test -- src/pages/__tests__/SettingsPage.test.ts`

Expected: FAIL because every row currently renders `check` and has no benefit-icon test ID or locked modifier.

### Task 2: Render and style the locked state

**Files:**
- Modify: `src/pages/SettingsPage.vue`
- Modify: `src/styles/main.css`

**Interfaces:**
- Produces a `settings-subscription-benefit__icon--locked` modifier only when `hasPremium` is false.
- Every Premium-benefit icon has `data-testid="subscription-benefit-icon"` and contains `hasPremium ? 'check' : 'lock'`.

- [ ] **Step 1: Replace hard-coded feature icons**

For each item in `settings-subscription-benefits`, use this icon binding while retaining its visible localized benefit label.

```vue
<span
  class="material-symbols-outlined settings-subscription-benefit__icon"
  :class="{
    'settings-subscription-benefit__icon--locked': !hasPremium,
  }"
  aria-hidden="true"
  data-testid="subscription-benefit-icon"
>
  {{ hasPremium ? 'check' : 'lock' }}
</span>
```

- [ ] **Step 2: Add muted lock styling**

Keep the existing list layout and enabled color rule. Add only the locked modifier.

```css
.settings-subscription-benefit__icon--locked {
  color: var(--color-outline);
}
```

- [ ] **Step 3: Run the focused test to verify success**

Run: `npm test -- src/pages/__tests__/SettingsPage.test.ts`

Expected: PASS, including existing owner-only restore and manage-subscription checks.

### Task 3: Verify the mobile bundle

**Files:**
- Verify: `src/pages/SettingsPage.vue`
- Verify: `src/styles/main.css`
- Verify: `src/pages/__tests__/SettingsPage.test.ts`

**Interfaces:**
- The Settings screen accurately reflects a trusted entitlement change after the subscription store refreshes.

- [ ] **Step 1: Run the full mobile test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Manually verify on Android**

Open Settings while Free and confirm all three Premium benefits have muted lock icons. Complete a Test Store Premium purchase, return to Settings after the entitlement refresh, and confirm those icons become green checks.

## Self-Review

- Spec coverage: Task 1 covers both Free and Premium UI states; Task 2 derives and styles them from the trusted existing entitlement; Task 3 verifies the bundled mobile result.
- Placeholder scan: every behavior, test selector, CSS class, and verification command is explicit.
- Type consistency: the implementation uses the existing boolean `hasPremium` throughout and introduces no new state or service interface.
