# Remove Support Diagnostics UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the customer-facing Support diagnostics Settings entry, route, and page while retaining developer diagnostics tooling.

**Architecture:** Delete only the page boundary and all UI navigation to it. The router no longer registers `/settings/support`; `supportDiagnosticsService.ts`, its tests, and vConsole diagnostics remain independent and unchanged.

**Tech Stack:** Vue 3, TypeScript, Vue Router, vue-i18n, Vitest, npm.

## Global Constraints

- Use the existing Vue 3 and Vue Router structure; do not add dependencies.
- Keep the diagnostics service, its tests, vConsole tooling, and Sentry/debug behavior unchanged.
- Remove customer-facing strings only when there are no remaining production callers.
- Do not redirect `/settings/support`; there are no users or bookmarks to preserve.
- Do not commit unless the user explicitly requests a commit.

---

## File structure

- Delete `src/pages/SupportDiagnosticsPage.vue`: removes the customer-facing diagnostics interface.
- Modify `src/pages/SettingsPage.vue`: removes the Support diagnostics navigation row.
- Modify `src/app/router/index.ts`: removes the page import and `/settings/support` route.
- Modify `src/shared/components/AppShell.vue`: removes the retired route title mapping.
- Modify `src/features/localization/messages.ts`: removes unused route, Settings, auth-link, and page translation keys in all supported locales.

### Task 1: Remove user-facing navigation and page implementation

**Files:**

- Delete: `src/pages/SupportDiagnosticsPage.vue`
- Modify: `src/pages/SettingsPage.vue:404-425`
- Modify: `src/app/router/index.ts:24,183-189`
- Modify: `src/shared/components/AppShell.vue:55`

**Interfaces:**

- Produces: no `support-diagnostics` named route and no Settings navigation entry for it.
- Retains: `src/shared/services/supportDiagnosticsService.ts` and its direct developer-facing unit tests.

- [ ] **Step 1: Remove the Settings row**

Delete this complete `RouterLink` block, including its icon, from the Support & Legal card:

```vue
<RouterLink
  class="settings-redesign-row settings-redesign-row--trailing-icon"
  :to="{ name: 'support-diagnostics' }"
>
  <span class="settings-redesign-row__body">
    <span class="settings-redesign-row__title">
      {{ t('settings.supportDiagnostics') }}
    </span>
    <span class="settings-redesign-row__text">
      {{ t('settings.supportText') }}
    </span>
  </span>
  <span class="settings-redesign-row__chevron material-symbols-outlined">
    chevron_right
  </span>
</RouterLink>
```

- [ ] **Step 2: Remove route registration**

Delete the `SupportDiagnosticsPage` import and this router record:

```ts
{
  path: '/settings/support',
  name: 'support-diagnostics',
  component: SupportDiagnosticsPage,
  meta: { hideNavigation: true },
},
```

Do not add a replacement route or redirect.

- [ ] **Step 3: Remove the AppShell page-title mapping**

Delete the mapping entry:

```ts
'support-diagnostics': t('app.routeTitles.supportDiagnostics'),
```

- [ ] **Step 4: Delete the page**

Delete `src/pages/SupportDiagnosticsPage.vue`. Do not delete
`src/shared/services/supportDiagnosticsService.ts` or
`src/shared/services/__tests__/supportDiagnosticsService.test.ts`.

- [ ] **Step 5: Verify no retired UI references remain**

Run:

```bash
rg -n "support-diagnostics|SupportDiagnosticsPage" src
```

Expected: no matches. References to `supportDiagnosticsService` and its test
remain valid and are intentionally retained.

### Task 2: Remove unreferenced diagnostics UI copy and validate

**Files:**

- Modify: `src/features/localization/messages.ts:29,213,613,616,710-757` and matching Ukrainian/Spanish locale blocks

**Interfaces:**

- Produces: no i18n keys used solely by the retired route, Settings row, or deleted page.
- Retains: unrelated diagnostics terminology used by service, legal, or debug tooling.

- [ ] **Step 1: Remove retired strings in every locale**

Delete the following keys from English, Ukrainian, and Spanish locale blocks:

```txt
app.routeTitles.supportDiagnostics
auth.openDiagnostics
settings.supportText
settings.supportDiagnostics
supportDiagnostics
```

Keep `settings.support`, `settings.contactUs`, legal strings, and all non-UI
diagnostics/service content.

- [ ] **Step 2: Verify i18n callers are gone**

Run:

```bash
rg -n "supportDiagnostics|openDiagnostics|settings\.supportText|settings\.supportDiagnostics" src
```

Expected: no matches.

- [ ] **Step 3: Run targeted diagnostics-service coverage**

Run: `npx vitest run src/shared/services/__tests__/supportDiagnosticsService.test.ts`

Expected: PASS, confirming retained developer diagnostics behavior.

- [ ] **Step 4: Run build and project checks**

Run:

```bash
npm run build
npm run check
```

Expected: build passes. If `npm run check` reports existing unrelated format
issues, report them without modifying files outside this task.

## Plan self-review

- Spec coverage: Task 1 removes the customer-facing settings row, route, route title, and page; Task 2 removes all now-unused UI copy while preserving developer diagnostics code.
- Placeholder scan: all target files, strings, retained files, and commands are named explicitly.
- Type consistency: no new types or interfaces are introduced; deleting the named route also removes all of its remaining callers.
