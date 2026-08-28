# Production Billing Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Premium billing fail closed on unverified store state, show only live store pricing and complete subscription terms, and document the exact production configuration and physical-device validation required for launch.

**Architecture:** The backend remains the workspace-scoped authority for Premium. Native RevenueCat purchase and restore actions must refresh the backend subscription record before the client treats Premium as active. Production environment validation prevents a partially configured RevenueCat backend, while the mobile client suppresses saleable plans when its native offering cannot supply a live price. A release runbook records the external console and device work that cannot be performed from the repositories.

**Tech Stack:** Vue 3, TypeScript, Pinia, vue-i18n, Capacitor, RevenueCat Capacitor SDK, Fastify, Zod, Vitest, npm.

## Global Constraints

- Use the workspace ID as the RevenueCat app-user ID; never accept it from a purchase or webhook request body.
- Only a backend-validated, recently checked workspace entitlement can unlock Premium features.
- Production requires non-empty `REVENUECAT_PROJECT_ID`, `REVENUECAT_API_KEY`, `REVENUECAT_ENTITLEMENT_ID`, and `REVENUECAT_WEBHOOK_SHARED_SECRET`; do not place any of these secret backend values in a Vite variable.
- Do not display a native purchase plan with a placeholder or stale price. Omit a plan when the current RevenueCat offering does not provide it with a price.
- Subscription copy must state the billed period, auto-renewal, and the store-management/cancellation path for the workspace owner.
- Preserve owner-only purchase, restore, and management behavior. Milestone 3’s broader cross-screen feedback redesign is not part of this work.
- Do not stage or commit changes: this project requires separate explicit user approval for Git writes.

---

## File Structure

- `D:\Projects\myself\weekly-us-api\src\config\env.ts` — validates that a production API cannot start with a partial RevenueCat backend configuration.
- `D:\Projects\myself\weekly-us-api\.env.example` — documents the complete production RevenueCat variable set and secret-handling expectations.
- `D:\Projects\myself\weekly-us-api\tests\env.test.ts` — proves the production configuration invariant.
- `D:\Projects\myself\weekly-us-api\tests\subscriptions.service.test.ts` — covers Premium revocation, grace, and stale-state regression behavior.
- `D:\Projects\myself\weekly-us-api\tests\revenuecat-webhook.routes.test.ts` — proves renewal, expiration, cancellation, and refund events target the correct workspace refresh path.
- `D:\Projects\myself\weekly-us\src\features\subscription\services\revenueCatSubscriptionProvider.ts` — exposes only live native-store plan prices and keeps entitlement activation backend-owned.
- `D:\Projects\myself\weekly-us\src\features\subscription\services\__tests__\revenueCatSubscriptionProvider.test.ts` — verifies native offering failure and post-purchase backend validation behavior.
- `D:\Projects\myself\weekly-us\src\pages\UpgradePage.vue` — displays the configured price with its billing period and the store-facing renewal/cancellation disclosure.
- `D:\Projects\myself\weekly-us\src\features\localization\messages.ts` — supplies localized billing-period and renewal/cancellation copy for English, Ukrainian, and Spanish.
- `D:\Projects\myself\weekly-us\src\pages\__tests__\UpgradePage.test.ts` — verifies the owner-facing Upgrade disclosure and unavailable-plan state.
- `D:\Projects\myself\weekly-us\docs\production-billing-validation.md` — is the release-owner runbook and evidence record for RevenueCat, Google Play, deployment, webhook, and physical Android validation.

### Task 1: Fail Fast for Partial Production RevenueCat Configuration

**Files:**

- Modify: `D:\Projects\myself\weekly-us-api\src\config\env.ts`
- Modify: `D:\Projects\myself\weekly-us-api\.env.example`
- Modify: `D:\Projects\myself\weekly-us-api\tests\env.test.ts`

**Interfaces:**

- Consumes: `NODE_ENV`, `APP_ENV`, and the four RevenueCat environment variables.
- Produces: an `env` module that starts a production API only when the complete RevenueCat backend configuration exists; development and test environments may still leave the integration disabled.

