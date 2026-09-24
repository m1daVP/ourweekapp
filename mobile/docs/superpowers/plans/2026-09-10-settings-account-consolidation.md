# Settings Account Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Settings the sole surface for authenticated account controls while completely deleting the standalone account page and route.

**Architecture:** Extract the account-only state and UI from the page route into an authenticated `AccountSettingsSection` feature component rendered by `SettingsPage`. Leave the existing Settings subscription card as the only subscription implementation; the new section carries only account summary, sign-in, profile, account-data, deletion, and sign-out behavior. Remove route and navigation dependencies after the Settings composition is covered by tests.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, Vue Router, vue-i18n, Vitest, Vue Test Utils.

## Global Constraints

- Use Vue 3 `<script setup lang="ts">`, typed Composition API code, and existing i18n keys; do not introduce new dependencies.
- Preserve the existing account export, deletion, cleanup/retry, Google-link, and sign-out service contracts exactly.
- Keep billing actions in the existing Settings subscription card only; do not migrate the duplicate AccountPage subscription UI.
- Keep all account controls mobile-first, semantic, and accessible; keep deletion visibly destructive and confirmation-gated.
- The removed `/settings/account` URL must have no route or redirect, and no source navigation may reference `name: 'account'`.
- Do not commit unless the user explicitly requests a commit.

---

### Task 1: Create the Settings-embedded account section

**Files:**

- Create: `src/features/auth/components/AccountSettingsSection.vue`
- Create: `src/features/auth/components/__tests__/AccountSettingsSection.test.ts`
- Delete after behavior is migrated: `src/pages/AccountPage.vue`
- Delete after behavior is migrated: `src/pages/__tests__/AccountPage.test.ts`

**Interfaces:**

- Consumes: `useAuthStore()`, `useSubscriptionStore()`, `useWorkspaceStore()`, `useRouter()`, `useI18n()`, account deletion lifecycle services, export service, haptics service, and `ConfirmationDialog`.
- Produces: default Vue component `AccountSettingsSection`, which renders no output when `authStore.user` is absent and otherwise owns all former AccountPage non-subscription controls.

- [ ] **Step 1: Write failing tests for the reusable account section**

  Copy the AccountPage mocks into `src/features/auth/components/__tests__/AccountSettingsSection.test.ts`, change the import and mount helper to target `AccountSettingsSection`, and retain the behavior assertions below:

  ```ts
  import AccountSettingsSection from '../AccountSettingsSection.vue';

  it('links Google for a password-only user', async () => {
    const wrapper = mountAccountSettingsSection();
    await wrapper.get('[data-testid="link-google-account"]').trigger('click');
    expect(state.linkGoogleAccount).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain('account.googleLinked');
  });

  it('does not render account controls when signed out', () => {
    state.user = null;
    expect(mountAccountSettingsSection().html()).toBe('');
  });

  it('keeps the online deletion fallback and the in-app delete action', () => {
    const wrapper = mountAccountSettingsSection();
    expect(
      wrapper.get('[data-testid="external-delete-account"]').attributes('href')
    ).toBe('https://ourweekapp.com/delete-account');
    expect(wrapper.find('button.history-item__delete').exists()).toBe(true);
  });
  ```

- [ ] **Step 2: Run the new section test to verify it fails**

  Run: `npx vitest run src/features/auth/components/__tests__/AccountSettingsSection.test.ts`

  Expected: FAIL because `AccountSettingsSection.vue` does not exist.

- [ ] **Step 3: Implement only the account-specific section**

  Move AccountPage’s account state and methods into `AccountSettingsSection.vue`: `displayName`, profile save feedback, Google-link feedback, account export, deletion confirmation, deletion cleanup/retry state, and deletion dependencies. Keep the cleanup path calling the same collaborators in the same order:

  ```ts
  await deleteAccountAndClearLocalData({
    deleteBackendAccount: deleteAccountRequest,
    clearSession: () => authStore.clearSessionAfterUnauthorized(),
    cancelLocalReminders: cancelLocalRemindersAfterAccountDeletion,
    clearLocalAppData: clearAllLocalAppDataAfterAccountDeletion,
    resetInMemoryStores: resetInMemoryStoresAfterAccountDeletion,
  });
  await router.replace({ name: 'welcome' });
  ```

  Render the component with the existing Settings redesign primitives: an Account heading, account-summary card, sign-in methods and Google-link action, profile form, data-rights card, sign-out RouterLink, and `ConfirmationDialog`. Do not import or render `PremiumBadge`, `canPurchasePremium`, RevenueCat configuration, plan-renewal details, restore purchases, or the old AccountPage subscription card.

  In its recovery branch, render the current cleanup-failure title, explanation, retry action, continue action, and error output inside the Account section rather than replacing the whole Settings route.

