# Premium Profile Google-Color Ring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Premium profile avatar's solid green outline with a segmented Google-color ring.

**Architecture:** `AppShell.vue` already supplies the entitlement-driven Premium modifier. Replace only the modifier pseudo-element's solid border with a CSS conic gradient that shows four separated colour arcs behind the existing 32px avatar. No component, state, interaction, or layout changes are needed.

**Tech Stack:** Vue 3, CSS custom properties, Vue Test Utils, Vitest.

## Global Constraints

- Premium state remains the trusted existing `hasPremiumEntitlement` store getter.
- Keep the mobile header's 40px profile slot, Settings link, accessible label, and 32px avatar unchanged.
- Use static Google blue `#4285f4`, red `#ea4335`, yellow `#fbbc05`, and green `#34a853` arcs, with tiny `--color-surface` gaps.
- Do not add animation, copy, dependencies, API calls, or persistent state.
- Do not create a Git commit unless the user explicitly asks for one.

---

### Task 1: Replace the solid Premium outline with segmented colour arcs

**Files:**

- Modify: `src/styles/main.css:310-322`
- Test: `src/shared/components/__tests__/AppShell.test.ts`

**Interfaces:**

- Consumes: Existing `.app-top-bar__avatar--premium` class, rendered only for `hasPremiumEntitlement: true`.
- Produces: Four static, separated colour arcs beneath the existing avatar content, while preserving profile-link interaction.

- [ ] **Step 1: Replace the solid border with a conic gradient**

In `src/styles/main.css`, retain the current selector, position, inset, border radius, content, and pointer-events. Replace the `border` declaration in the pseudo-element with this background:

```css
.app-top-bar__avatar--premium::before {
  position: absolute;
  inset: 1px;
  background: conic-gradient(
    from -45deg,
    #4285f4 0deg 88deg,
    var(--color-surface) 88deg 92deg,
    #ea4335 92deg 178deg,
    var(--color-surface) 178deg 182deg,
    #fbbc05 182deg 268deg,
    var(--color-surface) 268deg 272deg,
    #34a853 272deg 358deg,
    var(--color-surface) 358deg 360deg
  );
  border-radius: inherit;
  content: '';
  pointer-events: none;
}
```

- [ ] **Step 2: Run the existing entitlement-condition test**

Run: `npm test -- src/shared/components/__tests__/AppShell.test.ts`

Expected: PASS. The class remains present only with `hasPremiumEntitlement: true`; Free and unresolved states have no ring.

- [ ] **Step 3: Manually verify the visual states**

Run: `npm run dev`

Verify at mobile width:

1. An active Premium entitlement shows four crisp blue, red, yellow, and green arcs around the avatar without covering initials or the avatar colour.
2. The arcs have small surface-colour gaps and do not read as a single blended ring.
3. Free or unresolved entitlement states retain the unmodified avatar, and tapping the avatar still opens Settings.

- [ ] **Step 4: Run validation**

Run:

```bash
npm run build
npm run check
```

Expected: the build succeeds; report any pre-existing full-check failures separately from this change.
