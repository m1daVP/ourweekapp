# Settings Restore Purchases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let workspace owners restore native purchases from the Settings subscription card, with clear in-place feedback and no change to backend entitlement authority.

**Architecture:** Keep restore orchestration in the existing `subscriptionStore.restorePurchases()` action. The Settings page will conditionally render an owner-only secondary action, using the existing RevenueCat configuration flag and store state; it will surface the store's localized status and error messages. Add a small DOM-based component-test setup because the repository currently tests services only and has no way to exercise a Vue page's conditional actions.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, vue-i18n, Vitest, `@vue/test-utils`, happy-dom.

## Global Constraints

- Preserve the existing backend-only, workspace-owner authorization boundary for restore requests.
- Reuse `subscriptionStore.restorePurchases()`; do not call RevenueCat or the backend directly from `SettingsPage.vue`.
- Do not add API endpoints, migrations, or runtime dependencies.
- Use existing translated copy: `common.restorePurchases`, `upgrade.billingUnavailable`, and the store-provided status/error messages.
- Keep the Settings page mobile-first with a minimum 44px touch target.
- Do not expose provider, token, or backend error details in the UI.

---

## File Structure

- `package.json` and `package-lock.json`: add only test-time Vue mounting dependencies.
- `vitest.config.ts`: register the Vue SFC transform so page tests compile `.vue` files.
- `src/pages/__tests__/SettingsPage.test.ts`: validate owner visibility, restore invocation, and disabled states.
- `src/pages/SettingsPage.vue`: add the computed billing-availability flag, owner-only restore action, and in-card feedback.
- `src/styles/main.css`: style the secondary action and feedback spacing while preserving the current subscription-card primary-button style.

### Task 1: Add a Vue page-test harness and Settings restore regression test

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vitest.config.ts`
- Create: `src/pages/__tests__/SettingsPage.test.ts`

**Interfaces:**

- Consumes: `SettingsPage.vue`, `useSubscriptionStore()`, `useWorkspaceStore()`, `appConfig.isRevenueCatEnabled`.
- Produces: automated regression coverage that mounts the Settings page and observes the restore control.

- [ ] **Step 1: Install the test-only Vue DOM dependencies**

Run:

```powershell
npm install -D @vue/test-utils happy-dom
```

Expected: `package.json` gains both packages under `devDependencies`, and only their resolved entries are added to `package-lock.json`.

- [ ] **Step 2: Enable Vue SFC transformation in Vitest**

In `vitest.config.ts`, import the Vite Vue plugin and register it while retaining the existing alias, Node default environment, globals setting, and include list:

```ts
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Write the failing Settings page tests**

Create `src/pages/__tests__/SettingsPage.test.ts` with the happy-dom file directive, mount `SettingsPage`, and mock page dependencies with mutable state. Keep the subscription mock shaped like the real store fields used by the template:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SettingsPage from '../SettingsPage.vue';

const state = vi.hoisted(() => ({
  role: 'owner' as 'owner' | 'adult_member' | 'viewer',
  revenueCatEnabled: true,
  restorePurchases: vi.fn(),
  subscription: {
    hasPremiumEntitlement: false,
    canManageSubscription: false,
    isManaging: false,
    isRestoring: false,
    statusMessage: '',
    errorMessage: '',
  },
}));

vi.mock('@/app/stores/subscription', () => ({
  useSubscriptionStore: () => ({
    ...state.subscription,
    restorePurchases: state.restorePurchases,
  }),
}));
vi.mock('@/app/stores/workspace', () => ({
  useWorkspaceStore: () => ({ currentUserRole: state.role }),
}));
vi.mock('@/shared/config/env', () => ({
  appConfig: {
    get isRevenueCatEnabled() {
      return state.revenueCatEnabled;
    },
    contactEmail: null,
  },
}));
```

Add these exact page-dependency mocks below the store mocks:

```ts
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }));
vi.mock('@/app/stores/auth', () => ({
  useAuthStore: () => ({ isAuthenticated: false, user: null }),
}));
vi.mock('@/app/stores/localization', () => ({
  useLocalizationStore: () => ({ locale: 'en', setLocale: vi.fn() }),
}));
vi.mock('@/app/stores/reminders', () => ({
  reminderDayOptions: [],
  useRemindersStore: () => ({ settings: { enabled: false } }),
}));
vi.mock('@/shared/composables/useFeatureAccess', () => ({
  useFeatureAccess: () => ({ canUseFeature: () => false }),
}));
vi.mock('@/shared/composables/useNotifications', () => ({
  useNotifications: () => ({
    disableReminders: vi.fn(),
    enableReminders: vi.fn(),
    isAvailable: { value: false },
    lastError: { value: '' },
    lastReminderResult: { value: null },
    permissionStatus: { value: 'unknown' },
    syncPermissionStatus: vi.fn(),
  }),
}));
```

After importing `SettingsPage`, define the mount helper and reset all mutable mock values before every test:

```ts
function mountSettingsPage() {
  return mount(SettingsPage, {
    shallow: true,
    global: {
      stubs: {
        HouseholdMembersSettings: true,
        BaseBottomSheet: true,
        UpgradePrompt: true,
        RouterLink: true,
      },
    },
  });
}

beforeEach(() => {
  state.role = 'owner';
  state.revenueCatEnabled = true;
  state.restorePurchases.mockReset();
  Object.assign(state.subscription, {
    hasPremiumEntitlement: false,
    canManageSubscription: false,
    isManaging: false,
    isRestoring: false,
    statusMessage: '',
    errorMessage: '',
  });
});
```

Add these assertions:

```ts
it('shows Restore purchases to an owner and invokes the store action', async () => {
  const wrapper = mountSettingsPage();

  await wrapper.get('[data-testid="restore-purchases"]').trigger('click');

  expect(state.restorePurchases).toHaveBeenCalledOnce();
});

