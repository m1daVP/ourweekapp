# Localization Catalogue Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every application translation key resolve to real English, Ukrainian, and Spanish copy without changing existing Ukrainian or Spanish translations.

**Architecture:** Keep `src/features/localization/messages.ts` as the single locale catalogue. A focused Vitest test will flatten each nested catalogue, derive known dynamic paths from their typed runtime sources, and assert that all locales have the canonical English leaf-path set with non-blank values. The English object remains the source of truth and all missing Ukrainian/Spanish values are additive.

**Tech Stack:** Vue 3, TypeScript, vue-i18n, Vitest, npm.

## Global Constraints

- Use the existing `messages.ts` catalogue; do not add a new localization dependency.
- Preserve every existing non-empty Ukrainian and Spanish translation verbatim.
- Use calm, practical, non-judgmental product wording for new values.
- Keep all user-visible values translation-ready and retain English as the runtime fallback locale.
- Run `npm run build` and `npm run check` before delivery.
- Do not create a Git commit unless the user explicitly authorizes one.

---

### Task 1: Add a catalogue-completeness regression test

**Files:**

- Create: `src/features/localization/__tests__/messages.test.ts`
- Read: `src/features/localization/messages.ts`
- Read: `src/features/meeting/meetingTemplates.ts`

**Interfaces:**

- Consumes: `messages`, whose locale objects are nested `string | readonly string[] | object` values.
- Produces: `flattenLeafPaths(value: unknown, prefix?: string): Map<string, string | readonly string[]>` in the test module and assertions that locale leaf paths and values are complete.

- [ ] **Step 1: Write the failing test**

```ts
it.each(['uk', 'es'] as const)(
  'matches the English message paths and has real values for %s',
  (locale) => {
    expect(flattenLeafPaths(messages[locale])).toEqual(
      flattenLeafPaths(messages.en)
    );
  }
);
```

- [ ] **Step 2: Run the test to verify the currently missing paths fail**

Run: `npm test -- src/features/localization/__tests__/messages.test.ts`

Expected: FAIL, listing the message paths that are missing from a locale or differ structurally from English.

- [ ] **Step 3: Implement the complete audit assertions**

```ts
function flattenLeafPaths(value: unknown, prefix = '') {
  const leaves = new Map<string, string | readonly string[]>();
  // Recurse through plain objects; store arrays and strings as leaves.
  return leaves;
}

expect([...localeLeaves.keys()].sort()).toEqual(
  [...englishLeaves.keys()].sort()
);
for (const [path, value] of localeLeaves) {
  expect(
    Array.isArray(value) ? value.every(Boolean) : value.trim()
  ).toBeTruthy();
}
```

Include a separate assertion for literal translation calls found in application source and the finite dynamic key families used by `meetingTemplates.ts`, calendar weekdays, task statuses, day names, sync states, and subscription plan/message mappings.

- [ ] **Step 4: Run the test after implementing it**

Run: `npm test -- src/features/localization/__tests__/messages.test.ts`

Expected: the test runs and reports only genuine catalogue gaps.

### Task 2: Repair English keys and complete Ukrainian/Spanish catalogues

**Files:**

- Modify: `src/features/localization/messages.ts`
- Test: `src/features/localization/__tests__/messages.test.ts`

**Interfaces:**

- Consumes: the failing missing-path report from Task 1.
- Produces: a non-empty string or non-empty prompt array for every English, Ukrainian, and Spanish leaf path.

- [ ] **Step 1: Use the test report to locate missing English values**

Run: `npm test -- src/features/localization/__tests__/messages.test.ts`

Expected: identify each key referenced by source that has no real English value.

- [ ] **Step 2: Add missing English messages**

```ts
en: {
  meeting: {
    // Add only entries identified by the audit, using concise neutral copy.
  },
}
```

Do not rename existing keys or reword existing English values.

- [ ] **Step 3: Add matching Ukrainian and Spanish messages**

```ts
uk: {
  meeting: {
    // Add the exact missing English paths with new Ukrainian text.
  },
},
es: {
  meeting: {
    // Add the exact missing English paths with new Spanish text.
  },
},
```

Do not alter existing non-empty Ukrainian or Spanish entries.

- [ ] **Step 4: Run the focused locale tests**

Run: `npm test -- src/features/localization/__tests__/messages.test.ts src/features/localization/__tests__/calendarScheduleMessages.test.ts`

Expected: PASS.

### Task 3: Verify production type-checking, formatting, and build output

**Files:**

- Verify: `src/features/localization/messages.ts`
- Verify: `src/features/localization/__tests__/messages.test.ts`

**Interfaces:**

- Consumes: complete, type-compatible locale catalogue from Task 2.
- Produces: a validated build and lint/format report.

- [ ] **Step 1: Format the changed files**

Run: `npx prettier --write src/features/localization/messages.ts src/features/localization/__tests__/messages.test.ts`

Expected: files match the project formatter.

- [ ] **Step 2: Run all validation**

Run: `npm run build && npm run check`

Expected: PASS.

- [ ] **Step 3: Review the diff without committing**

Run: `git diff -- src/features/localization/messages.ts src/features/localization/__tests__/messages.test.ts`

Expected: only missing locale keys, their translations, and the regression test are changed.
