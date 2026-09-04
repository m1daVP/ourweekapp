# Avatar Picker Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users preview avatar/color choices before one explicit confirmation.

**Architecture:** `AvatarPickerSheet` owns a draft mode and value, animates its inline wheel, and emits exactly one final choice.

**Tech Stack:** Vue 3, TypeScript, CSS transitions, iro.js, Vitest.

## Global Constraints

- Selection controls never persist or close the sheet directly.
- Custom-color visibility is a toggle.
- Respect `prefers-reduced-motion`.

---

### Task 1: Add draft selection and one confirmation action

**Files:**
- Modify: `weekly-us/src/features/participants/components/AvatarPickerSheet.vue`
- Create: `weekly-us/src/features/participants/components/__tests__/AvatarPickerSheet.test.ts`

- [ ] Write tests confirming a swatch/image does not emit or close, the custom toggle expands and collapses the wheel, and the bottom action emits the final color or avatar ID.
- [ ] Replace immediate selection handlers with a draft `{ mode: 'color' | 'avatar', value }`; reset it whenever the sheet opens.
- [ ] Add the one bottom confirmation action, a smooth CSS transition, and reduced-motion override.
- [ ] Make the confirmation action full-width with the existing green `meeting-primary` treatment and a 48px minimum height.
- [ ] Run `npm test` and `npm run build`.
