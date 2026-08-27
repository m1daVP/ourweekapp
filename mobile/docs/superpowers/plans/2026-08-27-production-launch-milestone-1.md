# Production Launch Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish accurate launch legal content for OurWeek, provide the
Google Play-compliant public account-deletion request route, and prepare the
final Data Safety evidence checklist.

**Architecture:** The landing site owns the publicly accessible Privacy,
Terms, and account-deletion pages. The mobile app keeps its native legal routes
but renders one locale-independent canonical English legal-content module.
The external deletion route is static and email-based; the existing
authenticated backend account-deletion flow remains the only deletion
operation.

**Tech Stack:** Astro 6, Vue 3, TypeScript, vue-i18n, Vitest 4,
@vue/test-utils, Node.js, npm.

## Global Constraints

- Use `VADYM PASICHNYK - WebWave` as the CEIDG-registered controller and
  operator: ul. Hugo Kołłątaja 6, lok. 3, 20-006 Lublin, Poland; NIP
  `5273152349`; REGON `540935095`.
- Publish `ourweekapp@gmail.com` as the support and privacy contact.
- Publish English as the sole authoritative legal language for this launch.
- State deletion or anonymization within 30 days of a verified request and
  backup expiry within 90 days; do not claim backup encryption without verified
  production evidence.
- Use `https://ourweekapp.com/delete-account` as the public Google Play
  deletion URL.
- Do not add an anonymous account-deletion endpoint, account-lookup endpoint,
  deletion-request database table, or database migration.
- Do not claim providers or data practices that are not enabled in production.
- Do not stage or commit changes unless the user explicitly authorizes it.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `weekly-us/src/features/legal/productionLegalContent.ts` | Canonical English legal text and public legal URLs for the mobile app. |
| `weekly-us/src/features/legal/productionLegalContent.test.ts` | Unit-level assertions for immutable operator, retention, data-rights, and URL disclosures. |
| `weekly-us/src/pages/PrivacyPolicyPage.vue` | Native rendering of canonical Privacy content without locale-specific draft text. |
| `weekly-us/src/pages/TermsPage.vue` | Native rendering of canonical Terms content without locale-specific draft text. |
| `weekly-us/src/pages/AccountPage.vue` | Immediate authenticated deletion plus visible public fallback for users unable to sign in. |
| `weekly-us/src/pages/__tests__/LegalPages.test.ts` | Component coverage that the Privacy and Terms pages render the canonical English content for all supported locales. |
| `weekly-us/src/pages/__tests__/AccountPage.test.ts` | Component coverage for the visible public deletion fallback without changing the existing destructive action. |
| `weekly-us-landing/src/pages/privacy.astro` | Public Privacy Policy covering website and mobile app behavior. |
| `weekly-us-landing/src/pages/terms.astro` | Public Terms covering the website and mobile app. |
| `weekly-us-landing/src/pages/delete-account.astro` | Public no-login email-based account-deletion request resource. |
| `weekly-us-landing/src/layouts/Layout.astro` | Footer navigation to the public deletion resource. |
| `weekly-us-landing/src/styles/global.css` | Focus-visible and responsive styling shared by public legal pages. |
| `weekly-us/docs/google-play-data-safety.md` | Final evidence checklist used to answer Google Play Data Safety questions. |

### Task 1: Create the canonical mobile legal-content module

**Files:**
- Create: `D:/Projects/myself/weekly-us/src/features/legal/productionLegalContent.ts`
- Create: `D:/Projects/myself/weekly-us/src/features/legal/productionLegalContent.test.ts`

**Interfaces:**
- Produces `PUBLIC_LEGAL_URLS`, a readonly object with `privacy`, `terms`, and
  `deleteAccount` absolute HTTPS URLs.
- Produces `privacyPolicy` and `termsOfService`, each with `title`,
  `effectiveDate`, `intro`, and readonly `{ heading, paragraphs }[]` sections.
- Consumed by `PrivacyPolicyPage.vue`, `TermsPage.vue`, `AccountPage.vue`, and
  their page tests.

