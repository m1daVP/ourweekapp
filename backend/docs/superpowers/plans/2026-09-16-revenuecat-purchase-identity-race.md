# RevenueCat Purchase Identity Race Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with a test-first cycle and review each task before continuing. Do not create Git commits unless the user separately approves an exact commit list.

**Goal:** Prevent Android purchases from running under an anonymous RevenueCat customer and prevent anonymous RevenueCat webhook IDs from reaching UUID database queries.

**Architecture:** The mobile RevenueCat service retains the current workspace-identity transition and makes every customer-specific billing operation await it, while authentication remains non-blocking. The API validates provider identities at the webhook boundary, acknowledges unusable anonymous IDs, and syncs only valid workspace UUIDs.

**Tech Stack:** Vue 3, Pinia, Capacitor 8, `@revenuecat/purchases-capacitor` 13.4.2, Fastify 5, TypeScript, Zod 4, Vitest 4, Supabase/PostgreSQL.

## Global Constraints

- The trusted backend entitlement remains the only source that unlocks Premium.
- Authentication must not wait for RevenueCat availability.
- Do not map anonymous RevenueCat identifiers to workspaces.
- Do not log full anonymous RevenueCat IDs, receipts, tokens, or authorization headers.
- Do not add dependencies or a database migration.
- Do not stage or commit changes without separate user authorization.
- Deploy the API guard before releasing the updated Android client.

## File Map

### Mobile repository: `D:/Projects/myself/weekly-us`

- Modify `src/features/subscription/services/revenueCatService.ts`: own and serialize RevenueCat identity transitions; gate customer-specific SDK calls.
- Create `src/features/subscription/services/__tests__/revenueCatService.test.ts`: directly test identity/purchase concurrency, failure, restore, refresh, and logout/session replacement.
- Keep `src/app/stores/auth.ts` behavior unchanged: it starts identity sync without blocking authentication.
- Keep `src/features/subscription/services/revenueCatSubscriptionProvider.ts` behavior unchanged: it continues backend validation after purchase/restore.

### API repository: `D:/Projects/myself/weekly-us-api`

- Modify `src/modules/billing/revenuecat-webhook.schema.ts`: export the UUID schema used to classify workspace identities.
- Modify `src/modules/billing/revenuecat-webhook.routes.ts`: classify webhook identities before service/database access and redact provider identifiers from logs.
- Modify `tests/revenuecat-webhook.routes.test.ts`: use UUID fixtures and cover invalid regular and transfer identities.

---

### Task 1: Gate customer-specific RevenueCat SDK operations on workspace identity

**Files:**

- Create: `D:/Projects/myself/weekly-us/src/features/subscription/services/__tests__/revenueCatService.test.ts`
- Modify: `D:/Projects/myself/weekly-us/src/features/subscription/services/revenueCatService.ts`

**Interfaces:**

- Preserve: `configureRevenueCat(appUserID?: string | null): Promise<void>`
- Preserve: `logInRevenueCat(appUserID: string): Promise<void>`
- Preserve: `logOutRevenueCat(): Promise<void>`
- Add internal state: `let identityTransition: Promise<void> | null`
- Add internal helper: `requireRevenueCatIdentity(): Promise<void>`
- Gate existing exports: `getRevenueCatCustomerInfo`, `purchasePackage`, `restoreRevenueCatPurchases`, `presentPremiumPaywall`, and `presentRevenueCatCustomerCenter`
- Do not gate `getCurrentOffering` or `findPackageByProductId`; catalog reads are not customer mutations, and `purchasePackage` is the enforcement point.

- [ ] **Step 1: Create SDK-level test mocks and a deferred-promise helper**

Create `revenueCatService.test.ts` with hoisted mocks so each test can dynamically import a fresh service module:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configure: vi.fn(),
  getCustomerInfo: vi.fn(),
  logIn: vi.fn(),
  logOut: vi.fn(),
  presentCustomerCenter: vi.fn(),
  presentPaywallIfNeeded: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
  setLogLevel: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'android',
    isNativePlatform: () => true,
  },
}));