- [ ] **Step 4: Run the migrated behavioral tests**

  Run: `npx vitest run src/features/auth/components/__tests__/AccountSettingsSection.test.ts`

  Expected: PASS, including Google linking, connected-Google state, public fallback link, profile/export/deletion feedback, and cleanup recovery coverage that was migrated from `AccountPage.test.ts`.

- [ ] **Step 5: Remove the retired standalone component and its redundant test**

  Delete `src/pages/AccountPage.vue` and `src/pages/__tests__/AccountPage.test.ts` only after the feature-level test covers every retained account behavior. Do not commit without explicit user approval.

### Task 2: Compose the account section into the main Settings page without duplicate controls

**Files:**

- Modify: `src/pages/SettingsPage.vue: imports, account footer, and section ordering`
- Modify: `src/pages/__tests__/SettingsPage.test.ts: Settings composition assertions`
- Modify only if selectors need a focused mobile layout: `src/styles/main.css: settings account-footer selectors`

**Interfaces:**

- Consumes: default `AccountSettingsSection` from `@/features/auth/components/AccountSettingsSection.vue`.
- Produces: a single Settings page that renders one Subscription section and one authenticated Account section; no link to a separate account route.

- [ ] **Step 1: Add failing Settings composition tests**

  Extend SettingsPage test stubs and assertions so the page must render the embedded section for an authenticated store and must not render an account-route link:

  ```ts
  vi.mock('@/features/auth/components/AccountSettingsSection.vue', () => ({
    default: { name: 'AccountSettingsSection' },
  }));

  it('embeds account settings instead of linking to an account route', () => {
    const wrapper = mountSettingsPage();
    expect(
      wrapper.findComponent({ name: 'AccountSettingsSection' }).exists()
    ).toBe(true);
    expect(wrapper.find('[data-testid="settings-account-link"]').exists()).toBe(
      false
    );
  });
  ```

- [ ] **Step 2: Run the Settings test to verify it fails**

  Run: `npx vitest run src/pages/__tests__/SettingsPage.test.ts`

  Expected: FAIL because SettingsPage does not yet import or render `AccountSettingsSection`.

- [ ] **Step 3: Replace the footer account teaser with the embedded section**

  Import and render `<AccountSettingsSection />` immediately after the existing Subscription section and before Support & legal. Keep the existing Subscription markup, including Upgrade, Manage subscription, Restore purchases, and feedback, unchanged.

  Remove `accountStatusText` and the account teaser RouterLink from the footer. Keep the app version in the footer, but remove the footer’s duplicated sign-out link because sign-out now lives exclusively in `AccountSettingsSection`.

  Use existing `.settings-redesign-section`, `.settings-redesign-card`, `.account-summary`, and button styles first. If styles are needed to preserve mobile spacing, add narrowly-scoped `.settings-account-section` rules and delete obsolete `.settings-account-link` / `.settings-sign-out-link` rules in the same change.

- [ ] **Step 4: Run Settings tests to verify composition and billing behavior**

  Run: `npx vitest run src/pages/__tests__/SettingsPage.test.ts`

  Expected: PASS. Existing billing tests still prove one Settings subscription card owns restore/manage behavior, while the new assertion proves no account-route teaser remains.

- [ ] **Step 5: Check rendered-page duplication manually**

  Run: `npm run dev`

  Verify in a mobile viewport that Settings displays Account after Subscription, offers sign-out exactly once, presents Restore/Manage purchase actions only in Subscription, and keeps account deletion below the normal account actions. Stop the local server after the check; do not commit without explicit user approval.

### Task 3: Remove route and navigation remnants

**Files:**