- [ ] **Step 1: Write the failing legal-content test**

  Create the test with assertions that make the launch facts non-negotiable:

  ```ts
  import { describe, expect, it } from 'vitest';
  import {
    PUBLIC_LEGAL_URLS,
    privacyPolicy,
    termsOfService,
  } from './productionLegalContent';

  describe('production legal content', () => {
    it('publishes the approved external deletion route', () => {
      expect(PUBLIC_LEGAL_URLS.deleteAccount).toBe(
        'https://ourweekapp.com/delete-account'
      );
    });

    it('states the controller, deletion window, and support route', () => {
      const copy = JSON.stringify(privacyPolicy);
      expect(copy).toContain('VADYM PASICHNYK - WebWave');
      expect(copy).toContain('ourweekapp@gmail.com');
      expect(copy).toContain('30 days');
      expect(copy).toContain('90 days');
    });

    it('keeps Polish law and app-store billing in the terms', () => {
      const copy = JSON.stringify(termsOfService);
      expect(copy).toContain('laws of Poland');
      expect(copy).toContain('app store');
    });
  });
  ```

- [ ] **Step 2: Run the test and confirm it fails because the module is absent**

  Run from `D:/Projects/myself/weekly-us`:

  ```powershell
  npx vitest run src/features/legal/productionLegalContent.test.ts
  ```

  Expected: a module-resolution failure for `productionLegalContent`.

- [ ] **Step 3: Implement immutable content and URLs**

  Create a narrow content model; do not place the legal text in the localized
  `messages.ts` file:

  ```ts
  export type LegalSection = Readonly<{
    heading: string;
    paragraphs: readonly string[];
  }>;

  export const PUBLIC_LEGAL_URLS = {
    privacy: 'https://ourweekapp.com/privacy',
    terms: 'https://ourweekapp.com/terms',
    deleteAccount: 'https://ourweekapp.com/delete-account',
  } as const;
  ```

  Populate `privacyPolicy` with dated sections headed: **Controller and
  contact**, **Scope**, **Data we process**, **Why we process data**, **Where
  data is processed and shared**, **Local device data**, **Retention and
  deletion**, **Your rights**, and **Changes and contact**. State the registered
  CEIDG details exactly, the 30-day verified-request and 90-day backup periods,
  the export endpoint, in-app deletion, and external email request route.

  Describe Supabase/backend sync, optional Google Play/RevenueCat billing,
  optional Sentry diagnostics, optional OpenAI summaries, optional Google
  Calendar, local notifications, and local-only private notes without claiming
  an integration is active when it is not configured.

  Populate `termsOfService` with dated sections headed: **Who provides
  OurWeek**, **The service**, **Accounts and shared household content**,
  **Acceptable use**, **Subscriptions and payments**, **AI and calendar
  features**, **No professional or emergency advice**, **Availability and
  changes**, **Termination**, **Governing law**, and **Contact**. State that
  subscriptions are purchased, cancelled, and refunded through the relevant
  app store under its terms; do not invent prices, refund promises, or provider
  commitments.

- [ ] **Step 4: Run the focused legal-content test**

  ```powershell
  npx vitest run src/features/legal/productionLegalContent.test.ts
  ```

  Expected: PASS.

### Task 2: Render canonical legal content in the native app and expose the fallback deletion route

**Files:**
- Modify: `D:/Projects/myself/weekly-us/src/pages/PrivacyPolicyPage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/pages/TermsPage.vue`
- Modify: `D:/Projects/myself/weekly-us/src/pages/AccountPage.vue`
- Create: `D:/Projects/myself/weekly-us/src/pages/__tests__/LegalPages.test.ts`
- Create: `D:/Projects/myself/weekly-us/src/pages/__tests__/AccountPage.test.ts`

**Interfaces:**
- Consumes `privacyPolicy`, `termsOfService`, and
  `PUBLIC_LEGAL_URLS.deleteAccount` from `productionLegalContent.ts`.
- Preserves `deleteAccountAndClearLocalData()` and its existing confirmation
  dialog unchanged.
- Produces a stable `data-testid="external-delete-account"` link for focused
  component verification.

- [ ] **Step 1: Write failing page tests**

  In `LegalPages.test.ts`, mount both pages while setting the i18n locale to
  `en`, `uk`, and `es`; assert that each rendered page contains the English
  controller name, `ourweekapp@gmail.com`, `30 days`, and `90 days`, and that
  it does not render the current draft text beginning “This policy describes
  the planned public v1 behavior”.

  In `AccountPage.test.ts`, shallow-mount the authenticated account state with
  existing stores mocked, then assert:

  ```ts
  const fallback = wrapper.get('[data-testid="external-delete-account"]');
  expect(fallback.attributes('href')).toBe(
    'https://ourweekapp.com/delete-account'
  );
  expect(fallback.text()).toContain('Delete account online');
  ```