it.each(['adult_member', 'viewer'] as const)(
  'does not show Restore purchases to %s',
  (role) => {
    state.role = role;

    expect(
      mountSettingsPage().find('[data-testid="restore-purchases"]').exists()
    ).toBe(false);
  }
);

it.each([
  ['a restore is already running', { isRestoring: true }, true],
  ['RevenueCat is not configured', {}, false],
] as const)(
  'disables Restore purchases when %s',
  (_, subscription, configured) => {
    Object.assign(state.subscription, subscription);
    state.revenueCatEnabled = configured;

    expect(
      mountSettingsPage()
        .get('[data-testid="restore-purchases"]')
        .attributes('disabled')
    ).toBeDefined();
  }
);

it('renders the store restore result inside the card for an owner', () => {
  state.subscription.statusMessage = 'upgrade.premiumRestored';
  state.subscription.errorMessage = 'upgrade.restoreFailed';

  const wrapper = mountSettingsPage();

  expect(wrapper.text()).toContain('upgrade.premiumRestored');
  expect(wrapper.text()).toContain('upgrade.restoreFailed');
});
```

- [ ] **Step 4: Run the new test to verify it fails before the UI is added**

Run:

```powershell
npm test -- src/pages/__tests__/SettingsPage.test.ts
```

Expected: FAIL because `SettingsPage.vue` does not yet render `[data-testid="restore-purchases"]`.

### Task 2: Add the owner-only restore action and visible feedback to Settings

**Files:**

- Modify: `src/pages/SettingsPage.vue:65-78,308-325`
- Modify: `src/styles/main.css:2268-2288`
- Test: `src/pages/__tests__/SettingsPage.test.ts`

**Interfaces:**

- Consumes: `canPurchasePremium(workspaceStore.currentUserRole)`, `appConfig.isRevenueCatEnabled`, and `subscriptionStore.restorePurchases(): Promise<boolean>`.
- Produces: an owner-only Settings control with `data-testid="restore-purchases"`, disabled when `subscriptionStore.isRestoring || !canRestorePurchases`.

- [ ] **Step 1: Add the billing-availability computed value**

In `SettingsPage.vue`, next to the existing `isWorkspaceOwner` computed value, add:

```ts
const canRestorePurchases = computed(() => appConfig.isRevenueCatEnabled);
```

Do not add a new restore handler: calling `subscriptionStore.restorePurchases()` from the template keeps the same action used by Upgrade and preserves its state transitions and safe error mapping.

- [ ] **Step 2: Render the action independently of the plan-specific primary action**

Keep the existing Manage subscription / Upgrade / owner-managed conditional block unchanged. Immediately after it, add this owner-only secondary control so both Free and Premium owners can restore:

```vue
<button
  v-if="isWorkspaceOwner"
  class="settings-subscription-card__secondary-action"
  type="button"
  data-testid="restore-purchases"
  :disabled="subscriptionStore.isRestoring || !canRestorePurchases"
  @click="subscriptionStore.restorePurchases()"
>
  {{ t('common.restorePurchases') }}
</button>
<p
  v-if="isWorkspaceOwner && subscriptionStore.statusMessage"
  class="meeting-status settings-subscription-card__feedback"
  role="status"
>
  {{ subscriptionStore.statusMessage }}
</p>
<p
  v-if="isWorkspaceOwner && subscriptionStore.errorMessage"
  class="meeting-error settings-subscription-card__feedback"
  role="alert"
>
  {{ subscriptionStore.errorMessage }}
</p>
```

The error paragraph must remain visible to the initiating owner and must use the store's already-sanitized message. Do not render either action or feedback conditionally based on the current Premium plan.

- [ ] **Step 3: Add compact mobile-safe secondary-action styling**

After the existing `.settings-subscription-card__button` rules in `src/styles/main.css`, add:

```css
.settings-subscription-card__secondary-action {
  width: 100%;
  min-height: var(--touch-target-min);
  border: 0;
  background: transparent;
  color: var(--color-primary);
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.settings-subscription-card__secondary-action:disabled {
  opacity: 0.55;
}

.settings-subscription-card__feedback {
  margin-top: 0;
  text-align: center;
}
```

This makes Restore purchases visually secondary to Upgrade or Manage subscription while retaining a 44px tap target.

- [ ] **Step 4: Run the focused page test and existing billing-policy test**

Run:

```powershell
npm test -- src/pages/__tests__/SettingsPage.test.ts src/features/access/premiumPurchasePolicy.test.ts
```

Expected: PASS. The existing policy test verifies that only the owner role can enter the Premium purchase path; the new page test verifies the Settings rendering and interaction boundary.

- [ ] **Step 5: Run full static and behavior verification**

Run:

```powershell
npm run build
npm run check
npm test
```

Expected: all commands exit with code 0.

- [ ] **Step 6: Perform a native Android smoke test**

On an Android build with RevenueCat configured, sign in as the workspace owner and verify all of the following:

1. Settings shows Restore purchases for both displayed Free and Premium plans.
2. Tapping it disables the control until completion and shows a localized success or no-purchase result in the card.
3. A simulated provider/backend failure shows the safe error text in the card with no provider response details.
4. An adult member and viewer do not see the control.
5. With RevenueCat configuration absent, an owner sees the disabled action and cannot start a restore.

- [ ] **Step 7: Stop for user review before committing**

Do not stage or commit automatically. Present the changed-file summary and verification results; create commits only from an explicitly approved numbered commit list.
