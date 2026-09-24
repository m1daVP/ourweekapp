# Production Billing Validation Runbook

Use this runbook to complete and record Milestone 2: Production billing
validation. Do not enable public paid Premium until every scenario in the
evidence table has passed on the Google Play internal testing track.

## 1. Preflight and secret boundaries

- The Android package name is `com.ourweek.app`.
- `VITE_REVENUECAT_ANDROID_API_KEY` is a public RevenueCat SDK key. It is safe
  to bundle in the Android app, but it must still be the Android app key from
  the correct RevenueCat project.
- `REVENUECAT_API_KEY` and `REVENUECAT_WEBHOOK_SHARED_SECRET` are backend
  secrets. Store them only in the API host’s secret manager; never commit them,
  paste them into Play Console, or add them to a `VITE_` variable.
- Use one workspace owner account per test. RevenueCat’s app-user ID must equal
  that workspace’s ID, not a user ID, email address, or Play account ID.
- Confirm that the release build uses the production API URL, product IDs, and
  Android public SDK key before it is uploaded.

## 2. Configure Google Play Console

1. Open the app whose application ID is `com.ourweek.app` in Google Play
   Console.
2. Create one monthly and one yearly subscription product.
3. Set their product IDs to exactly match the release build’s
   `VITE_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID` and
   `VITE_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID` values.
4. Set the reviewed price, billing period, supported countries, and any offer
   eligibility. Confirm the displayed store price is final before publishing.
5. Add the test Google accounts to the Play license-testing list.
6. Upload the signed AAB to the internal testing track and add every test
   account as an internal tester. Wait until the build and both subscriptions
   are available to those accounts.
7. Keep public availability disabled until the evidence table is complete.

## 3. Configure RevenueCat

1. In the production RevenueCat project, add the Google Play app with package
   name `com.ourweek.app`.
2. Connect the Play developer account using RevenueCat’s current Google Play
   integration instructions, then import the monthly and yearly products.
3. Create entitlement `premium` and attach both imported products to it.
4. Create a current offering. Its identifier must match
   `VITE_REVENUECAT_CURRENT_OFFERING_ID`, and it must include both products.
5. Copy the Android public SDK key into the release build’s
   `VITE_REVENUECAT_ANDROID_API_KEY` value. Do not use a RevenueCat secret API
   key in the mobile build.
6. Create a webhook with this endpoint:

   ```text
   <PUBLIC_API_BASE_URL without its trailing /v1>/v1/webhooks/revenuecat
   ```

   For example, if `PUBLIC_API_BASE_URL` is `https://api.example.com/v1`, the
   endpoint is `https://api.example.com/v1/webhooks/revenuecat`.

7. Set the webhook Authorization header to the exact value stored as
   `REVENUECAT_WEBHOOK_SHARED_SECRET` in the API deployment. Do not save that
   value in this document.

## 4. Deploy and verify the API

1. Set these production API variables in the deployment secret manager:

   ```text
   REVENUECAT_PROJECT_ID
   REVENUECAT_API_KEY
   REVENUECAT_ENTITLEMENT_ID=premium
   REVENUECAT_WEBHOOK_SHARED_SECRET
   ```

2. Deploy the API. Startup must fail if any RevenueCat value is absent.
3. Confirm the public `/health` endpoint returns HTTP 200.
4. Send a RevenueCat test event or perform an internal-track sandbox purchase.
   Confirm the webhook returns HTTP 200 and that its logs contain only the
   event ID, event type, and workspace ID—never the shared secret, receipt, or
   Authorization header.
5. Confirm the affected workspace’s subscription record reflects the result
   after RevenueCat validation. Query the database only through approved
   admin/support tooling; do not copy customer data into this runbook.

## 5. Build the Android release

1. Create `D:\Projects\myself\weekly-us\.env.release.local` from
   `.env.release.example`.
2. Set `VITE_API_BASE_URL`, `VITE_REVENUECAT_ANDROID_API_KEY`,
   `VITE_REVENUECAT_CURRENT_OFFERING_ID`,
   `VITE_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID`, and
   `VITE_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID` to the reviewed production
   values.
3. Run `npm run cap:sync:prod` from `D:\Projects\myself\weekly-us`.
4. Build the signed AAB using the established Android release-signing process.
5. Upload the AAB to the Google Play internal testing track and install it from
   Google Play on a physical Android device. Do not validate purchases from a
   browser build or an APK installed outside the internal track.