- Modify: `src/app/router/index.ts: remove AccountPage import and account route`
- Modify: `src/pages/LogoutConfirmationPage.vue: change Keep signed in destination`
- Modify: `src/shared/components/AppShell.vue: remove unused account route-title mapping`
- Modify: `src/app/router/__tests__/legacySettingsRoutes.test.ts: preserve only workspace legacy-route expectation`

**Interfaces:**

- Consumes: Router’s existing named `settings` route.
- Produces: no router record, import, route-title mapping, or navigation link for an `account` route; logout cancellation returns to Settings.

- [ ] **Step 1: Add a failing router assertion that the account route is absent**

  Add a router-level test (or extend the closest router test) that imports `router` and asserts:

  ```ts
  expect(router.getRoutes().some((route) => route.name === 'account')).toBe(
    false
  );
  expect(router.resolve('/settings/account').matched).toHaveLength(0);
  ```

- [ ] **Step 2: Run the route assertion to verify it fails**

  Run: `npx vitest run src/app/router/__tests__/legacySettingsRoutes.test.ts`

  Expected: FAIL while the `account` route remains registered. If router guards make this test unsuitable, create `src/app/router/__tests__/index.test.ts` for the same two direct assertions.

- [ ] **Step 3: Delete every account-route dependency**

  Remove the `AccountPage` import and the `/settings/account` route record from `src/app/router/index.ts`. Change LogoutConfirmationPage’s Keep signed in RouterLink to `{ name: 'settings' }`. Delete AppShell’s `account` entry from `titles`. Do not add an entry to `legacySettingsRoutes`; `/settings/account` must not redirect.

- [ ] **Step 4: Run routing and logout-focused tests**

  Run: `npx vitest run src/app/router/__tests__/legacySettingsRoutes.test.ts src/pages/__tests__/LogoutConfirmationPage.test.ts`

  Expected: PASS. The route test proves the retired URL has no match, and the logout test proves cancellation returns to Settings. If `LogoutConfirmationPage.test.ts` does not exist, create it with a RouterLink stub and assert its `to` prop is `{ name: 'settings' }`.

- [ ] **Step 5: Search for retired page and route identifiers**

  Run: `rg -n "AccountPage|name: 'account'|/settings/account|\{ name: 'account' \}" src`

  Expected: no results. Do not commit without explicit user approval.

### Task 4: Run the complete validation suite

**Files:**

- Verify only: `src/features/auth/components/AccountSettingsSection.vue`, `src/pages/SettingsPage.vue`, `src/app/router/index.ts`, and their tests

**Interfaces:**

- Consumes: completed account section, Settings composition, and cleaned router.
- Produces: verified build, formatting, linting, page behavior, and route removal.

- [ ] **Step 1: Run focused tests together**

  Run: `npx vitest run src/features/auth/components/__tests__/AccountSettingsSection.test.ts src/pages/__tests__/SettingsPage.test.ts src/app/router/__tests__/legacySettingsRoutes.test.ts src/pages/__tests__/LogoutConfirmationPage.test.ts`

  Expected: PASS.

- [ ] **Step 2: Run production type/build validation**

  Run: `npm run build`

  Expected: Vue type checking and Vite production build complete without errors.

- [ ] **Step 3: Run formatting and lint validation**

  Run: `npm run check`

  Expected: Prettier check and ESLint complete without errors.

- [ ] **Step 4: Review the final working tree**

  Run: `git diff -- src/features/auth/components/AccountSettingsSection.vue src/pages/SettingsPage.vue src/app/router/index.ts src/pages/LogoutConfirmationPage.vue src/shared/components/AppShell.vue src/styles/main.css`

  Expected: the diff contains the account section migration and all route/link removals, with no subscription UI duplicated into the new section. Do not commit unless the user explicitly requests it.

## Plan Self-Review

- Spec coverage: Task 1 preserves each account action and cleanup behavior; Task 2 embeds it in the requested place without duplicate subscription or sign-out controls; Task 3 fully removes page, link, route, and stale route title; Task 4 validates behavior and build quality.
- Placeholder scan: no deferred requirements or unspecified implementation choices remain. The router-test file fallback is explicit because the current legacy-route test does not instantiate the router.
- Type consistency: `AccountSettingsSection` is the same default component imported by Settings and referenced in its test; the retained router destination is consistently the existing `settings` named route.
