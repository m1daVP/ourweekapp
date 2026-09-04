# Bottom-sheet height cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep every shared bottom-sheet drawer within the lower half of the dynamic mobile viewport.

**Architecture:** The existing `BaseBottomSheet` component already owns the shared drawer structure, focus management, Android-back handling, and overflow behavior. A single CSS rule on its panel limits the visible height while its existing `overflow-y: auto` scrolls long content within that space.

**Tech Stack:** Vue 3, TypeScript, CSS, Vite, npm.

## Global Constraints

- Apply the behavior only to shared `BaseBottomSheet` panels; regular `.agreement-modal` dialogs remain unchanged.
- Use `dvh` for mobile browser and native WebView viewport changes.
- Preserve the bottom anchoring, safe-area padding, focus behavior, Android-back behavior, backdrop, and transitions.
- Add no dependencies and make no unrelated refactors.
- Do not commit unless the user explicitly requests a commit.

---

## File structure

- Modify `src/styles/main.css`: controls shared bottom-sheet dimensions and existing internal overflow.
- No component, type, or test file changes are required because the behavior is declarative and shared by the existing component.

### Task 1: Cap the shared bottom-sheet panel

**Files:**

- Modify: `src/styles/main.css:2591-2599`
- Test: Manual mobile viewport verification plus `npm run build` and `npm run check`

**Interfaces:**

- Consumes: The existing `.base-bottom-sheet__panel` element rendered by `BaseBottomSheet.vue`.
- Produces: A bottom-anchored sheet whose CSS `max-height` resolves to at most half of the dynamic viewport while preserving its existing internal scrolling.

- [ ] **Step 1: Confirm the panel already scrolls internally**

Inspect the existing shared panel rule and verify that it contains:

```css
.base-bottom-sheet__panel {
  overflow-y: auto;
}
```

- [ ] **Step 2: Replace the shared sheet height limit**

In the more specific `.base-bottom-sheet__panel` rule, replace:

```css
max-height: calc(100dvh - 24px);
```

with:

```css
max-height: 50dvh;
```

Do not alter the `.agreement-modal__panel` height limit or the panel's `overflow-y: auto`, bottom radius, safe-area padding, and pointer-event rules.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: Type checking and the Vite production build complete successfully.

- [ ] **Step 4: Run formatting and lint checks**

Run: `npm run check`

Expected: Prettier verification and ESLint complete successfully.

- [ ] **Step 5: Manually verify the avatar-picker sheet at a mobile viewport**

Open the avatar picker and confirm the following:

1. The sheet is anchored to the bottom of the viewport.
2. Its top edge never rises above the viewport midpoint.
3. Avatar groups that do not fit can be reached by scrolling inside the sheet.
4. The close action, outside-tap close, and Android-back close behavior still work.