- [ ] **Step 2: Run the page tests and confirm they fail**

  ```powershell
  npx vitest run src/pages/__tests__/LegalPages.test.ts src/pages/__tests__/AccountPage.test.ts
  ```

  Expected: missing `productionLegalContent` imports, absent fallback test id,
  or the legacy localized draft text.

- [ ] **Step 3: Replace page-local draft rendering**

  Replace the i18n key arrays in `PrivacyPolicyPage.vue` and `TermsPage.vue`
  with imports from the canonical module. Render `effectiveDate`, every
  section heading, and each paragraph from the imported objects. Keep the
  existing localized “Back to settings” control only; all legal body text is
  canonical English regardless of `vue-i18n` locale.

  In the Account data-rights panel, retain the existing export and destructive
  deletion buttons. Directly after them, add a normal external anchor:

  ```vue
  <a
    class="secondary-button link-button"
    :href="PUBLIC_LEGAL_URLS.deleteAccount"
    data-testid="external-delete-account"
  >
    Delete account online
  </a>
  ```

  Add `rel="noopener noreferrer"` only if the anchor uses `target="_blank"`.
  Do not send an email address, user ID, token, or other account data in the
  link URL.

- [ ] **Step 4: Run the focused page tests**

  ```powershell
  npx vitest run src/pages/__tests__/LegalPages.test.ts src/pages/__tests__/AccountPage.test.ts
  ```

  Expected: PASS for all three locale configurations and the fallback link.

- [ ] **Step 5: Run the existing deletion lifecycle regression test**

  ```powershell
  npx vitest run src/features/auth/__tests__/accountDeletionLifecycle.test.ts
  ```

  Expected: PASS with no behavior change to backend deletion, local reminder
  cancellation, or local-data cleanup.

### Task 3: Publish landing-site legal pages and the public deletion resource

**Files:**
- Modify: `D:/Projects/myself/weekly-us-landing/src/pages/privacy.astro`
- Modify: `D:/Projects/myself/weekly-us-landing/src/pages/terms.astro`
- Create: `D:/Projects/myself/weekly-us-landing/src/pages/delete-account.astro`
- Modify: `D:/Projects/myself/weekly-us-landing/src/layouts/Layout.astro`
- Modify: `D:/Projects/myself/weekly-us-landing/src/styles/global.css`

**Interfaces:**
- Produces static `https://ourweekapp.com/privacy`, `/terms`, and
  `/delete-account` pages when deployed.
- `delete-account.astro` uses a `mailto:ourweekapp@gmail.com` link with the
  encoded subject `OurWeek account deletion request`.
- The footer exposes internal relative links `/privacy`, `/terms`, and
  `/delete-account`.

- [ ] **Step 1: Add a failing static-output check**

  Run the current build, then check for the route that does not yet exist:

  ```powershell
  npm run build
  Test-Path 'dist/delete-account/index.html'
  ```

  Expected: the build succeeds but the path check returns `False`.

- [ ] **Step 2: Implement the public deletion page**

  Create `delete-account.astro` with `Layout` and a single readable article.
  Include the OurWeek name, the operator name, `ourweekapp@gmail.com` as visible
  text, and a prominent `mailto:` action. Use the encoded subject but do not
  place an account email in the URL.

  Make the request steps explicit: email from the account address; include the
  request; support verifies control if necessary; access is removed and data is
  deleted or anonymized within 30 days of verification; backup copies expire
  within 90 days. Explain that app-store subscriptions must be cancelled in the
  relevant store and that deleting an owner account can transfer a shared
  workspace to another eligible member.

- [ ] **Step 3: Replace waitlist-only public policy and terms copy**

  Rewrite `privacy.astro` and `terms.astro` as launch documents using the
  section sequence defined in Task 1. Use the confirmed CEIDG identity and
  contact information, include effective dates, link the policies to each
  other and to `/delete-account`, and remove every waitlist-only statement and
  placeholder contact string.

  Ensure the Privacy Policy names the actual data categories and conditional
  processors, explains private notes/local notification storage, describes
  exports and deletion, and states user rights. Ensure the Terms explain
  shared-content responsibilities, app-store subscription handling, feature
  limitations, Polish governing law subject to mandatory protections, and
  contact/complaint handling. Do not state that the policies have received
  legal review.

