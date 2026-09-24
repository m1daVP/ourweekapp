# Insights Page Theme Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh `/insights` so its controls, cards, list rows, and feedback states match OurWeek's current calm mobile theme without changing any behavior.

**Architecture:** Keep the implementation local to `InsightsPage.vue`. Reuse existing global theme classes and CSS variables from `src/styles/main.css`; add page-scoped styling and only small, semantic template class hooks where a distinct visual treatment is needed. The Pinia store, API calls, routes, translated copy, and search pagination remain unchanged.

**Tech Stack:** Vue 3 Composition API, TypeScript, scoped CSS, existing global design tokens, npm.

## Global Constraints

- The app is mobile-only; controls use a minimum `44x44 px` touch target.
- Use existing CSS variables for colors, spacing, radii, shadows, and typography; introduce no dependency.
- Preserve all existing period-selection, loading, retry, search, pagination, and navigation behavior.
- Keep user-facing strings unchanged and translation-ready.
- Do not commit changes unless the user explicitly requests a commit.

---

## File Structure

- Modify: `src/pages/InsightsPage.vue` — preserves the existing page state and interaction bindings while adding class hooks and scoped, mobile-first visual styling for every rendered Insights state.
- Modify: `docs/superpowers/specs/2026-08-31-insights-page-theme-design.md` — no planned changes; this document remains the approved design reference.
- Create: no production files, components, services, or tests; this is a visual-only pass with no changed logic.

### Task 1: Apply the Insights visual system

**Files:**

- Modify: `src/pages/InsightsPage.vue:62-350`
- Test: Manual mobile viewport inspection of `/insights` with loaded, loading, error, empty recurring-topics, and search-result states.

**Interfaces:**

- Consumes: Existing `useHouseholdInsightsStore()` fields and actions exactly as already bound in the template: `load`, `search`, `selectedPeriod`, `insights`, `isLoading`, `errorMessage`, `isSearching`, `searchErrorMessage`, `searchQuery`, and `searchResults`.
- Produces: The same DOM semantics and event bindings with the following styling hooks: `insights-page`, `insights-page__header`, `insights-periods`, `insights-card-grid`, `insights-card`, `insights-tags`, `insights-topic-list`, `insights-search`, `insights-search-groups`, and `insights-result-list`.

- [ ] **Step 1: Inspect existing page and global token contracts**

Run:

```powershell
rg -n -C 3 "(content-panel|filter-chip|secondary-button|page-stack|text-button)" src/styles/main.css
Get-Content src/pages/InsightsPage.vue
```

Expected: `InsightsPage.vue` already uses semantic buttons, links, and the existing theme classes; `main.css` exposes the surface, primary, outline, radius, typography, and touch-target tokens needed for the refresh.

- [ ] **Step 2: Add presentation-only template hooks where the existing class names do not distinguish a visual role**

In `src/pages/InsightsPage.vue`, add only semantic class names needed to style distinct subparts, such as a metric value, empty-state copy, topic metadata, and the search form. Do not modify Vue script state, translations, store actions, route targets, `v-if` conditions, `v-model`, disabled expressions, or event listeners.

```vue
<strong class="insights-card__metric">...</strong>
<form class="insights-search__form" @submit.prevent="submitSearch">...</form>
```

- [ ] **Step 3: Implement scoped mobile-first styling for all Insights page states**

Replace the minimal scoped styles in `src/pages/InsightsPage.vue` with styles that:

```css
.insights-page {
  gap: var(--section-gap);
}

.insights-card {
  border-color: var(--color-outline-variant);
  background: var(--color-surface-lowest);
  box-shadow: var(--shadow-card);
}
```

Use the existing tokens to establish a clear header, segmented period controls, elevated metric hierarchy, readable metadata chips, tappable source/result rows, and a responsive search form. Include `:focus-visible`, `:disabled`, and `@media (max-width: 380px)` behavior where needed for clear keyboard focus and narrow devices. Do not use new hard-coded color values or desktop breakpoint layouts.

- [ ] **Step 4: Format the touched file**

Run:

```powershell
npx prettier --write src/pages/InsightsPage.vue
```

Expected: Prettier completes without changes outside the Insights page.

- [ ] **Step 5: Validate build and static checks**

Run:

```powershell
npm run build
npm run check
```

Expected: both commands exit successfully.

- [ ] **Step 6: Conduct visual QA at a mobile viewport**

Open `/insights` in the app at a 320–480px viewport. Verify that the header is visually integrated with the app shell; each period control, source action, and result link is comfortably tappable; the search action does not overflow; cards, empty states, errors, and loading content retain surface contrast; and keyboard focus is visible on controls. Verify that changing periods, retrying, searching, loading more results, and opening sources still use the existing behavior.

- [ ] **Step 7: Review the changed files before handoff**

Run:

```powershell
git diff -- src/pages/InsightsPage.vue docs/superpowers/specs/2026-08-31-insights-page-theme-design.md docs/superpowers/plans/2026-08-31-insights-page-theme-pass.md
```

Expected: the application diff is confined to the Insights page visual pass, and the documentation files describe the approved scope and implementation plan. Do not commit unless the user explicitly requests it.
