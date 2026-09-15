# Review Item Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make note and agreement editing use the same composer bottom sheets as adding those items.

**Architecture:** Generalize `MeetingItemComposer` edit mode from task-only to a discriminated edit payload for tasks, notes, and agreements. `MeetingPage` will retain a scope for the selected item and pass the existing update action through a matching callback.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vitest, Vue Test Utils.

## Global Constraints

- Use Vue 3 Composition API with `<script setup lang="ts">`.
- Reuse existing mobile bottom-sheet components and do not add dependencies.
- Retain existing meeting permissions and local-first update behavior.

---

### Task 1: Generalize composer edit mode

**Files:**

- Modify: `src/features/meeting/components/MeetingItemComposer.vue`
- Test: `src/features/meeting/components/__tests__/MeetingItemComposer.test.ts`

**Interfaces:**

- Consumes: typed note, agreement, and task values from `MeetingPage`.
- Produces: a prefilled edit composer that saves the matching item type through its callback.

- [ ] **Step 1: Add failing composer tests**

Mount the composer as an open note editor and agreement editor. Assert the primary textarea contains the supplied note text or agreement text.

- [ ] **Step 2: Run the focused test**

Run: `npm exec vitest run src/features/meeting/components/__tests__/MeetingItemComposer.test.ts`

Expected: FAIL because the component only recognizes `editTask`.

- [ ] **Step 3: Implement typed note and agreement edit handling**

Replace task-only edit detection with a discriminated edit input, initialize the composer fields from the selected item, choose the relevant edit title, and submit the edited fields through the matching callback.

- [ ] **Step 4: Verify focused tests**

Run: `npm exec vitest run src/features/meeting/components/__tests__/MeetingItemComposer.test.ts`

Expected: PASS.

### Task 2: Route meeting item edits through the composer

**Files:**

- Modify: `src/pages/MeetingPage.vue`

**Interfaces:**

- Consumes: `openNoteEditor`, `openAgreementEditor`, `saveNoteEdit`, and `saveAgreementEdit` from `useMeetingSession`.
- Produces: composer-backed note and agreement editors for section and review-and-close edit actions.

- [ ] **Step 1: Store selected note and agreement composer scopes**

Create item-specific composer scope refs from the active meeting, item section ID, and item ID. Clear each scope when its editor closes.

- [ ] **Step 2: Bind edit events and composer callbacks**

Route note and agreement edit events to scope-setting wrappers. Replace their legacy bottom sheets with `MeetingItemComposer` instances that receive prefilled edit data and submit through the existing save actions.

- [ ] **Step 3: Run production verification**

Run: `npm run build`

Expected: PASS.
