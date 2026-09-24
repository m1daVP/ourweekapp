# Premium Profile Ring Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slow, continuous rotation to the active Premium profile gradient ring without moving the avatar.

**Architecture:** Apply a 36-second linear transform animation exclusively to the existing gradient pseudo-element. An existing global reduced-motion media query will override the animation for users who request less motion. The entitlement class and the avatar stacking layer stay unchanged.

**Tech Stack:** CSS animations, Vue Test Utils, Vitest.

## Global Constraints

- The ring remains limited to the trusted existing `hasPremiumEntitlement` condition.
- Animate only `.app-top-bar__avatar--premium::before`; initials, avatar colour, link target, and layout remain still.
- Use a 36-second linear infinite rotation.
- Disable animation under `prefers-reduced-motion: reduce`.
- Do not add dependencies, copy, API calls, state, or a Git commit.

---

### Task 1: Animate the Premium gradient layer accessibly

**Files:**

- Modify: `src/styles/main.css:310-336,5200-5233`
- Test: `src/shared/components/__tests__/AppShell.test.ts`

**Interfaces:**

- Consumes: Existing `.app-top-bar__avatar--premium::before` conic-gradient layer.
- Produces: A slow rotating gradient ring that is static for reduced-motion users.

- [ ] **Step 1: Add a scoped rotation keyframe and animation**

Add the animation declaration to the existing pseudo-element and define a named keyframe nearby:

```css
.app-top-bar__avatar--premium::before {
  animation: premium-profile-ring-rotate 36s linear infinite;
}

@keyframes premium-profile-ring-rotate {
  to {
    transform: rotate(1turn);
  }
}
```

- [ ] **Step 2: Respect reduced-motion preferences**

Within the existing `@media (prefers-reduced-motion: reduce)` block, add:

```css
.app-top-bar__avatar--premium::before {
  animation: none;
}
```

- [ ] **Step 3: Run the entitlement-condition test**

Run: `npm exec vitest -- run src/shared/components/__tests__/AppShell.test.ts`

Expected: PASS. The animation target remains absent for Free users because the Premium modifier class is absent.

- [ ] **Step 4: Verify and build**

Run:

```bash
npm exec prettier -- --check src/styles/main.css
npm run build
```

Expected: both commands exit successfully. At mobile width, Premium users see only the gradient ring rotate; reduced-motion users see no rotation.