- [ ] **Step 4: Add the footer link and legal-page styling**

  Add `Delete account` to `Layout.astro`'s existing `footer-links`. Add scoped
  global styles for the legal article (`max-width`, readable line length,
  heading rhythm, list spacing, visible link focus), reusing existing color
  variables and responsive rules. Do not introduce a UI library or a separate
  stylesheet.

- [ ] **Step 5: Build and verify the generated static pages**

  Run from `D:/Projects/myself/weekly-us-landing`:

  ```powershell
  npm run build
  node --input-type=module -e "import { readFile } from 'node:fs/promises'; const paths=['privacy','terms','delete-account']; for (const path of paths) { const html=await readFile('dist/'+path+'/index.html','utf8'); if (!html.includes('VADYM PASICHNYK - WebWave') || !html.includes('ourweekapp@gmail.com')) throw new Error(path+' omits launch identity/contact'); } const deletion=await readFile('dist/delete-account/index.html','utf8'); if (!deletion.includes('mailto:ourweekapp@gmail.com') || !deletion.includes('OurWeek%20account%20deletion%20request')) throw new Error('Deletion request link is missing'); if (!deletion.includes('30 days') || !deletion.includes('90 days')) throw new Error('Deletion retention disclosure is incomplete');"
  ```

  Expected: build succeeds and the verification command exits with code 0.

### Task 4: Finalize the Data Safety evidence checklist and release verification record

**Files:**
- Modify: `D:/Projects/myself/weekly-us/docs/google-play-data-safety.md`
- Modify: `D:/Projects/myself/weekly-us/docs/production-launch-milestones.md`

**Interfaces:**
- Produces a human-reviewable evidence source for the authenticated Play
  Console submission.
- Does not perform the Play Console submission or assert that it was completed.

- [ ] **Step 1: Update the Data Safety document from draft to evidence checklist**

  Preserve the existing data-category table, but replace draft language with
  explicit pre-submission checks for: backend sync/Supabase; Google Play and
  RevenueCat billing; Sentry; OpenAI; Google Calendar; local notifications;
  local device storage; and the absence of contacts, location, media, and
  direct payment-card collection. For every integration, require the release
  owner to mark whether it is enabled and then carry that answer to the Play
  Console collected/shared/purpose fields.

  Add an Account Deletion section with this exact public URL:

  ```text
  https://ourweekapp.com/delete-account
  ```

  Record that the route must return HTTP 200 with no login, expose an email
  deletion-request path, and match the 30-day/90-day policy language.

- [ ] **Step 2: Record implementation evidence in the milestone roadmap**

  Under Milestone 1, add a concise “Implementation evidence” subsection with
  checkboxes for: canonical English mobile legal pages; published public
  landing pages; public deletion route; in-app authenticated deletion; build
  verification; and Play Console submission. Mark only work actually completed
  by the implementation as complete. Leave legal review, provider
  configuration verification, deployment, and Play Console submission unchecked
  until a human supplies evidence.

- [ ] **Step 3: Review disclosure consistency**

  Compare the Data Safety document against the final landing Privacy Policy,
  Terms, and `productionLegalContent.ts`. Confirm every named provider has the
  same “optional/enabled only” qualification, all three documents use the same
  deletion URL, and all three use the same 30-day/90-day timing.

- [ ] **Step 4: Run project checks**

  ```powershell
  Set-Location 'D:/Projects/myself/weekly-us'
  npm run test
  npm run check
  npm run build
  Set-Location 'D:/Projects/myself/weekly-us-landing'
  npm run build
  ```

  Expected: all commands exit with code 0. If a pre-existing failure occurs,
  capture the command and output, do not suppress it, and do not alter
  unrelated code to make it pass.

## Final manual launch verification

- [ ] Deploy the landing site, then open `https://ourweekapp.com/delete-account`
  in a private browser window and verify a `200` response, the visible support
  address, and the pre-addressed email action.
- [ ] Send a test request from a controlled test account, verify account
  control without requesting a password or token, and use the existing
  authenticated deletion workflow to fulfill it.
- [ ] Check mobile Account settings on a device: immediate deletion works and
  the public fallback opens the same deployed deletion URL.
- [ ] Complete the authenticated Google Play Data Safety form with the finalized
  evidence and enter `https://ourweekapp.com/delete-account` in its account
  deletion URL field.
- [ ] Obtain qualified legal review before representing the Privacy Policy or
  Terms as reviewed production legal text.
