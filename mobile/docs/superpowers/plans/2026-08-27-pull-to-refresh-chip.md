# Pull-to-Refresh Chip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present the existing pull-to-refresh status as a compact neutral chip without changing gesture or refresh behavior.

**Architecture:** Keep the outer `.pull-to-refresh` element responsible for gesture-positioning, visibility, and phase classes. Add one inner content wrapper responsible for the chip surface so its padding and visual size do not change the outer zero-height layout behavior.

**Tech Stack:** Vue 3 Composition API with `<script setup lang="ts">`, TypeScript, CSS custom properties, Vite, npm.

## Global Constraints

- Keep the app mobile-only and preserve safe-area-aware layout behavior.
- Preserve the existing pull-to-refresh phases, transitions, translations, and refresh callback.
- Use existing design tokens where available; do not add a dependency.
- Keep the neutral, calm, non-judgmental OurWeek visual tone.
- Do not modify the pre-existing unrelated change in `scripts/ping-health.mjs`.

---

### Task 1: Add neutral chip presentation to the shared pull-to-refresh indicator

**Files:**

- Modify: `src/shared/components/AppShell.vue:144-163` — wrap the existing icon and status text in a chip content element.
- Modify: `src/styles/main.css:342-376` — style the inner content as a compact neutral pill while preserving outer gesture positioning.
- Test: manual visual inspection plus the existing project build/check commands; no behavior test changes are needed because gesture logic is unchanged.

**Interfaces:**

- Consumes: existing `pullPhase`, `pullStatusText`, `pullIndicatorStyle`, and `.pull-to-refresh--<phase>` classes.
- Produces: the same accessible `role="status"` indicator and phase behavior, with a visible neutral chip for pulling, ready, and refreshing states.

- [x] **Step 1: Update the template with a visual-only inner wrapper**

Change the indicator contents in `src/shared/components/AppShell.vue` from direct children to one inner wrapper. Keep the icon class binding, `refresh` icon text, conditional status text, `role`, `aria-live`, and `aria-atomic` unchanged:

```vue
<div
  v-if="pullToRefreshEnabled"
  :class="['pull-to-refresh', `pull-to-refresh--${pullPhase}`]"
  :style="pullIndicatorStyle"
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  <div class="pull-to-refresh__content">
    <span
      :class="[
        'material-symbols-outlined',
        { 'pull-to-refresh__spinner': pullPhase === 'refreshing' },
      ]"
      aria-hidden="true"
    >
      refresh
    </span>
    <span v-if="pullPhase !== 'idle'">{{ pullStatusText }}</span>
  </div>
</div>
```

- [x] **Step 2: Style the inner wrapper as a neutral chip**

Retain the existing outer `.pull-to-refresh` rules for height, transform, opacity, transitions, and phase visibility. Add the following rules after the outer indicator rule in `src/styles/main.css`; keep the existing icon sizing and spinner animation:

```css
.pull-to-refresh__content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 6px 12px;
  border: 1px solid var(--color-outline-variant);
  border-radius: 999px;
  background: var(--color-surface-container);
  box-shadow: 0 2px 8px rgba(47, 42, 38, 0.06);
}
```

If either referenced neutral token is absent, use the closest existing neutral surface/outline tokens already defined in `src/styles/main.css`; do not create a new color system. The outer `.pull-to-refresh` remains `height: 0` with `overflow: visible`, so the chip remains visually present during active phases without adding persistent page layout height.

- [x] **Step 3: Run focused regression checks**

Run:

```bash
npm test -- src/shared/composables/__tests__/usePullToRefresh.test.ts
npm run build
npm run check
```

Expected: the pull-to-refresh gesture tests pass, TypeScript/Vite build completes successfully, and formatting/lint checks pass. If the project has no `npm test` script, run the configured Vitest command from `package.json` for the same test file and continue with build/check.

- [x] **Step 4: Inspect the final diff**

Run:

```bash
git -c safe.directory=D:/Projects/myself/weekly-us diff --check -- src/shared/components/AppShell.vue src/styles/main.css docs/superpowers/specs/2026-08-27-pull-to-refresh-chip-design.md docs/superpowers/plans/2026-08-27-pull-to-refresh-chip.md
```

Confirm the diff only adds the approved inner chip wrapper and neutral presentation styles, while `scripts/ping-health.mjs` remains untouched by this task.
