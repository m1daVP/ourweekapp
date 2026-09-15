# Meeting Step Card Dropdowns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give both optional guided-meeting controls the reference’s compact row and expanded card-panel experience.

**Architecture:** `MeetingSectionStep.vue` owns two independent `ref<boolean>` disclosure states. It retains existing localized text and capture events, replacing only template structure and scoped CSS.

**Tech Stack:** Vue 3 Composition API, TypeScript, scoped CSS, Vitest, Vue Test Utils.

## Global Constraints

- Keep `capture: [type: MeetingComposerDraftType]` and localized keys unchanged.
- Use semantic buttons, `aria-expanded`, `aria-controls`, and 44px minimum tap targets.
- Do not change primary action, bottom navigation, data, or permissions.
- Do not add dependencies or commit without explicit approval.

---

### Task 1: Build and test independent card dropdowns

**Files:**
- Modify: `src/features/meeting/components/MeetingSectionStep.vue`
- Modify: `src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

**Interfaces:**
- Consumes: `presentation.exampleKeys`, `alternativeTypes`, and `emit('capture', type)`.
- Produces: `examplesOpen` and `alternativeCaptureOpen` accessible card-panel controls.

- [ ] **Step 1: Add regression tests**

Assert both controls begin collapsed, expose `aria-expanded="false"`, reveal their respective `meeting-conversation__example-panel` or `meeting-conversation__alternative-panel` when clicked, and leave the other control collapsed. Assert the note and agreement cards use existing capture event values.

- [ ] **Step 2: Run the focused test**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

Expected: FAIL because current controls use generic secondary actions rather than both card panels.

- [ ] **Step 3: Replace optional-control markup**

For each optional section, render a `meeting-conversation__optional-panel` container. Its header button contains the semantic icon, label, and chevron. When expanded, examples render as cards/list items and alternative types render as button cards:

```vue
<button class="meeting-conversation__optional-toggle" type="button"
  :aria-expanded="examplesOpen" aria-controls="meeting-examples-panel"
  @click="examplesOpen = !examplesOpen">
  <span class="meeting-conversation__optional-icon material-symbols-outlined">auto_awesome</span>
  <span>{{ t('meeting.needExample') }}</span>
  <span class="material-symbols-outlined">{{ examplesOpen ? 'expand_less' : 'expand_more' }}</span>
</button>
```

Render alternative cards with `edit_note` and `task_alt` based on type, preserving `@click="emit('capture', type)"`.

- [ ] **Step 4: Add scoped reference-matching styles**

Use an outlined `--radius-xl` panel, a compact collapsed header, a soft circular icon background, and a two-column grid of white card buttons with subtle shadows in expanded state. Keep cards at least 132px high and stack them if the viewport is narrower than 340px.

- [ ] **Step 5: Run tests and verification**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingSectionStep.test.ts && npx prettier --check src/features/meeting/components/MeetingSectionStep.vue src/features/meeting/components/__tests__/MeetingSectionStep.test.ts && npm run build && npm run cap:sync`

Expected: PASS and Android assets include the card-dropdown bundle.

## Plan Self-Review

- Spec coverage: the one focused task covers collapsed/expanded appearance, capture behavior, independent state, accessibility, tests, build, and Android sync.
- Placeholder scan: exact component, selectors, DOM behavior, commands, and icon treatment are specified.
- Type consistency: existing `MeetingComposerDraftType` values and capture event signature are unchanged.
