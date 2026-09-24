# Settings Trailing Icons Implementation Plan

> **For agentic workers:** Implement this plan task-by-task with review checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Support & Legal row icons to the right edge on the mobile Settings page.

**Architecture:** Add a focused `settings-redesign-row--trailing-icon` CSS modifier that changes only rows whose icon is the final child to a two-column grid. Apply it to the four Support & Legal rows while preserving the existing three-column layout for preference rows with leading icons.

**Tech Stack:** Vue 3 single-file components, scoped/global CSS in `src/styles/main.css`, TypeScript, npm, Prettier, ESLint, Vitest, Vite.

## Global Constraints

- Keep the app mobile-only and preserve the existing settings-row interaction and styling.
- Do not introduce new behavior, navigation, dependencies, or state.
- Keep Contact us conditional on `VITE_CONTACT_EMAIL`.
- Preserve unrelated existing worktree changes.
- Do not commit changes unless the user explicitly requests a commit.

---

## File Map

- Modify `src/styles/main.css`: define the trailing-icon grid modifier.
- Modify `src/pages/SettingsPage.vue`: apply the modifier to Contact us, Support diagnostics, Privacy Policy, and Terms.

### Task 1: Align Support & Legal icons to the right

**Files:**

- Modify: `src/styles/main.css:2075-2088`
- Modify: `src/pages/SettingsPage.vue:335-396`

**Interfaces:**

- Consumes: the existing `.settings-redesign-row` three-column grid and Support & Legal row markup.
- Produces: `.settings-redesign-row--trailing-icon` with `grid-template-columns: minmax(0, 1fr) auto`, applied to all four Support & Legal rows.

- [ ] **Step 1: Add the trailing-icon CSS modifier**

Immediately after the existing `.settings-redesign-row` rule in
`src/styles/main.css`, add:

```css
.settings-redesign-row--trailing-icon {
  grid-template-columns: minmax(0, 1fr) auto;
}
```

This makes the text body occupy the flexible first column and the final icon occupy the right-aligned second column. Do not alter the base `.settings-redesign-row` rule, because preference rows depend on its leading-icon three-column layout.

- [ ] **Step 2: Apply the modifier to all Support & Legal rows**

In `src/pages/SettingsPage.vue`, add `settings-redesign-row--trailing-icon` to the `class` attribute of each of these four rows:

```vue
class="settings-redesign-row settings-redesign-row--trailing-icon"
```

Apply it to:

1. The conditional Contact us `<a>`.
2. The Support diagnostics `<RouterLink>`.
3. The Privacy Policy `<RouterLink>`.
4. The Terms `<RouterLink>`.

Leave preference rows such as Calendar sync, Reminder notifications, and Language unchanged.

- [ ] **Step 3: Format the changed files**

Run:

```bash
npm exec -- prettier --write src/pages/SettingsPage.vue src/styles/main.css docs/superpowers/plans/2026-08-27-settings-trailing-icons.md
```

Expected: Prettier completes successfully and the changed files remain formatted.

- [ ] **Step 4: Run targeted static checks**

Run:

```bash
npm exec -- eslint src/pages/SettingsPage.vue
npm exec -- prettier --check src/pages/SettingsPage.vue src/styles/main.css docs/superpowers/specs/2026-08-27-settings-trailing-icons-design.md docs/superpowers/plans/2026-08-27-settings-trailing-icons.md
```

Expected: both commands pass.

- [ ] **Step 5: Run the full test suite and production build**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and the Vue/TypeScript production build completes successfully. The build may continue to show the repository’s existing Vite chunk-size warning.

- [ ] **Step 6: Review the final diff without touching unrelated work**

Run:

```bash
git -c safe.directory=D:/Projects/myself/weekly-us diff --check
git -c safe.directory=D:/Projects/myself/weekly-us status --short
```

Expected: no whitespace errors; only the approved modifier/style change is added to the files touched by this task. Preserve unrelated existing changes and do not commit.
