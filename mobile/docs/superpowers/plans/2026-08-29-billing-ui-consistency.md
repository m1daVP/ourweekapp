# Billing UI Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Account, Settings, and Upgrade expose subscription actions only to workspace owners and provide consistent, safe result feedback backed by the existing entitlement store.

**Architecture:** Preserve `useSubscriptionStore()` as the only UI source for plan, entitlement, loading, and feedback state. Account will adopt the established workspace-role policy already used by Settings and Upgrade; focused page tests will exercise the three page boundaries without introducing any new billing API, provider call, or shared UI abstraction.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, vue-i18n, Vitest, @vue/test-utils, happy-dom.

## Global Constraints

- Preserve the backend-trusted entitlement flow; pages must call only existing `subscriptionStore` actions.
- Gate Restore purchases and Manage subscription with `canPurchasePremium(workspaceStore.currentUserRole)`; only `owner` is eligible.
- Keep Account's plan, renewal, and management-availability details readable by every role.
- Disable Restore when `subscriptionStore.isRestoring` is true or `appConfig.isRevenueCatEnabled` is false.
- Disable Manage subscription when `subscriptionStore.isManaging` is true.
- Render only the store's existing localized `statusMessage` and safe `errorMessage`; do not expose raw provider or backend errors.
- Do not add dependencies, endpoints, migrations, or duplicate entitlement state.
- Do not stage or commit changes without an explicitly approved commit list.

---

## File Structure

- `src/pages/AccountPage.vue`: retain read-only subscription information for all roles and make Restore plus its feedback owner-only.
- `src/pages/SettingsPage.vue`: add an explicit owner gate and a stable selector to the existing Manage control; preserve existing Restore behavior.
- `src/pages/UpgradePage.vue`: add stable test selectors to existing Restore and Manage controls; keep existing behavior unchanged.
- `src/pages/__tests__/AccountPage.test.ts`: test Account role gating, disabled Restore states, and success/error feedback.
- `src/pages/__tests__/SettingsPage.test.ts`: extend coverage to Manage ownership/loading and verify non-owners see no billing actions.
- `src/pages/__tests__/UpgradePage.test.ts`: add role, disabled-state, and status/error feedback coverage for purchase, Restore, and Manage controls.

### Task 1: Add Account billing-boundary regression coverage

**Files:**

- Modify: `src/pages/__tests__/AccountPage.test.ts`

**Interfaces:**

- Consumes: `AccountPage.vue`, `useSubscriptionStore()`, `useWorkspaceStore()`, `appConfig.isRevenueCatEnabled`.
- Produces: a failing regression suite that identifies Account's missing owner gate and error feedback before the page change.

- [ ] **Step 1: Make the Account test state mutable for role, configuration, and billing results**

Replace the static workspace, subscription, and environment mocks with this state shape and use it from each mock:

```ts
const state = vi.hoisted(() => ({
  user: {
    email: 'member@example.com',
    displayName: 'Member',
    createdAt: '2026-08-01T00:00:00.000Z',
  },
  role: 'owner' as 'owner' | 'adult_member' | 'viewer',
  revenueCatEnabled: true,
  restorePurchases: vi.fn(),
  subscription: {
    currentPlan: 'free' as const,
    hasPremiumEntitlement: false,
    premiumEntitlement: null,
    canManageSubscription: false,
    isRestoring: false,
    isManaging: false,
    statusMessage: '',
    errorMessage: '',
  },
}));

vi.mock('@/app/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    currentUserRole: state.role,
    $reset: vi.fn(),
  }),
}));

vi.mock('@/app/stores/subscription', () => ({
  useSubscriptionStore: () => ({
    ...state.subscription,
    restorePurchases: state.restorePurchases,
    $reset: vi.fn(),
  }),
}));

vi.mock('@/shared/config/env', () => ({
  appConfig: {
    get isRevenueCatEnabled() {
      return state.revenueCatEnabled;
    },
  },
}));
```

- [ ] **Step 2: Add a reusable mount helper and reset billing state before each case**

