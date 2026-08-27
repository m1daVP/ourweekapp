# Contact Us Settings Link Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional, localized “Contact us” mail link to Settings, configured by `VITE_CONTACT_EMAIL`.

**Architecture:** Keep the address in the existing `src/shared/config/env.ts` app-config boundary as `string | null`. Settings consumes that normalized value and conditionally renders a semantic anchor in the existing Support & Legal card; no store, persistence, backend endpoint, or new dependency is needed.

**Tech Stack:** Vue 3 Composition API with TypeScript, Vite `import.meta.env`, vue-i18n, Vitest, npm.

## Global Constraints

- Use the existing Vue 3, TypeScript, Vite, Capacitor, Pinia, Vue Router, vue-i18n, ESLint, Prettier, and npm stack.
- Keep the app mobile-only and preserve the existing settings-row interaction and styling.
- Use translation keys for user-facing copy in English, Ukrainian, and Spanish.
- Do not store the contact address in local app state or add backend contact behavior.
- Do not add dependencies.
- Do not commit changes unless the user explicitly requests a commit.

---

## File Map

- Modify `src/shared/config/env.ts`: expose normalized `contactEmail` on `AppConfig` and read `VITE_CONTACT_EMAIL`.
- Modify `env.d.ts`: declare `VITE_CONTACT_EMAIL` for Vite type checking.
- Modify `.env.example` and `.env.release.example`: document the new public configuration variable.
- Modify `src/shared/config/__tests__/env.test.ts`: verify trimming and missing-value behavior.
- Modify `src/pages/SettingsPage.vue`: render the conditional mailto settings row.
- Modify `src/features/localization/messages.ts`: add localized contact title and supporting text in all supported locales.

### Task 1: Add normalized contact-email configuration

**Files:**

- Modify: `src/shared/config/__tests__/env.test.ts`
- Modify: `src/shared/config/env.ts`
- Modify: `env.d.ts`
- Modify: `.env.example`
- Modify: `.env.release.example`

**Interfaces:**

- Consumes: `AppConfigEnv.VITE_CONTACT_EMAIL?: string`.
- Produces: `appConfig.contactEmail: string | null` and `AppConfig.contactEmail: string | null`.

- [ ] **Step 1: Add the failing configuration assertions**

Append this test to `describe('createAppConfig', ...)` in
`src/shared/config/__tests__/env.test.ts`:

```ts
it('normalizes the optional contact email', () => {
  expect(
    createAppConfig({
      VITE_API_BASE_URL: apiBaseUrl,
      VITE_CONTACT_EMAIL: ' support@example.com ',
    }).contactEmail
  ).toBe('support@example.com');

  expect(
    createAppConfig({
      VITE_API_BASE_URL: apiBaseUrl,
      VITE_CONTACT_EMAIL: '   ',
    }).contactEmail
  ).toBeNull();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npm exec vitest run src/shared/config/__tests__/env.test.ts
```

Expected: the new test fails because `contactEmail` is not yet part of the returned app config.

- [ ] **Step 3: Add the typed configuration field and normalization**

In `src/shared/config/env.ts`:

1. Add `contactEmail: string | null;` to `AppConfig`.
2. Add `VITE_CONTACT_EMAIL?: string;` to `AppConfigEnv`.
3. Add `contactEmail: normalizeOptionalString(env.VITE_CONTACT_EMAIL),` to the object returned by `createAppConfig`.

In `env.d.ts`, add:

```ts
  readonly VITE_CONTACT_EMAIL?: string;
```

- [ ] **Step 4: Document the variable in environment examples**

Add this line to `.env.example` and `.env.release.example`:

```env
VITE_CONTACT_EMAIL=support@example.com
```

Keep it public configuration only; do not add a real private address or a secret.

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```bash
npm exec vitest run src/shared/config/__tests__/env.test.ts
```

Expected: all tests in the file pass, including the new trim and blank-value assertions.

### Task 2: Add the localized Settings contact row

**Files:**

- Modify: `src/pages/SettingsPage.vue`
- Modify: `src/features/localization/messages.ts`

**Interfaces:**

- Consumes: `appConfig.contactEmail: string | null` and the existing `settings-redesign-row` CSS classes.
- Produces: a Settings Support & Legal anchor with `href="mailto:${contactEmail}"`, rendered only when configured.

- [ ] **Step 1: Add the localized message keys**

In each locale’s `settings` object in `src/features/localization/messages.ts`, add:

```ts
contactUs: 'Contact us',
contactUsText: 'Email OurWeek support.',
```

Use these translations for Ukrainian and Spanish:

```ts
// Ukrainian
contactUs: 'Зв’язатися з нами',
contactUsText: 'Напишіть до служби підтримки OurWeek.',

// Spanish
contactUs: 'Contáctanos',
contactUsText: 'Escribe al soporte de OurWeek.',
```

- [ ] **Step 2: Import app configuration and render the semantic mail link**

In `src/pages/SettingsPage.vue`, import `appConfig` from `@/shared/config/env`.

Inside the existing `settings-redesign-card settings-redesign-card--flush` under the Support & Legal heading, before the support diagnostics `RouterLink`, add:

```vue
<a
  v-if="appConfig.contactEmail"
  class="settings-redesign-row"
  :href="`mailto:${appConfig.contactEmail}`"
>
          <span class="settings-redesign-row__body">
            <span class="settings-redesign-row__title">
              {{ t('settings.contactUs') }}
            </span>
            <span class="settings-redesign-row__text">
              {{ t('settings.contactUsText') }} {{ appConfig.contactEmail }}
            </span>
          </span>
          <span
            class="settings-redesign-row__chevron material-symbols-outlined"
            aria-hidden="true"
          >
            mail
          </span>
        </a>
```

The `v-if` must use the normalized config value, so blank environment values do not create a non-functional link. Do not add a click handler or prevent the native mail client behavior.

- [ ] **Step 3: Format the changed source files**

Run:

```bash
npm exec prettier --write src/pages/SettingsPage.vue src/shared/config/env.ts src/shared/config/__tests__/env.test.ts src/features/localization/messages.ts env.d.ts .env.example .env.release.example
```

Expected: Prettier completes without errors and only the intended files are formatted.

- [ ] **Step 4: Run the full test suite**

Run:

```bash
npm test
```

Expected: all existing and new tests pass.

### Task 3: Verify the production-facing project gates

**Files:**

- Verify only: all files modified in Tasks 1–2.

- [ ] **Step 1: Run the TypeScript/Vite build**

Run:

```bash
npm run build
```

Expected: `vue-tsc --noEmit` and the Vite production build both complete successfully.

- [ ] **Step 2: Run formatting and lint checks**

Run:

```bash
npm run check
```

Expected: `format:check` and ESLint both pass.

- [ ] **Step 3: Review the final diff**

Run:

```bash
git -c safe.directory=D:/Projects/myself/weekly-us diff --check
git -c safe.directory=D:/Projects/myself/weekly-us status --short
```

Expected: no whitespace errors; review the status/diff and confirm the contact-link changes contain only the approved spec, plan, configuration, translations, and Settings row. Preserve unrelated pre-existing worktree changes and confirm no generated artifacts or secrets were added.
