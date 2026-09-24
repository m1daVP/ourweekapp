# Meeting Template Description Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display every meeting template description in the active app language.

**Architecture:** `TemplateCard.vue` will use the existing `getMeetingTemplateDescription` helper as its only source for description copy. The helper resolves the active `vue-i18n` locale and retains its existing stored-description fallback.

**Tech Stack:** Vue 3, TypeScript, vue-i18n, Vite, ESLint, Prettier, npm.

## Global Constraints

- Keep the scope to meeting template descriptions; do not change template names, sections, layout, or meeting data.
- Reuse the existing `templates.<meetingType>.description` locale entries; add no duplicate text catalog.
- Preserve the helper fallback to `template.description` if a localization key is unavailable.
- Follow the existing Vue 3 Composition API and TypeScript style.
- Use npm project scripts for verification.
- Do not create a Git commit unless the user explicitly requests one.

---

## File Structure

- Modify `src/features/meeting/components/TemplateCard.vue`: remove the English-only card description map and directly use the existing localization helper.
- Verify `src/features/meeting/meetingTemplates.ts`: it already provides `getMeetingTemplateDescription(templateId?: string, fallback?: string): string`; no change is required.

### Task 1: Route meeting-type card descriptions through the localization helper

**Files:**

- Modify: `src/features/meeting/components/TemplateCard.vue:40-64`
- Verify: `src/features/meeting/meetingTemplates.ts:291-300`

**Interfaces:**

- Consumes: `getMeetingTemplateDescription(templateId?: string, fallback?: string): string` from `@/features/meeting/meetingTemplates`.
- Produces: `getTemplateDescription(template: MeetingTemplate): string`, returning the localized description for the current locale or the stored template description as fallback.

- [ ] **Step 1: Confirm the current override bypasses localization**

Inspect `src/features/meeting/components/TemplateCard.vue` and verify it contains an English-only `templateDescriptionMap` that is evaluated before the localization helper.

- [ ] **Step 2: Replace the component override with the existing helper call**

Delete `templateDescriptionMap` and make `getTemplateDescription` return only the helper result:

```ts
function getTemplateDescription(template: MeetingTemplate) {
  return getMeetingTemplateDescription(template.id, template.description);
}
```

- [ ] **Step 3: Confirm all locale descriptions remain available**

Inspect `src/features/localization/messages.ts` for all six description entries in English, Ukrainian, and Spanish:

```txt
weeklyFamilyCheckIn
coupleReset
familyWithKids
moneyCheckIn
conflictCleanup
busyWeekPlanning
```

Each template object must include a `description` property. Do not change the locale catalog when they are present.

- [ ] **Step 4: Run production type-check and bundle verification**

Run: `npm run build`

Expected: exits with code 0 after `vue-tsc --noEmit` and `vite build` complete successfully.

- [ ] **Step 5: Run formatting and lint verification**

Run: `npm run check`

Expected: exits with code 0 after Prettier validation and ESLint complete successfully.

- [ ] **Step 6: Manually verify language switching**

Start the app with `npm run dev`, open the meeting-template selection screen, and switch the app language between English, Ukrainian, and Spanish. For every meeting type, confirm the description matches the active language and the card remains selectable and accessible.

- [ ] **Step 7: Leave changes uncommitted for user review**

Do not stage or commit files. Report the changed component and verification results to the user.