vi.mock('@revenuecat/purchases-capacitor', () => ({
  LOG_LEVEL: { DEBUG: 'DEBUG', INFO: 'INFO' },
  PAYWALL_RESULT: { PURCHASED: 'PURCHASED', RESTORED: 'RESTORED' },
  Purchases: {
    configure: mocks.configure,
    getCustomerInfo: mocks.getCustomerInfo,
    logIn: mocks.logIn,
    logOut: mocks.logOut,
    purchasePackage: mocks.purchasePackage,
    restorePurchases: mocks.restorePurchases,
    setLogLevel: mocks.setLogLevel,
  },
}));

vi.mock('@revenuecat/purchases-capacitor-ui', () => ({
  RevenueCatUI: {
    presentCustomerCenter: mocks.presentCustomerCenter,
    presentPaywallIfNeeded: mocks.presentPaywallIfNeeded,
  },
}));

vi.mock('@/shared/config/env', () => ({
  appConfig: {
    revenueCatAndroidApiKey: 'android-public-key',
    revenueCatIosApiKey: '',
    revenueCatEntitlementId: 'OurWeek Premium',
  },
}));

vi.mock('@/features/localization/i18n', () => ({
  translate: (key: string) => key,
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

async function loadService() {
  return import('@/features/subscription/services/revenueCatService');
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.configure.mockResolvedValue(undefined);
  mocks.setLogLevel.mockResolvedValue(undefined);
});
```

- [ ] **Step 2: Write failing tests for the pending and failed identity gate**

Add tests proving a purchase cannot overtake workspace login:

```ts
it('waits for workspace login before purchasing', async () => {
  const login = deferred<void>();
  mocks.logIn.mockReturnValue(login.promise);
  mocks.purchasePackage.mockResolvedValue({});
  const service = await loadService();

  const identity = service.logInRevenueCat(
    '11111111-1111-4111-8111-111111111111'
  );
  await vi.waitFor(() => expect(mocks.logIn).toHaveBeenCalledOnce());

  const purchase = service.purchasePackage({ product: { identifier: 'yearly' } } as never);
  await Promise.resolve();
  expect(mocks.purchasePackage).not.toHaveBeenCalled();

  login.resolve();
  await identity;
  await purchase;
  expect(mocks.purchasePackage).toHaveBeenCalledOnce();
});

it('does not purchase when workspace login fails', async () => {
  mocks.logIn.mockRejectedValue(new Error('identity unavailable'));
  const service = await loadService();
  const identity = service.logInRevenueCat(
    '11111111-1111-4111-8111-111111111111'
  );

  await expect(identity).rejects.toThrow('identity unavailable');
  await expect(
    service.purchasePackage({ product: { identifier: 'yearly' } } as never)
  ).rejects.toThrow('identity unavailable');
  expect(mocks.purchasePackage).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Write failing tests for every customer-specific operation**

Start a pending login, call restore, customer-info refresh, paywall, and customer center, then assert none reaches the SDK until login resolves. After resolution, await all calls and assert each SDK method ran once:

```ts
it('gates restore, customer info, paywall, and customer center', async () => {
  const login = deferred<void>();
  mocks.logIn.mockReturnValue(login.promise);
  mocks.restorePurchases.mockResolvedValue({});
  mocks.getCustomerInfo.mockResolvedValue({ customerInfo: {} });
  mocks.presentPaywallIfNeeded.mockResolvedValue({ result: 'PURCHASED' });
  mocks.presentCustomerCenter.mockResolvedValue(undefined);
  const service = await loadService();

  const identity = service.logInRevenueCat(
    '11111111-1111-4111-8111-111111111111'
  );
  await vi.waitFor(() => expect(mocks.logIn).toHaveBeenCalledOnce());

  const operations = [
    service.restoreRevenueCatPurchases(),
    service.getRevenueCatCustomerInfo(),
    service.presentPremiumPaywall(),
    service.presentRevenueCatCustomerCenter(),
  ];
  await Promise.resolve();
  expect(mocks.restorePurchases).not.toHaveBeenCalled();
  expect(mocks.getCustomerInfo).not.toHaveBeenCalled();
  expect(mocks.presentPaywallIfNeeded).not.toHaveBeenCalled();
  expect(mocks.presentCustomerCenter).not.toHaveBeenCalled();

  login.resolve();
  await identity;
  await Promise.all(operations);
  expect(mocks.restorePurchases).toHaveBeenCalledOnce();
  expect(mocks.getCustomerInfo).toHaveBeenCalledOnce();
  expect(mocks.presentPaywallIfNeeded).toHaveBeenCalledOnce();
  expect(mocks.presentCustomerCenter).toHaveBeenCalledOnce();
});
```

- [ ] **Step 4: Write a failing session-replacement test**

Prove identity transitions are serialized and a completed logout cannot clear a newer login gate:

```ts
it('waits for the newest workspace identity across logout and login', async () => {
  const logout = deferred<void>();
  const secondLogin = deferred<void>();
  mocks.logIn
    .mockResolvedValueOnce(undefined)
    .mockReturnValueOnce(secondLogin.promise);
  mocks.logOut.mockReturnValue(logout.promise);
  mocks.purchasePackage.mockResolvedValue({});
  const service = await loadService();

  await service.logInRevenueCat('11111111-1111-4111-8111-111111111111');
  const logoutOperation = service.logOutRevenueCat();
  const nextIdentity = service.logInRevenueCat(
    '22222222-2222-4222-8222-222222222222'
  );
  const purchase = service.purchasePackage({ product: { identifier: 'yearly' } } as never);

  logout.resolve();
  await logoutOperation;
  await vi.waitFor(() => expect(mocks.logIn).toHaveBeenCalledTimes(2));
  expect(mocks.purchasePackage).not.toHaveBeenCalled();

  secondLogin.resolve();
  await nextIdentity;
  await purchase;
  expect(mocks.purchasePackage).toHaveBeenCalledOnce();
});
```

- [ ] **Step 5: Run the new test file and verify the identity tests fail**

Run from `D:/Projects/myself/weekly-us`:

```powershell
npx vitest run src/features/subscription/services/__tests__/revenueCatService.test.ts
```

Expected: the SDK billing methods run before the deferred login resolves, or no identity-gate implementation exists.

- [ ] **Step 6: Implement serialized identity transitions**

In `revenueCatService.ts`, add module state and helpers near `configurePromise`:

```ts
let identityTransition: Promise<void> | null = null;

function previousIdentityTransition() {
  return identityTransition?.catch(() => undefined) ?? Promise.resolve();
}

async function requireRevenueCatIdentity() {
  if (!identityTransition) {
    throw new Error(translate('upgrade.billingUnavailable'));
  }

  await identityTransition;
}
```

Replace login with an immediately registered, serialized transition:

```ts
export function logInRevenueCat(appUserID: string) {
  if (!isRevenueCatAvailable()) {
    return Promise.resolve();
  }

  const operation = previousIdentityTransition().then(async () => {
    await configureRevenueCat();
    await Purchases.logIn({ appUserID });
  });
  identityTransition = operation;
  return operation;
}
```

Replace logout with a serialized transition that clears only itself, never a newer login:

```ts
export async function logOutRevenueCat() {
  if (!isRevenueCatAvailable()) {
    return;
  }

  const operation = previousIdentityTransition().then(async () => {
    await configureRevenueCat();
    await Purchases.logOut();
  });
  identityTransition = operation;

  try {
    await operation;
  } finally {
    if (identityTransition === operation) {
      identityTransition = null;
    }
  }
}
```

- [ ] **Step 7: Gate each customer-specific method**

After `assertRevenueCatAvailable()` and before its RevenueCat SDK call, make each of these methods execute `await requireRevenueCatIdentity()`:

```ts
export async function getRevenueCatCustomerInfo() {
  assertRevenueCatAvailable();
  await requireRevenueCatIdentity();
  return Purchases.getCustomerInfo();
}
```

Apply the same ordering to `purchasePackage`, `restoreRevenueCatPurchases`, `presentPremiumPaywall`, and `presentRevenueCatCustomerCenter`. Remove their redundant `await configureRevenueCat()` calls because successful workspace login already includes configuration. Leave `getCurrentOffering` using `configureRevenueCat()` so plans can load before identity synchronization completes.

- [ ] **Step 8: Run focused mobile billing/auth tests**

Run:

```powershell
npx vitest run src/features/subscription/services/__tests__/revenueCatService.test.ts src/features/subscription/services/__tests__/revenueCatSubscriptionProvider.test.ts src/app/stores/__tests__/authRevenueCatIdentity.test.ts
```

Expected: all tests pass, including the existing proof that authentication does not wait for RevenueCat login.

- [ ] **Step 9: Run mobile static checks**

Run:

```powershell
npm run typecheck
npm run lint -- --no-fix
```

Expected: both commands exit successfully and do not modify files.

- [ ] **Step 10: Review Task 1 without committing**

Run `git -c safe.directory=D:/Projects/myself/weekly-us diff --check` and inspect the focused diff. Do not stage or commit.

---

### Task 2: Reject unusable RevenueCat identities at the API boundary

**Files:**

- Modify: `src/modules/billing/revenuecat-webhook.schema.ts`
- Modify: `src/modules/billing/revenuecat-webhook.routes.ts`
- Modify: `tests/revenuecat-webhook.routes.test.ts`

**Interfaces:**

- Add export: `revenueCatWorkspaceIdSchema: z.ZodUUID`
- Add internal helper: `isWorkspaceId(value: string): boolean`
- Add internal helper: `identityCategory(value: string): 'anonymous' | 'invalid'`
- Preserve response contract: `{ received: true }`
- Preserve `WebhookSubscriptionService.syncEntitlementForWorkspace(workspaceId: string)` for validated UUIDs only.

- [ ] **Step 1: Replace non-UUID workspace fixtures with valid UUIDs**

At the top of `tests/revenuecat-webhook.routes.test.ts`, define stable identifiers:

```ts
const workspaceId = '11111111-1111-4111-8111-111111111111';
const secondWorkspaceId = '22222222-2222-4222-8222-222222222222';
const unknownWorkspaceId = '33333333-3333-4333-8333-333333333333';
```

Use these values in the default webhook body, `webhookBody`, normal sync expectations, unknown-workspace cases, and transfer cases. This keeps existing success tests valid once the route enforces UUID identity.

- [ ] **Step 2: Write a failing non-transfer anonymous-identity test**

```ts
it('acknowledges an anonymous app user without syncing it', async () => {
  const service = serviceThat();
  const app = await buildApp({ service });
  const response = await app.inject({
    method: 'POST',
    url: '/revenuecat',
    headers: { authorization: secret },
    payload: webhookBody('INITIAL_PURCHASE', '$RCAnonymousID:anonymous-1'),
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ received: true });
  expect(service.syncEntitlementForWorkspace).not.toHaveBeenCalled();
  await app.close();
});
```

- [ ] **Step 3: Write a failing mixed-transfer test**

Replace the existing free-form transfer IDs with a case containing anonymous, invalid, duplicated, and valid identities:

```ts
it('skips unusable transfer identities and syncs deduplicated workspace UUIDs', async () => {
  const service = serviceThat();
  const app = await buildApp({ service });
  const response = await app.inject({
    method: 'POST',
    url: '/revenuecat',
    headers: { authorization: secret },
    payload: {
      event: {
        id: 'event-transfer',
        type: 'TRANSFER',
        transferred_from: ['$RCAnonymousID:old', workspaceId],
        transferred_to: [secondWorkspaceId, 'not-a-workspace', workspaceId],
      },
    },
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ received: true });
  expect(service.syncEntitlementForWorkspace.mock.calls).toEqual([
    [secondWorkspaceId],
    [workspaceId],
  ]);
  await app.close();
});
```

- [ ] **Step 4: Run the webhook tests and verify the new cases fail**

Run from `D:/Projects/myself/weekly-us-api`:

```powershell
npx vitest run tests/revenuecat-webhook.routes.test.ts
```

Expected: the anonymous case calls the service, while the transfer case attempts to sync invalid identifiers.

- [ ] **Step 5: Export the workspace UUID schema**

In `revenuecat-webhook.schema.ts`, add:

```ts
export const revenueCatWorkspaceIdSchema = z.uuid();
```

Do not apply this schema directly to `app_user_id`; invalid provider identities must reach the handler so the endpoint can acknowledge them with HTTP 200 instead of returning a retryable/provider-visible validation error.

- [ ] **Step 6: Add route identity classification helpers**

Import `revenueCatWorkspaceIdSchema` and add:

```ts
function isWorkspaceId(value: string) {
  return revenueCatWorkspaceIdSchema.safeParse(value).success;
}

function identityCategory(value: string): 'anonymous' | 'invalid' {
  return value.startsWith('$RCAnonymousID:') ? 'anonymous' : 'invalid';
}
```

- [ ] **Step 7: Redact provider identities from receipt logging**

Change the initial webhook receipt log to omit `appUserId`:

```ts
request.log.info(
  { eventId: event.id, eventType: event.type },
  'RevenueCat webhook received',
);
```

Change transfer receipt logging to counts rather than raw arrays:

```ts
request.log.info(
  {
    transferredFromCount: event.transferred_from?.length ?? 0,
    transferredToCount: event.transferred_to?.length ?? 0,
  },
  'RevenueCat transfer received',
);
```

- [ ] **Step 8: Skip invalid transfer identities while preserving valid work**

Before the existing `try` block inside the deduplicated transfer loop, add:

```ts
if (!isWorkspaceId(workspaceId)) {
  request.log.warn(
    {
      eventId: event.id,
      eventType: event.type,
      identityCategory: identityCategory(workspaceId),
    },
    'RevenueCat webhook identity is not a workspace UUID',
  );
  continue;
}
```

Keep the existing provider 404, provider outage, and unknown-workspace handling unchanged for valid UUIDs.

- [ ] **Step 9: Acknowledge an invalid non-transfer identity**

After the existing missing-`app_user_id` check and before the service call, add:

```ts
if (!isWorkspaceId(event.app_user_id)) {
  request.log.warn(
    {
      eventId: event.id,
      eventType: event.type,
      identityCategory: identityCategory(event.app_user_id),
    },
    'RevenueCat webhook identity is not a workspace UUID',
  );
  return { received: true as const };
}
```

Do not send the raw identifier to logs or error details.

- [ ] **Step 10: Run focused API tests**

Run:

```powershell
npx vitest run tests/revenuecat-webhook.routes.test.ts tests/subscriptions.service.test.ts
```

Expected: both test files pass; valid UUID behavior and all existing error mappings remain intact.

- [ ] **Step 11: Run the full API verification suite**

Run:

```powershell
npm run typecheck
npm test
npm run build
```

Expected: typecheck, all Vitest tests, and the production build pass.

- [ ] **Step 12: Review Task 2 without committing**

Run `git -c safe.directory=D:/Projects/myself/weekly-us-api diff --check` and inspect the focused diff. Do not stage or commit.

---

### Task 3: Cross-repository regression verification and recovery handoff

**Files:**

- Verify only; no additional source files should be modified.

**Interfaces:**

- Mobile identity contract: customer-specific RevenueCat calls occur only after `logInRevenueCat(workspaceId)` resolves.
- Webhook contract: only UUID workspace identities reach `syncEntitlementForWorkspace`.
- Recovery contract: Restore Purchases logs into the workspace, restores at RevenueCat, then calls authenticated backend validation.

- [ ] **Step 1: Run the complete mobile test suite**

From `D:/Projects/myself/weekly-us`:

```powershell
npm test
```

Expected: all unit and contract tests pass.

- [ ] **Step 2: Run final non-mutating repository checks**

Run in each repository:

```powershell
git -c safe.directory=D:/Projects/myself/weekly-us diff --check
git -c safe.directory=D:/Projects/myself/weekly-us-api diff --check
```

Confirm no generated Android/iOS files, lockfiles, migrations, or unrelated files changed.

- [ ] **Step 3: Manually verify the original Android race after deployment**

Deploy the API first, then install the client build. Sign in as an owner, delay RevenueCat login using network throttling or a debug breakpoint, start the yearly sandbox purchase, and navigate to History before Play completes. Verify:

```text
1. Purchases.purchasePackage is not invoked before Purchases.logIn resolves.
2. RevenueCat app_user_id equals the authenticated workspace UUID.
3. POST /v1/webhooks/revenuecat returns 200.
4. POST /v1/subscriptions/restore returns a Premium snapshot.
5. Premium remains active after navigating away and reopening the app.
6. No new subscription_lookup_failed Sentry event is created.
```

- [ ] **Step 4: Recover the already affected sandbox purchase**

On the affected tester account, sign into the correct OurWeek workspace and use **Settings → Restore Purchases**. Confirm Premium becomes active. If RevenueCat cannot associate the old anonymous sandbox transaction with the logged-in workspace, record that result and reset/expire the sandbox purchase using RevenueCat or Google Play test tooling; do not create an unsafe backend ownership mapping.

- [ ] **Step 5: Report results and leave changes uncommitted**

Summarize modified files, focused/full checks, manual verification status, recovery result, and residual rollout risk. Do not stage, commit, push, or deploy without separate authorization.