- [ ] **Step 1: Add failing production-environment cases**

  In `tests/env.test.ts`, add the following cases after the production SMTP tests. Reuse `loadEnv` and its `baseEnv`; supply the existing required SMTP and CORS fields in each fixture.

  ```ts
  it('rejects a production API with an incomplete RevenueCat configuration', async () => {
    await expect(
      loadEnv({
        NODE_ENV: 'production',
        APP_ENV: 'production',
        CORS_ALLOWED_ORIGINS: 'https://ourweekapp.com',
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'mailer@example.com',
        SMTP_PASSWORD: 'password',
        EMAIL_FROM: 'support@ourweekapp.com',
        INVITATION_HANDOFF_URL: 'https://ourweekapp.com/invite',
        REVENUECAT_PROJECT_ID: 'proj123',
        REVENUECAT_API_KEY: 'secret-key',
        REVENUECAT_ENTITLEMENT_ID: 'premium',
        REVENUECAT_WEBHOOK_SHARED_SECRET: '',
      })
    ).rejects.toThrow(
      'REVENUECAT_WEBHOOK_SHARED_SECRET is required in production'
    );
  });

  it('accepts a complete production RevenueCat configuration', async () => {
    const { env } = await loadEnv({
      NODE_ENV: 'production',
      APP_ENV: 'production',
      CORS_ALLOWED_ORIGINS: 'https://ourweekapp.com',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_USER: 'mailer@example.com',
      SMTP_PASSWORD: 'password',
      EMAIL_FROM: 'support@ourweekapp.com',
      INVITATION_HANDOFF_URL: 'https://ourweekapp.com/invite',
      REVENUECAT_PROJECT_ID: 'proj123',
      REVENUECAT_API_KEY: 'secret-key',
      REVENUECAT_ENTITLEMENT_ID: 'premium',
      REVENUECAT_WEBHOOK_SHARED_SECRET: 'webhook-secret',
    });

    expect(env.REVENUECAT_CONFIGURED).toBe(true);
  });
  ```

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `npm test -- --run tests/env.test.ts`

  Expected: the incomplete production configuration test fails because the current schema permits the missing webhook secret.

- [ ] **Step 3: Add the production configuration invariant**

  In the existing `superRefine` callback in `src/config/env.ts`, create a boolean named `isProduction` once from `NODE_ENV` and `APP_ENV`. Before the SMTP checks, add a loop that reports a Zod issue for each missing RevenueCat value when `isProduction` is true:

  ```ts
  const isProduction =
    value.NODE_ENV === 'production' || value.APP_ENV === 'production';

  if (isProduction) {
    for (const [field, fieldValue] of [
      ['REVENUECAT_PROJECT_ID', value.REVENUECAT_PROJECT_ID],
      ['REVENUECAT_API_KEY', value.REVENUECAT_API_KEY],
      ['REVENUECAT_ENTITLEMENT_ID', value.REVENUECAT_ENTITLEMENT_ID],
      [
        'REVENUECAT_WEBHOOK_SHARED_SECRET',
        value.REVENUECAT_WEBHOOK_SHARED_SECRET,
      ],
    ] as const) {
      if (!fieldValue) {
        context.addIssue({
          code: 'custom',
          path: [field],
          message: `${field} is required in production`,
        });
      }
    }
  }
  ```

  Reuse `isProduction` for the existing production CORS and SMTP branches to avoid duplicated environment predicates. Do not change the meaning of `REVENUECAT_CONFIGURED`: after validation it can remain `Boolean(value.REVENUECAT_API_KEY)`.

  In `.env.example`, replace the current optional RevenueCat comment with a production note stating that all four RevenueCat variables are required in production and that only the RevenueCat public SDK keys belong in the mobile app’s `VITE_` variables.

- [ ] **Step 4: Run focused and backend validation**

  Run: `npm test -- --run tests/env.test.ts && npm run typecheck`

  Expected: all environment tests and TypeScript checks pass.

- [ ] **Step 5: Review without committing**

  Run: `git -c safe.directory=D:/Projects/myself/weekly-us-api diff --check`

  Expected: no whitespace errors. Leave the diff unstaged.

### Task 2: Prove Entitlement Revocation and Webhook Workspace Safety

**Files:**

- Modify: `D:\Projects\myself\weekly-us-api\tests\subscriptions.service.test.ts`
- Modify: `D:\Projects\myself\weekly-us-api\tests\revenuecat-webhook.routes.test.ts`

**Interfaces:**

- Consumes: `SubscriptionService.getStatus(auth)`, `SubscriptionService.syncEntitlementForWorkspace(workspaceId)`, and the `POST /v1/webhooks/revenuecat` route.
- Produces: regression evidence that a refresh which no longer contains the Premium entitlement persists Free state for the current workspace, grace status is handled explicitly, and RevenueCat lifecycle events request a refresh for only their event workspace.

