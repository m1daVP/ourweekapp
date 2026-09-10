# Account Settings Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the online deletion fallback and align Account card headings with the existing lightweight Settings hierarchy.

**Architecture:** Keep `AccountSettingsSection` as the only account-control surface. Replace internal card headings with the established Settings title class and remove the external deletion URL/link, retaining the existing in-app destructive lifecycle unchanged.

**Tech Stack:** Vue 3, TypeScript, Vitest, Vue Test Utils, Prettier, ESLint.

## Global Constraints

- Do not alter account deletion, confirmation, backend, cleanup, retry, or recovery behavior.
- Keep section and card titles outside visual card containers where Settings already follows that hierarchy.
- Do not add dependencies or commit unless the user explicitly requests it.

---

### Task 1: Simplify the Account controls and test their behavior

**Files:**

- Modify: `src/features/auth/components/AccountSettingsSection.vue`
- Modify: `src/features/auth/components/__tests__/AccountSettingsSection.test.ts`

**Interfaces:**

- Consumes: existing account deletion handlers and `ConfirmationDialog`.
- Produces: one in-app deletion action, without an external deletion link, and lightweight title treatment for Account cards.

- [ ] **Step 1: Write the failing deletion-link assertion**

  Replace the external fallback assertion with:

  ```ts
  expect(wrapper.find('[data-testid="external-delete-account"]').exists()).toBe(
    false
  );
  expect(wrapper.find('button.history-item__delete').exists()).toBe(true);
  ```

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `npx vitest run src/features/auth/components/__tests__/AccountSettingsSection.test.ts`

  Expected: FAIL because the external link is still rendered.

- [ ] **Step 3: Remove the online fallback and adjust hierarchy classes**

  Remove `PUBLIC_LEGAL_URLS` from the component imports and delete the external `<a>` element. Replace the internal `h3` card headings with the existing `settings-redesign-row__title` styling applied above their related cards, leaving the Account section title outside all cards. Keep the account summary title-free.

- [ ] **Step 4: Run focused validation**

  Run: `npx vitest run src/features/auth/components/__tests__/AccountSettingsSection.test.ts && npm run build && npm run lint`

  Expected: all tests, type checking, build, and lint complete without errors.

## Plan Self-Review

- Spec coverage: the only task removes the web fallback, preserves the deletion path, and changes only Account hierarchy presentation.
- Placeholder scan: no deferred choices or incomplete steps remain.
- Type consistency: the existing `AccountSettingsSection` component and test selectors remain unchanged except for the removed external-link selector.
