# Review Card Action Stack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stack review-card edit and delete actions vertically, with edit above delete.

**Architecture:** Task controls will use the existing shared action wrapper used by notes and agreements. One CSS direction change makes all review card action groups vertical.

**Tech Stack:** Vue 3, scoped CSS, Vitest, Vue Test Utils.

## Global Constraints

- Preserve accessible labels and touch targets.
- Do not change task completion controls or action behavior.
- Do not add dependencies.

---

### Task 1: Unify review action layout

**Files:**

- Modify: `src/features/meeting/components/MeetingReviewCloseStep.vue`
- Test: `src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

**Interfaces:**

- Consumes: existing edit and delete events.
- Produces: a `.review-close-item-actions` column with edit then delete controls for tasks, agreements, and notes.

- [ ] **Step 1: Add grouping assertion**

Assert the rendered task edit and delete controls share a `.review-close-item-actions` parent.

- [ ] **Step 2: Wrap task controls and use a column layout**

Place task edit/delete buttons in the shared wrapper and set its `flex-direction` to `column`.

- [ ] **Step 3: Verify**

Run: `npm exec vitest run src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts && npm run build`

Expected: PASS.