## 6. Physical Android validation scenarios

Use an owner account and record one row per scenario below. Check backend
state through the subscription status endpoint or approved support tooling;
the client must never be treated as entitlement authority.

1. **Purchase monthly and yearly separately.** Start Free, purchase the
   selected plan, and wait for backend validation. Expected: `planType` becomes
   `premium`, `provider` is `google_play`, `status` is `active`, `expiresAt` is
   in the future, and Premium features unlock only after the validated refresh.
2. **Restore after reinstall.** Uninstall, reinstall from the internal track,
   sign in to the same workspace, and choose Restore purchases. Expected: the
   native restore completes, the backend refreshes the same workspace, and the
   active subscription restores without using a user ID or local cache as proof.
3. **Manage and cancel.** Use Manage subscription as the owner, cancel renewal
   in Google Play, and return to the app. Expected: Google Play is opened; the
   subscription remains Premium until its paid term or provider grace period
   ends, then a validated refresh reports Free. An adult member or viewer must
   not see or successfully call manage/restore actions.
4. **Renewal.** Complete a sandbox renewal cycle or use the provider’s allowed
   test schedule. Expected: a `RENEWAL` event refreshes that workspace and
   records an updated future `expiresAt` while Premium remains active.
5. **Expiration.** Let a cancelled sandbox subscription expire. Expected: an
   `EXPIRATION` event or status refresh sets Free access; Premium server
   features reject with the standard Premium-required response.
6. **Refund.** Refund a sandbox/internal-test purchase according to Google
   Play’s current supported process. Expected: a `REFUND` event refreshes the
   workspace; the next validated status is Free and server-protected Premium
   features are unavailable.
7. **Reinstall without a purchase.** Install on another eligible device or use
   a fresh workspace with no purchase. Expected: no restore can grant Premium;
   status remains Free.
8. **Backend outage trust window.** After a successfully validated Premium
   status, temporarily block the API-to-RevenueCat connection in a non-public
   test environment. Expected: the workspace may retain the recently verified
   entitlement for no more than 24 hours. After that window, failed validation
   resolves Free. Do not run this scenario against public production without an
   approved incident window.

## 7. Evidence record

Do not record live email addresses, receipts, tokens, API keys, webhook
secrets, or Authorization headers here. Refer to the approved test-account
alias or issue ticket instead.

| Scenario                   | Test-account alias | Device / Android version | App version / build | Product ID | RevenueCat event ID | Workspace ID | Date | Expected result                              | Observed result | Pass / fail | Issue link |
| -------------------------- | ------------------ | ------------------------ | ------------------- | ---------- | ------------------- | ------------ | ---- | -------------------------------------------- | --------------- | ----------- | ---------- |
| Monthly purchase           |                    |                          |                     |            |                     |              |      | Premium only after backend validation        |                 |             |            |
| Yearly purchase            |                    |                          |                     |            |                     |              |      | Premium only after backend validation        |                 |             |            |
| Restore after reinstall    |                    |                          |                     |            |                     |              |      | Same workspace becomes Premium               |                 |             |            |
| Manage and cancel          |                    |                          |                     |            |                     |              |      | Play management opens; access ends at expiry |                 |             |            |
| Renewal                    |                    |                          |                     |            |                     |              |      | Expiry extends; Premium stays active         |                 |             |            |
| Expiration                 |                    |                          |                     |            |                     |              |      | Free after validated expiry                  |                 |             |            |
| Refund                     |                    |                          |                     |            |                     |              |      | Free after validated refund                  |                 |             |            |
| Reinstall without purchase |                    |                          |                     |            |                     |              |      | Free; no local entitlement grant             |                 |             |            |
| Post-trust-window outage   |                    |                          |                     | N/A        | N/A                 |              |      | Free after 24-hour trust window              |                 |             |            |
| Non-owner billing attempt  |                    |                          |                     | N/A        | N/A                 |              |      | Owner-only controls and API enforcement      |                 |             |            |

## 8. Completion gate

Milestone 2 is complete only when RevenueCat and Google Play configuration are
reviewed, the API webhook is delivering successfully, every evidence row has a
passing real-device result, and the subscription copy still matches the final
Google Play products and terms. Until then, keep public paid Premium disabled.