Add this helper and `beforeEach` setup above `describe('AccountPage', ...)`:

```ts
function mountAccountPage() {
  return shallowMount(AccountPage, {
    global: {
      stubs: {
        ConfirmationDialog: true,
        PremiumBadge: true,
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  });
}

beforeEach(() => {
  state.role = 'owner';
  state.revenueCatEnabled = true;
  state.restorePurchases.mockReset();
  Object.assign(state.subscription, {
    currentPlan: 'free',
    hasPremiumEntitlement: false,
    premiumEntitlement: null,
    canManageSubscription: false,
    isRestoring: false,
    isManaging: false,
    statusMessage: '',
    errorMessage: '',
  });
});
```

Update the existing deletion-fallback test to call `mountAccountPage()`.

- [ ] **Step 3: Add the failing owner, disabled-state, and feedback assertions**

Add the following tests:

```ts
it('shows Restore purchases to an owner and invokes the store action', async () => {
  const wrapper = mountAccountPage();

  await wrapper.get('[data-testid="restore-purchases"]').trigger('click');

  expect(state.restorePurchases).toHaveBeenCalledOnce();
});

it.each(['adult_member', 'viewer'] as const)(
  'keeps subscription details but hides billing actions from %s',
  (role) => {
    state.role = role;

    const wrapper = mountAccountPage();

    expect(wrapper.find('.subscription-status-list').exists()).toBe(true);
    expect(wrapper.find('[data-testid="restore-purchases"]').exists()).toBe(
      false
    );
  }
);

it.each([
  ['a restore is already running', { isRestoring: true }, true],
  ['native billing is unavailable', {}, false],
] as const)(
  'disables Restore purchases when %s',
  (_, subscription, configured) => {
    Object.assign(state.subscription, subscription);
    state.revenueCatEnabled = configured;

    expect(
      mountAccountPage()
        .get('[data-testid="restore-purchases"]')
        .attributes('disabled')
    ).toBeDefined();
  }
);

it('shows the store success and safe error result beside Account billing actions', () => {
  state.subscription.statusMessage = 'upgrade.premiumRestored';
  state.subscription.errorMessage = 'upgrade.restoreFailed';

  const wrapper = mountAccountPage();

  expect(wrapper.get('[role="status"]').text()).toContain(
    'upgrade.premiumRestored'
  );
  expect(wrapper.get('[role="alert"]').text()).toContain(
    'upgrade.restoreFailed'
  );
});
```

- [ ] **Step 4: Run the focused test to verify it fails against the current Account page**

Run:

```powershell
npm test -- src/pages/__tests__/AccountPage.test.ts
```

Expected: FAIL because Account does not yet expose the Restore selector, has no owner gate, and does not render `subscriptionStore.errorMessage`.

### Task 2: Make Account billing actions and feedback owner-only

**Files:**

- Modify: `src/pages/AccountPage.vue:12-52,250-306`
- Test: `src/pages/__tests__/AccountPage.test.ts`

**Interfaces:**

- Consumes: `canPurchasePremium(role): boolean`, `workspaceStore.currentUserRole`, `appConfig.isRevenueCatEnabled`, and the existing `subscriptionStore.restorePurchases(): Promise<boolean>` action.
- Produces: an owner-only Account Restore action with stable selector `data-testid="restore-purchases"`; read-only subscription details remain available to every role.

- [ ] **Step 1: Import the existing ownership policy and read the workspace role**

Add the policy import beside the other feature imports and instantiate the workspace store with the existing store declarations:

```ts
import { canPurchasePremium } from '@/features/access/premiumPurchasePolicy';

const workspaceStore = useWorkspaceStore();
```

Add this computed value after `canRestorePurchases`:

```ts
const isWorkspaceOwner = computed(() =>
  canPurchasePremium(workspaceStore.currentUserRole)
);
```

- [ ] **Step 2: Gate Restore and its result feedback without changing the read-only card content**

Replace Account's unconditional Restore button and status paragraph with:

```vue
<button
  v-if="isWorkspaceOwner"
  class="secondary-button"
  type="button"
  data-testid="restore-purchases"
  :disabled="subscriptionStore.isRestoring || !canRestorePurchases"
  @click="subscriptionStore.restorePurchases()"
>
  {{ t('account.restorePurchases') }}
</button>
<p
  v-if="isWorkspaceOwner && subscriptionStore.statusMessage"
  class="meeting-status"
  role="status"
>
  {{ subscriptionStore.statusMessage }}
</p>
<p
  v-if="isWorkspaceOwner && subscriptionStore.errorMessage"
  class="meeting-error"
  role="alert"
>
  {{ subscriptionStore.errorMessage }}
</p>
```

Do not change the `subscription-status-list`, View Premium link, or its plan and renewal rendering. Do not add an Account-specific billing action implementation.

- [ ] **Step 3: Run the Account regression suite**

Run:

```powershell
npm test -- src/pages/__tests__/AccountPage.test.ts
```

Expected: PASS. The owner can restore; adult members and viewers retain details but have no Restore action; disabled and safe-feedback cases pass.

### Task 3: Cover Settings and Upgrade action consistency

**Files:**

- Modify: `src/pages/SettingsPage.vue:306-350`
- Modify: `src/pages/UpgradePage.vue:156-215`
- Modify: `src/pages/__tests__/SettingsPage.test.ts`
- Modify: `src/pages/__tests__/UpgradePage.test.ts`

**Interfaces:**

- Consumes: existing `subscriptionStore.restorePurchases()`, `subscriptionStore.manageSubscription()`, action flags, and `canPurchasePremium`-derived role state already present in both pages.
- Produces: durable selectors for existing controls and regression coverage proving owner-only visibility, action-specific loading disables, unavailable-native-billing Restore disables, and visible result feedback.

- [ ] **Step 1: Gate Settings Manage to owners and add a stable selector**

Change the existing Settings Manage button condition and add its selector:

```vue
v-if="hasPremium && isWorkspaceOwner && subscriptionStore.canManageSubscription"
data-testid="manage-subscription"
```

Keep its existing `:disabled` binding and click handler unchanged. On the
existing Settings Restore button keep `data-testid="restore-purchases"` and
do not alter its `v-if`, `:disabled`, click handler, or feedback conditions.

- [ ] **Step 2: Extend Settings tests for Manage ownership and loading**

Add `manageSubscription: vi.fn()` to the mock subscription store. Then add these tests:

```ts
it('shows Manage subscription only to an owner when management is supported', () => {
  state.subscription.hasPremiumEntitlement = true;
  state.subscription.canManageSubscription = true;

  expect(
    mountSettingsPage().find('[data-testid="manage-subscription"]').exists()
  ).toBe(true);
});

it('hides every Settings billing action from a non-owner', () => {
  state.role = 'adult_member';
  state.subscription.hasPremiumEntitlement = true;
  state.subscription.canManageSubscription = true;

  const wrapper = mountSettingsPage();

  expect(wrapper.find('[data-testid="restore-purchases"]').exists()).toBe(
    false
  );
  expect(wrapper.find('[data-testid="manage-subscription"]').exists()).toBe(
    false
  );
});

it('disables Manage subscription while management is in progress', () => {
  state.subscription.hasPremiumEntitlement = true;
  state.subscription.canManageSubscription = true;
  state.subscription.isManaging = true;

  expect(
    mountSettingsPage()
      .get('[data-testid="manage-subscription"]')
      .attributes('disabled')
  ).toBeDefined();
});
```

- [ ] **Step 3: Add selectors to the existing Upgrade controls without changing their conditions or handlers**

On the existing Upgrade primary purchase button add:

```vue
data-testid="start-premium"
```

On the existing Upgrade Restore button add:

```vue
data-testid="restore-purchases"
```

On the existing Upgrade Manage button add:

```vue
data-testid="manage-subscription"
```

- [ ] **Step 4: Extend Upgrade test mocks and add the cross-surface behavior cases**

