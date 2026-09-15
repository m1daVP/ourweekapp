# Meeting Step Control Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw example and alternative-capture controls in a meeting step with accessible OurWeek-styled controls.

**Architecture:** Keep the existing local Boolean state and `capture` event interface in `MeetingSectionStep`. Replace native `<details>/<summary>` with a button-controlled section so behavior and visuals are fully owned by the Vue component.

**Tech Stack:** Vue 3 Composition API, TypeScript, vue-i18n, Vitest, Vue Test Utils.

## Global Constraints

- Keep `capture: [type: MeetingComposerDraftType]` unchanged.
- Reuse existing `meeting-primary` and `secondary-button` styles; add focused scoped styles only.
- Buttons retain native keyboard behavior and provide `aria-expanded` where content is collapsible.
- Do not change meeting data, permissions, copy keys, or navigation behavior.
- Do not add dependencies or create a Git commit without explicit user approval.

---

### Task 1: Replace native meeting-step controls and add regression coverage

**Files:**

- Modify: `src/features/meeting/components/MeetingSectionStep.vue`
- Modify: `src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

**Interfaces:**

- Consumes: `presentation.allowedItemTypes`, `presentation.exampleKeys`, `presentation.primaryCaptureType`, and `emit('capture', type)`.
- Produces: `examplesOpen` and `alternativeCaptureOpen` button-controlled sections without native `details` or `summary` markup.

- [ ] **Step 1: Add a failing visible-control test**

Add this test to `MeetingSectionStep.test.ts`:

```ts
it('uses styled disclosure controls for examples and alternative capture', async () => {
  const wrapper = mountStep();

  expect(wrapper.find('details').exists()).toBe(false);
  expect(wrapper.find('summary').exists()).toBe(false);
  expect(
    wrapper.get('.meeting-conversation__example-toggle').classes()
  ).toContain('secondary-button');

  await wrapper
    .get('.meeting-conversation__alternative-toggle')
    .trigger('click');

  expect(
    wrapper.get('.meeting-conversation__alternative-actions').exists()
  ).toBe(true);
  expect(
    wrapper.get('.meeting-conversation__alternative-actions button').classes()
  ).toContain('secondary-button');
  await wrapper
    .get('.meeting-conversation__alternative-actions button')
    .trigger('click');
  expect(wrapper.emitted('capture')).toEqual([['note']]);
});
```

Set `exampleKeys: ['meeting.presentation.goodThingsExample']` in the test fixture if the existing fixture does not include one.

- [ ] **Step 2: Run the component test to verify it fails**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

Expected: FAIL because the template contains native `details` and the example trigger lacks `secondary-button`.

- [ ] **Step 3: Replace the native disclosure with explicit state and buttons**

Add `const alternativeCaptureOpen = ref(false);`. Add `secondary-button` to the example trigger. Replace the native disclosure with:

```vue
<button
  class="meeting-conversation__alternative-toggle secondary-button"
  type="button"
  :aria-expanded="alternativeCaptureOpen"
  aria-controls="meeting-alternative-capture-actions"
  @click="alternativeCaptureOpen = !alternativeCaptureOpen"
>
  <span>{{ t('meeting.moreWaysToAdd') }}</span>
  <span class="material-symbols-outlined" aria-hidden="true">
    {{ alternativeCaptureOpen ? 'expand_less' : 'expand_more' }}
  </span>
</button>
<div
  v-if="alternativeCaptureOpen"
  id="meeting-alternative-capture-actions"
  class="meeting-conversation__alternative-actions"
>
  <button
    v-for="type in alternativeTypes"
    :key="type"
    class="secondary-button"
    type="button"
    @click="emit('capture', type)"
  >
    {{ captureLabel(type) }}
  </button>
</div>
```

- [ ] **Step 4: Add scoped mobile layout styles**

Style both toggles as touch-safe controls. Use a flex row with `justify-content: space-between` for the alternative toggle and a wrapped `display: flex` group with 8px gaps for alternative actions. Do not override the shared primary or secondary color rules.

- [ ] **Step 5: Run the focused component regression test**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

Expected: PASS; alternative capture still emits `note` and no raw disclosure remains.

- [ ] **Step 6: Verify formatting, lint, and build**

Run: `npx prettier --check src/features/meeting/components/MeetingSectionStep.vue src/features/meeting/components/__tests__/MeetingSectionStep.test.ts && npx eslint src/features/meeting/components/MeetingSectionStep.vue src/features/meeting/components/__tests__/MeetingSectionStep.test.ts && npm run build`

Expected: all commands PASS.

- [ ] **Step 7: Review the scoped diff without committing**

Run: `git -c safe.directory=D:/Projects/myself/weekly-us diff -- src/features/meeting/components/MeetingSectionStep.vue src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

Expected: only the visible control replacement and its test are changed.

## Plan Self-Review

- Spec coverage: Task 1 replaces all raw controls called out in the approved scope while preserving capture and primary navigation behavior.
- Placeholder scan: each step names the exact files, selectors, command, and behavior required.
- Type consistency: alternative actions retain `MeetingComposerDraftType` and the existing `capture` emit signature.
