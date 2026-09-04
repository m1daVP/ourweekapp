# Avatar Picker Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Avatar settings control visually consistent and keep custom color selection inside its parent bottom sheet.

**Architecture:** `AvatarPickerSheet` owns all preset and custom-color state. `HouseholdMembersSettings` only opens it and receives the final color or avatar selection.

**Tech Stack:** Vue 3, TypeScript, vue-i18n, iro.js, Vitest.

## Global Constraints

- Do not stack bottom sheets for avatar selection.
- Preserve custom hex validation and color-wheel cleanup.
- Use existing mobile settings/card tokens and 44px-plus targets.

---

### Task 1: Inline custom color control

**Files:**
- Modify: `weekly-us/src/features/participants/components/AvatarPickerSheet.vue`
- Delete: `weekly-us/src/features/participants/components/AvatarColorPickerSheet.vue`
- Modify: `weekly-us/src/features/participants/components/HouseholdMembersSettings.vue`

- [ ] Move the existing `iro` setup, teardown, and hex validation into `AvatarPickerSheet`; toggle it under color swatches and emit `selectColor` only after valid confirmation.
- [ ] Remove old custom-sheet state, import, and event wiring from household settings.
- [ ] Verify Android Back has one sheet to close.

### Task 2: Settings-style avatar control

**Files:**
- Modify: `weekly-us/src/features/participants/components/HouseholdMembersSettings.vue`
- Modify: `weekly-us/src/features/localization/messages.ts`

- [ ] Replace the unstyled button with a full-width field row containing preview, label, current selection, and chevron.
- [ ] Add translated current-color/current-avatar copy where needed.
- [ ] Run `npm test` and `npm run build`.