Promote `presentPremiumPaywall`, `restorePurchases`, and `manageSubscription` to `vi.fn()` fields on the hoisted state and return those exact functions from the subscription-store mock. Reset each mock in `beforeEach`.

Add these tests:

```ts
it.each(['adult_member', 'viewer'] as const)(
  'hides all Upgrade billing actions from %s',
  (role) => {
    state.role = role;
    state.subscription.canManageSubscription = true;

    const wrapper = mountUpgradePage();

    expect(wrapper.find('[data-testid="start-premium"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="restore-purchases"]').exists()).toBe(
      false
    );
    expect(wrapper.find('[data-testid="manage-subscription"]').exists()).toBe(
      false
    );
  }
);

it.each([
  ['a purchase is running', 'start-premium', { isPurchasing: true }],
  ['a restore is running', 'restore-purchases', { isRestoring: true }],
  [
    'management is running',
    'manage-subscription',
    { canManageSubscription: true, isManaging: true },
  ],
] as const)(
  'disables the Upgrade action while %s',
  (_, testId, subscription) => {
    Object.assign(state.subscription, subscription);

    expect(
      mountUpgradePage().get(`[data-testid="${testId}"]`).attributes('disabled')
    ).toBeDefined();
  }
);

it('disables Upgrade Restore when native billing is unavailable', () => {
  state.revenueCatEnabled = false;

  expect(
    mountUpgradePage()
      .get('[data-testid="restore-purchases"]')
      .attributes('disabled')
  ).toBeDefined();
});

it('renders safe status and error feedback in the Upgrade billing dock', () => {
  state.subscription.statusMessage = 'upgrade.premiumRestored';
  state.subscription.errorMessage = 'upgrade.restoreFailed';

  const wrapper = mountUpgradePage();

  expect(wrapper.get('[role="status"]').text()).toContain(
    'upgrade.premiumRestored'
  );
  expect(wrapper.get('[role="alert"]').text()).toContain(
    'upgrade.restoreFailed'
  );
});
```

- [ ] **Step 5: Run all billing-surface page tests**

Run:

```powershell
npm test -- src/pages/__tests__/AccountPage.test.ts src/pages/__tests__/SettingsPage.test.ts src/pages/__tests__/UpgradePage.test.ts
```

Expected: PASS. The tests cover owner access, adult-member/viewer denial, each in-progress state, disabled Restore without native billing, and visible safe feedback.

### Task 4: Run application-wide verification and record manual release coverage

**Files:**

- Verify only: `src/pages/AccountPage.vue`, `src/pages/SettingsPage.vue`, `src/pages/UpgradePage.vue`, and their page tests.

**Interfaces:**

- Consumes: completed billing UI changes and existing build/lint/test scripts.
- Produces: verified source changes ready for user review; no commit is created.

- [ ] **Step 1: Run the complete test suite**

Run:

```powershell
npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run the production build**

Run:

```powershell
npm run build
```

Expected: `vue-tsc --noEmit` and the Vite production build exit with code 0.

- [ ] **Step 3: Run the formatting and lint checks**

Run:

```powershell
npm run check
```

Expected: Prettier and ESLint exit with code 0.

- [ ] **Step 4: Perform the targeted Android smoke test before declaring the milestone release-ready**

On a physical Android device with RevenueCat configured, use each role to verify:

1. Owner: Settings, Account, and Upgrade each expose Restore purchases; Settings and Upgrade expose Manage subscription only when the provider says it is supported.
2. Adult member and viewer: each page retains the intended read-only subscription information, but displays no Restore, Manage, or Upgrade-purchase action.
3. Owner: starting Restore or Manage disables only the action in progress; a success shows a localized status and an induced failure shows safe error copy near the initiating action.
4. Owner with billing configuration absent: Restore stays visibly disabled across all three pages.

- [ ] **Step 5: Stop for user review before committing**

Report changed files and every command result. Do not stage or commit unless the user provides an explicitly approved numbered commit list.