- [ ] **Step 1: Add failing service regression tests**

  In `tests/subscriptions.service.test.ts`, add a test whose repository starts with an active `google_play` Premium record but whose configured client resolves this customer payload:

  ```ts
  {
    request_date: now,
    subscriber: {
      original_app_user_id: 'workspace-1',
      entitlements: {},
    },
  }
  ```

  Call `await service.getStatus(auth)` and assert that the returned DTO has `planType: 'free'`, no Premium feature in `enabledFeatures`, and that the final upsert contains `workspaceId: 'workspace-1'`, `planType: 'free'`, and `status: 'not_found'`.

  Add a second test with an entitlement whose `expires_date` is `past` and whose `grace_period_expires_date` is `future`. Assert the persisted result is `planType: 'premium'`, `status: 'grace_period'`, and `expiresAt: future`; this prevents a valid grace period from being treated as a paid-feature bypass or an accidental early revocation.

- [ ] **Step 2: Run the focused service suite to verify the new test exercises the path**

  Run: `npm test -- --run tests/subscriptions.service.test.ts`

  Expected: PASS after confirming the current service already writes the live RevenueCat result, rather than relying on the old Premium record. If the no-entitlement case does not write Free state, make the smallest service change necessary in `syncRevenueCatEntitlement`; do not use request-auth `planType` as a fallback.

