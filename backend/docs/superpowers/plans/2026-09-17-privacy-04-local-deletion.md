# Local Data and Account Deletion Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. If unavailable, follow the tasks directly; see the index for execution constraints.

**Goal:** Make the privacy policy accurately describe local-data removal, private notes, failed cleanup, other devices, and external copies.

**Architecture:** Preserve the existing delete-then-cleanup lifecycle and retry UX. Reconcile policy/data map with implemented behavior and add regressions only for uncovered failure scenarios. This is not a redesign of private-note storage or export.

**Tech Stack:** Vue, Capacitor Preferences/secure storage/local notifications, TypeScript, Vitest, Astro.

## Global Constraints

- Read the [index](2026-09-17-privacy-remediation-index.md). Plan 01 owns server retention/restoration.
- Current deletion dialog already names private notes, settings and local backups. Do not claim the dialog is missing or replace it without reason.
- Never promise remote wiping of offline devices, secure physical overwrite of flash storage, or deletion of user-shared external copies.
- Private notes remain local-only and excluded from normal account/meeting exports and AI.

## Files and responsibilities

- `MOBILE/src/features/auth/accountDeletionLifecycle.ts`: ordered API/local/session cleanup, typed failure.
- `MOBILE/src/features/auth/components/AccountSettingsSection.vue`: confirmation, local cleanup retry, notification cancellation, store resets.
- `MOBILE/src/shared/services/storageService.ts`: `clearAllLocalAppDataAfterAccountDeletion` and storage/backups.
- `MOBILE/src/app/stores/auth.ts`: verify actual session clear and account switching behavior before editing.
- `MOBILE/src/features/localization/messages.ts`: existing deletion/cleanup messages in all three locales; preserve current unrelated edits.
- `MOBILE/src/features/auth/__tests__/accountDeletionLifecycle.test.ts`, `components/__tests__/AccountSettingsSection.test.ts`: extend existing behavior tests.
- `MOBILE/src/features/legal/productionLegalContent.ts`, legal tests, `LANDING/src/pages/privacy.astro`, `delete-account.astro`: user disclosures.
- `MOBILE/android/app/src/main/AndroidManifest.xml`: backup disabled in inspected manifest; inspect actual iOS backup policy separately before making platform-wide claims.

### Task 1: Verify deletion boundaries and failures

**Existing interface:** `deleteAccountAndClearLocalData(dependencies): Promise<void>` with `deleteBackendAccount`, `clearSession`, `clearLocalAppData`, `resetInMemoryStores`, and optional reminder callbacks.

- [ ] Enumerate local storage keys, files, private-note records, persisted backups, temporary exports, secure auth storage, app settings and scheduled notifications. Identify what current cleanup removes and what belongs to a user-selected external destination.
- [ ] Verify cleanup only begins after server deletion succeeds. For failed server deletion, local notes/session must remain available and error messaging must not claim deletion succeeded.
- [ ] Extend the lifecycle test with a real failure-boundary assertion:

```ts
it('preserves local data when backend deletion fails', async () => {
  const clearLocalAppData = vi.fn();
  const clearSession = vi.fn();
  const resetInMemoryStores = vi.fn();
  await expect(deleteAccountAndClearLocalData({
    deleteBackendAccount: vi.fn().mockRejectedValue(new Error('offline')),
    clearLocalAppData, clearSession, resetInMemoryStores,
  })).rejects.toThrow('offline');
  expect(clearLocalAppData).not.toHaveBeenCalled();
  expect(clearSession).not.toHaveBeenCalled();
  expect(resetInMemoryStores).not.toHaveBeenCalled();
});
```

- [ ] Reuse existing tests for reminder failure and storage failure. Add component tests proving local retry does not call the authenticated deletion endpoint again after the session was cleared.
- [ ] Check session-clear failure independently of storage failure so a post-deletion error does not incorrectly say the server account still exists. Fix only confirmed behavior gaps and preserve typed local-cleanup reporting.
- [ ] Test application restart after partial cleanup and after successful cleanup with synthetic private-note data. If pending cleanup does not persist, document actual behavior or implement a narrowly scoped retry marker before claiming guaranteed restart recovery.
- [ ] Inspect other-device/session-expiry behavior; do not assume `401` deletes private notes. Distinguish what is revoked on the backend from what remains on an offline device.

### Task 2: Align policy and actionable copy

- [ ] Add the following factual distinction to mobile and website privacy, adjusted only if Task 1 finds a different implementation:

```text
Deleting your account in the app also attempts to remove OurWeek data from
the device used to make the request, including private notes, settings and
local app backups. If local cleanup fails, the app explains this and lets
you retry. A deletion request sent through our website or by email does not
itself erase data stored on your devices. Copies you exported or shared
outside OurWeek may remain with you or the recipient.
```

- [ ] Explain other-device cleanup instructions and loss of local-only data. Do not tell users that an account export includes private notes. Do not add private-note export as part of this task.
- [ ] Keep subscription cancellation separate. If the existing confirmation says all deletion is irreversible while Plan 01 keeps an approved restoration window, narrow the warning: local-only information cannot be recovered by restoring the backend account.
- [ ] Keep existing translation keys unless new information requires additional keys; update `en`, `uk`, `es` together. Legal pages remain canonical English unless legal translations are separately requested.
- [ ] Check whether support URLs/email are clickable and accessible in the rendered legal page. Use safe typed links/anchors, not injected HTML strings.

### Task 3: Verify and reconcile

- [ ] Run from MOBILE: `npx vitest run src/features/auth/__tests__/accountDeletionLifecycle.test.ts src/features/auth/components/__tests__/AccountSettingsSection.test.ts src/features/legal/productionLegalContent.test.ts src/pages/__tests__/LegalPages.test.ts`.
- [ ] For source changes run `npm run build` and `npm run check`; if landing changed run its `npm run build`.
- [ ] Manual device matrix: successful deletion; API failure; local storage failure and retry; notification cancellation failure; restart; second offline device; previously exported file. Use synthetic accounts/data only.
- [ ] Report platform coverage honestly. Do not label Android-only verification as iOS verification. Record storage mechanisms and platform backup caveats in Plan 06.

**Acceptance:** policy, confirmation, failure UI and actual local cleanup agree; private-note loss is understandable; email deletion is not described as device wiping; retries do not depend on a deleted session or silently re-create an account.
