# Composer Primary Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the composer bottom Cancel action and make submit full width.

**Architecture:** Change only the shared `MeetingItemComposer` action markup and its scoped action layout. The base bottom-sheet header continues to provide the top-right close control.

**Tech Stack:** Vue 3, scoped CSS, Vitest, Vue Test Utils.

## Global Constraints

- Preserve the accessible `BaseBottomSheet` close control.
- Do not add dependencies.
- Keep the action touch target at least 44px high.

---

### Task 1: Simplify shared composer actions

**Files:**
- Modify: `src/features/meeting/components/MeetingItemComposer.vue`
- Test: `src/features/meeting/components/__tests__/MeetingItemComposer.test.ts`

**Interfaces:**
- Consumes: the existing `close` event through the base sheet header.
- Produces: one full-width submit action for task, note, and agreement composer modes.

- [ ] **Step 1: Add the action-layout assertion**

Assert the composer has no `.secondary-button` in `.meeting-item-composer__actions` and retains one submit button.

- [ ] **Step 2: Remove the Cancel button and expand submit**

Delete the bottom Cancel button. Set the remaining action button to use the full available width through the existing action container CSS.

- [ ] **Step 3: Verify**

Run: `npm exec vitest run src/features/meeting/components/__tests__/MeetingItemComposer.test.ts && npm run build`

Expected: PASS.