- [ ] **Step 3: Add webhook lifecycle event coverage**

  In `tests/revenuecat-webhook.routes.test.ts`, replace the single `body` fixture’s fixed event type with a helper:

  ```ts
  function webhookBody(type: string, appUserId = 'workspace-1') {
    return {
      api_version: '1.0',
      event: {
        id: `event-${type}`,
        type,
        store: 'PLAY_STORE',
        app_user_id: appUserId,
      },
    };
  }
  ```

  Add a parameterized test for `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, and `REFUND`. For each event, inject the body with the valid shared secret and assert `200`, `{ received: true }`, and one call to `syncEntitlementForWorkspace('workspace-1')`. Keep the existing transfer tests unchanged because transfers intentionally refresh both old and new workspace IDs.

- [ ] **Step 4: Run backend billing regression tests**

  Run: `npm test -- --run tests/subscriptions.service.test.ts tests/revenuecat-webhook.routes.test.ts tests/repository-helpers.test.ts`

  Expected: PASS, including stale-cache rejection, explicit effective-status rules, and all lifecycle webhook routes.

- [ ] **Step 5: Review without committing**

  Run: `git -c safe.directory=D:/Projects/myself/weekly-us-api diff --check`

  Expected: no whitespace errors. Leave the diff unstaged.

### Task 3: Fail Closed When Native Store Pricing Is Unavailable

**Files:**

- Modify: `D:\Projects\myself\weekly-us\src\features\subscription\services\revenueCatSubscriptionProvider.ts`
- Modify: `D:\Projects\myself\weekly-us\src\features\subscription\services\__tests__\revenueCatSubscriptionProvider.test.ts`

**Interfaces:**

- Consumes: `getCurrentOffering(): Promise<Offering | null>` and each `SubscriptionPlanOption`’s current-platform product ID.
- Produces: `getAvailablePlans(): Promise<SubscriptionPlanOption[]>` containing only plans found in the current native offering with a non-empty RevenueCat `priceString`; an unavailable offering produces `[]`, which keeps the Upgrade purchase action disabled.

- [ ] **Step 1: Replace the placeholder-price tests with failing fail-closed cases**

  In `revenueCatSubscriptionProvider.test.ts`, replace the assertion that expects a missing yearly package to retain `Price pending` with an assertion that the returned plans contain only the monthly option. Add these cases:

  ```ts
  it('returns no saleable plans when RevenueCat has no current offering', async () => {
    mockedGetCurrentOffering.mockResolvedValue(null);

    await expect(
      createRevenueCatSubscriptionProvider().getAvailablePlans()
    ).resolves.toEqual([]);
  });

  it('returns no saleable plans when the current offering cannot be loaded', async () => {
    mockedGetCurrentOffering.mockRejectedValue(
      new Error('network unavailable')
    );

    await expect(
      createRevenueCatSubscriptionProvider().getAvailablePlans()
    ).resolves.toEqual([]);
  });
  ```

  Keep the existing test proving live RevenueCat `priceString` values replace the configured product labels.

- [ ] **Step 2: Run the focused client test to verify it fails**

  Run: `npm test -- --run src/features/subscription/services/__tests__/revenueCatSubscriptionProvider.test.ts`

  Expected: FAIL because the current provider falls back to `premiumPlanOptions`, including `Price pending`.

- [ ] **Step 3: Return only live, priced native packages**

  Rewrite `getRevenueCatPlans()` in `revenueCatSubscriptionProvider.ts` so it returns `[]` when RevenueCat is unavailable, the current offering is `null`, or loading the offering throws. When an offering exists, create the result with `flatMap`:

  ```ts
  return premiumPlanOptions.flatMap((plan) => {
    const productId = getPlanProductId(plan);
    const matchingPackage = offering.availablePackages.find(
      (candidate) => candidate.product.identifier === productId
    );
    const priceLabel = matchingPackage?.product.priceString?.trim();

    return priceLabel ? [{ ...plan, priceLabel }] : [];
  });
  ```

  Retain the existing safe log in the `catch` branch. Do not change purchase, restore, or backend snapshot orchestration: a completed native purchase must continue to show a Free snapshot until the backend validates Premium.

- [ ] **Step 4: Run the client billing regression test**

  Run: `npm test -- --run src/features/subscription/services/__tests__/revenueCatSubscriptionProvider.test.ts`

  Expected: PASS, including the existing tests for cancellation, two backend synchronization attempts, and Free pending activation snapshots.

- [ ] **Step 5: Review without committing**

  Run: `git -c safe.directory=D:/Projects/myself/weekly-us diff --check`

  Expected: no whitespace errors. Leave the diff unstaged.

### Task 4: Complete the Upgrade Subscription Disclosure

**Files:**

- Modify: `D:\Projects\myself\weekly-us\src\pages\UpgradePage.vue`
- Modify: `D:\Projects\myself\weekly-us\src\features\localization\messages.ts`
- Create: `D:\Projects\myself\weekly-us\src\pages\__tests__\UpgradePage.test.ts`

**Interfaces:**

- Consumes: `SubscriptionPlanOption.priceLabel`, `SubscriptionPlanOption.cadence`, `subscriptionStore.availablePlans`, `subscriptionStore.isPurchasing`, and `appConfig.isRevenueCatEnabled`.
- Produces: an owner-facing Upgrade screen that renders a live price with a localized monthly or yearly billing period, states auto-renewal and Google Play/App Store management/cancellation, and disables the purchase action when no live plan is available.

- [ ] **Step 1: Create a failing DOM test for disclosure and unavailable offerings**

  Add `src/pages/__tests__/UpgradePage.test.ts`, following the existing `SettingsPage.test.ts` pattern: use `// @vitest-environment happy-dom`, mock `useI18n` as an identity function, mock `useSubscriptionStore`, `useWorkspaceStore`, and `appConfig`, then shallow-mount `UpgradePage` with `RouterLink` stubbed.

  Use this store fixture for the owner case:

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
  ],
  hasPremiumEntitlement: false,
  isPurchasing: false,
  isRestoring: false,
  isManaging: false,
  canManageSubscription: false,
  statusMessage: '',
  errorMessage: '',
  ```

  Assert that the rendered text contains `$4.99`, `upgrade.plans.monthlyBillingPeriod`, and `upgrade.billingNote`. In a second test set `availablePlans: []`; assert the primary purchase button is disabled and `upgrade.planUnavailable` is present.

- [ ] **Step 2: Run the new page test to verify it fails**

  Run: `npm test -- --run src/pages/__tests__/UpgradePage.test.ts`

  Expected: FAIL because no period key is rendered and the test file has not yet been created.

- [ ] **Step 3: Render the billing period and translated disclosures**

  In `UpgradePage.vue`, immediately after each `plan.priceLabel`, render one concise translated span whose key is based on `plan.cadence`:

  ```vue
  <span class="upgrade-plan-card__period">
    {{ t(`upgrade.plans.${plan.cadence}BillingPeriod`) }}
  </span>
  ```

  Keep `billingNote` directly beneath the primary action. Update it in `messages.ts` in every existing locale so it states all three facts: Premium activates only after backend validation, subscriptions renew automatically unless cancelled, and the workspace owner can manage or cancel through Google Play or the App Store. Add the two stable translation keys in every locale:

  ```ts
  monthlyBillingPeriod: 'per month',
  yearlyBillingPeriod: 'per year',
  ```

  Translate those keys and the expanded `billingNote` for Ukrainian and Spanish rather than leaving English fallback copy. Do not hardcode product prices, duration, store names, or legal terms in the component.

- [ ] **Step 4: Run page and localization-aware client tests**

  Run: `npm test -- --run src/pages/__tests__/UpgradePage.test.ts src/features/subscription/services/__tests__/revenueCatSubscriptionProvider.test.ts`

  Expected: PASS. The Upgrade page renders only the live plan data it receives, and the provider never supplies a placeholder price on a native sale surface.

- [ ] **Step 5: Review without committing**

  Run: `git -c safe.directory=D:/Projects/myself/weekly-us diff --check`

  Expected: no whitespace errors. Leave the diff unstaged.

### Task 5: Publish the Production Billing Operator Runbook

**Files:**

- Create: `D:\Projects\myself\weekly-us\docs\production-billing-validation.md`
- Modify: `D:\Projects\myself\weekly-us\docs\production-launch-milestones.md`

**Interfaces:**

- Consumes: the backend variables in `.env.example`, the native public variables in `.env.release.example`, Android package ID `com.ourweek.app`, entitlement ID `premium`, the `/v1/webhooks/revenuecat` route, and the actual configured Google Play product IDs.
- Produces: a release-owner checklist and evidence record that makes Milestone 2 completion auditable without storing credentials in Git.

- [ ] **Step 1: Create the runbook with required external setup instructions**

  Write `docs/production-billing-validation.md` with these sections and exact actions:

  1. **Preflight and secret boundaries** — state that Vite’s Android RevenueCat SDK key is public, while `REVENUECAT_API_KEY` and `REVENUECAT_WEBHOOK_SHARED_SECRET` are backend deployment secrets and must be stored only in the API host secret manager. Confirm the app package is `com.ourweek.app`.
  2. **Google Play Console** — create the monthly and annual subscriptions; assign product IDs exactly matching `VITE_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID` and `VITE_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID`; set price, billing period, regions, test license accounts, and internal testing track; activate products only after policy/price review.
  3. **RevenueCat** — add the Google Play app using `com.ourweek.app`; import/attach the two Play products; create entitlement `premium`; attach both products; configure one current offering whose identifiers match the app’s `VITE_REVENUECAT_CURRENT_OFFERING_ID`; set the Android public SDK key in the release build; configure the webhook URL as `<PUBLIC_API_BASE_URL without /v1>/v1/webhooks/revenuecat` and set its Authorization header to the exact backend webhook secret.
  4. **API deployment** — set `REVENUECAT_PROJECT_ID`, `REVENUECAT_API_KEY`, `REVENUECAT_ENTITLEMENT_ID=premium`, and `REVENUECAT_WEBHOOK_SHARED_SECRET`; deploy; verify `/health`; use a test event or sandbox purchase to verify the webhook returns HTTP 200 and never log the secret.
  5. **Release mobile build** — set `VITE_API_BASE_URL`, the Android public SDK key, offering ID, and two Google Play product IDs in `.env.release.local`; run `npm run cap:sync:prod`; build the signed AAB; upload it to the Play internal track.
  6. **Real-device scenarios** — give deterministic numbered steps and expected backend state for purchase, restore after reinstall, manage/cancel, renewal, expiration, refund, backend outage within and after the 24-hour trust window, and a non-owner attempt. Include the expected values of `planType`, `provider`, `status`, `expiresAt`, and feature access where those can be observed safely.
  7. **Evidence table** — include columns: scenario, Play test account, Android device/OS, app version/build, product ID, RevenueCat event ID, backend workspace ID, test date, expected result, observed result, pass/fail, and issue link. Do not enter live account email, receipts, tokens, API keys, or webhook secrets in the table.
  8. **Completion gate** — state that public paid Premium remains disabled until every scenario passes and the evidence table is complete.

- [ ] **Step 2: Link the milestone to the runbook**

  In `docs/production-launch-milestones.md`, add the relative runbook link immediately under Milestone 2’s implementation evidence section. Do not mark any unchecked external evidence item complete; the runbook is guidance and evidence storage, not proof of an external action.

- [ ] **Step 3: Verify the documentation is safe and complete**

  Run: `rg -n -i "(api[_-]?key|webhook.*secret|service.*role|receipt|token)\s*=\s*[^<[:space:]]+" docs/production-billing-validation.md`

  Expected: no credentials or example secret values appear. Review the evidence table and all eight required sections manually.

- [ ] **Step 4: Run full repository checks**

  Run in `D:\Projects\myself\weekly-us-api`: `npm run typecheck && npm test`

  Run in `D:\Projects\myself\weekly-us`: `npm test && npm run build && npm run check`

  Expected: all API tests, frontend tests, Vue type checks, Vite build, formatting, and lint checks pass.

- [ ] **Step 5: Final diff review without committing**

  Run:

  ```powershell
  git -c safe.directory=D:/Projects/myself/weekly-us-api -C D:/Projects/myself/weekly-us-api diff --check
  git -c safe.directory=D:/Projects/myself/weekly-us -C D:/Projects/myself/weekly-us diff --check
  ```

  Expected: no whitespace errors. Leave every file unstaged for user review.
