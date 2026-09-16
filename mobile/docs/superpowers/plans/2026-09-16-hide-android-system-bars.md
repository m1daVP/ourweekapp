# Hide Android System Bars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the Android status and navigation bars whenever the native OurWeek application is running.

**Architecture:** Configure Capacitor 8's bundled `SystemBars` API declaratively in the existing Capacitor configuration. Keep CSS inset injection enabled so the mobile UI can continue respecting cutouts and gesture areas without custom Java lifecycle code.

**Tech Stack:** Capacitor 8.5, TypeScript, Vue 3, Android

## Global Constraints

- Hide both the status bar and navigation bar on native application startup.
- Keep `insetsHandling` set to `css`.
- Do not add a dependency or custom Java implementation.
- Do not change the splash-screen full-screen behavior.
- Preserve all unrelated working-tree changes.
- Do not create a Git commit unless the user explicitly requests one.

---

### Task 1: Configure and verify immersive system bars

**Files:**

- Modify: `capacitor.config.ts`

**Interfaces:**

- Consumes: Capacitor's existing `plugins` configuration object.
- Produces: `plugins.SystemBars` with `{ hidden: true, insetsHandling: 'css' }`.

- [x] **Step 1: Add the SystemBars configuration**

Add this sibling entry inside the existing `plugins` object:

```ts
SystemBars: {
  hidden: true,
  insetsHandling: 'css',
},
```

- [x] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript checking and the Vite production build both complete successfully.

- [ ] **Step 3: Run formatting and lint checks**

Run: `npm run check`

Expected: Prettier validation and ESLint both complete successfully.

Current result: Task files pass Prettier. Project-wide checks remain blocked by unrelated formatting violations and 17 existing unused-variable ESLint errors in meeting-flow files.

- [x] **Step 4: Sync the Android native project**

Run: `npx cap sync android`

Expected: Capacitor copies the current web build and updates the Android project without errors.

- [ ] **Step 5: Perform real-device verification**

Launch the synchronized Android app on a physical device. Confirm that the status and navigation bars are hidden after startup, an edge swipe can reveal them temporarily, and important controls remain clear of cutouts and gesture regions.
