# Premium Profile Continuous Gradient Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Premium profile indicator a continuous Google-color gradient border rather than a filled colour wheel.

**Architecture:** The active-entitlement class already exists. Its pseudo-element will use a continuous conic gradient, then the avatar's existing inner span will be positioned above it with a stacking index. This keeps the 32px avatar opaque over the gradient, leaving only a thin 3px ring visible.

**Tech Stack:** Vue 3, CSS custom properties, Vue Test Utils, Vitest.

## Global Constraints

- Preserve the trusted existing `hasPremiumEntitlement` condition; it alone controls the Premium modifier.
- Preserve the 40px mobile header profile slot, Settings link, accessible label, and existing 32px avatar.
- Use a continuous static Google blue `#4285f4`, red `#ea4335`, yellow `#fbbc05`, and green `#34a853` conic gradient.
- Explicitly layer the avatar above the pseudo-element.
- Do not add animation, copy, dependencies, API calls, persistent state, or a Git commit.

---

### Task 1: Render the continuous gradient behind the avatar

**Files:**

- Modify: `src/styles/main.css:310-336`
- Test: `src/shared/components/__tests__/AppShell.test.ts`

**Interfaces:**

- Consumes: `.app-top-bar__avatar--premium`, present only for an active entitlement.
- Produces: A continuous, 3px visual gradient border that does not cover the avatar or affect Settings-link interaction.

- [ ] **Step 1: Make the pseudo-element a continuous gradient ring background**

Replace the segmented `background` in `.app-top-bar__avatar--premium::before` with the continuous gradient below. Keep the selector's current position, inset, radius, content, and pointer-events declarations unchanged.

```css
background: conic-gradient(
  from 45deg,
  #4285f4,
  #ea4335,
  #fbbc05,
  #34a853,
  #4285f4
);
```

- [ ] **Step 2: Put avatar content above the gradient layer**

Add these declarations to the existing `.app-top-bar__avatar span` rule:

```css
position: relative;
z-index: 1;
```

The span's existing solid avatar background covers the centre of the pseudo-element; with a 38px pseudo-element and 32px span, the visible gradient border is 3px wide.

- [ ] **Step 3: Run the focused entitlement-condition test**

Run: `npm exec vitest -- run src/shared/components/__tests__/AppShell.test.ts`

Expected: PASS. The Premium modifier class remains limited to `hasPremiumEntitlement: true`.

- [ ] **Step 4: Verify the rendered state at mobile width**

Run: `npm run dev`

Verify that a Premium avatar shows its initials and avatar background above a thin, unbroken blue-red-yellow-green border. Verify the Free avatar remains plain and the profile circle still opens Settings.

- [ ] **Step 5: Run validation**

Run:

```bash
npm run build
npm run check
```

Expected: build succeeds; report unrelated full-check failures separately.
