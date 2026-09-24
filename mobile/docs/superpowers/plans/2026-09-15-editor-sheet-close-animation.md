# Editor Sheet Close Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the bottom-sheet close animation for every edited meeting item.

**Architecture:** Keep the edit scope refs alive while the editor closes. Clear them from each composer's existing `after-close` event, exactly as add composers retain their rendered scope.

**Tech Stack:** Vue 3 Composition API, Vue transitions, Vitest.

## Global Constraints

- Preserve close behavior and Android-back handling.
- Do not add dependencies.
- Do not change saved item behavior.

---

### Task 1: Delay edit composer cleanup

**Files:**

- Modify: `src/pages/MeetingPage.vue`

**Interfaces:**

- Consumes: `MeetingItemComposer` `close` and `after-close` events.
- Produces: mounted edit composer instances through their close transition.

- [ ] **Step 1: Split close state from scope cleanup**

Keep each `close*EditorFromMeeting` handler limited to closing the meeting-session editor. Add after-close cleanup handlers that reset the matching scope ref.

- [ ] **Step 2: Bind `after-close` for each edit composer**

Attach the matching cleanup handler to task, note, and agreement `MeetingItemComposer` instances.

- [ ] **Step 3: Verify**

Run: `npm run build`

Expected: PASS.
