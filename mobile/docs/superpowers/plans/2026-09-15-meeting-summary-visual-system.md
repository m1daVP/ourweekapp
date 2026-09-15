# Meeting Summary Visual System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the Review and finish screen and completed-meeting Summary page with the approved padded-card visual system and a reusable meeting disclosure panel.

**Architecture:** Extract the established persistent-grid disclosure pattern from `MeetingSectionStep` into a feature component with header and content slots. Use that component in the meeting step and review notes, then limit presentation changes to scoped Review styles and the existing Summary selectors in `main.css`; all meeting, AI, sharing, and navigation state remains unchanged.

**Tech Stack:** Vue 3 Composition API, TypeScript, vue-i18n, CSS custom properties, Vue Test Utils, Vitest.

## Global Constraints

- Retain current horizontal page padding; no summary cards or controls may become edge-to-edge.
- Do not change top-bar header font sizes.
- Preserve existing task, agreement, note, AI, sharing, and navigation behaviour.
- Use semantic buttons, 44 px minimum touch targets, explicit accessible labels, and visible focus states.
- Use transform and opacity for disclosure motion; retain reduced-motion support.
- Add no dependencies.

---

### Task 1: Extract the reusable meeting disclosure panel

**Files:**

- Create: `src/features/meeting/components/MeetingDisclosurePanel.vue`
- Modify: `src/features/meeting/components/MeetingSectionStep.vue`
- Modify: `src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`
- Create: `src/features/meeting/components/__tests__/MeetingDisclosurePanel.test.ts`

**Interfaces:**

- Consumes: `open: boolean`, `label: string`, `controls: string`, and optional `disabled?: boolean`.
- Produces: `toggle` event; `leading`, `status`, and default content slots. Its root contains one warm outlined shell and a persistent, inert-when-closed reveal wrapper.

- [ ] **Step 1: Write a failing disclosure-panel interaction test**

```ts
it('keeps content mounted, inert, and zero-height until opened', async () => {
  const wrapper = mount(MeetingDisclosurePanel, {
    props: { open: false, label: 'Examples', controls: 'examples-panel' },
    slots: { default: '<p>Example content</p>' },
  });

  expect(wrapper.get('#examples-panel').attributes('inert')).toBeDefined();
  await wrapper.get('button').trigger('click');
  expect(wrapper.emitted('toggle')).toEqual([[]]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingDisclosurePanel.test.ts`

Expected: FAIL because `MeetingDisclosurePanel.vue` does not exist.

- [ ] **Step 3: Implement the component and move meeting-step disclosures to it**

```vue
<MeetingDisclosurePanel
  :open="examplesOpen"
  :label="t('meeting.needExample')"
  controls="meeting-examples-panel"
  @toggle="examplesOpen = !examplesOpen"
>
  <template #leading><span class="material-symbols-outlined">auto_awesome</span></template>
  <div class="meeting-conversation__example-panel">...</div>
</MeetingDisclosurePanel>
```

Keep the existing examples and alternate-capture state and events. Move the warm border, chevron, persistent grid reveal, and reduced-motion rules out of `MeetingSectionStep` into the new component.

- [ ] **Step 4: Run disclosure and meeting-step tests**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingDisclosurePanel.test.ts src/features/meeting/components/__tests__/MeetingSectionStep.test.ts`

Expected: PASS.

### Task 2: Rebuild the Review and finish visual hierarchy

**Files:**

- Modify: `src/features/meeting/components/MeetingReviewCloseStep.vue`
- Create: `src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

**Interfaces:**

- Consumes: existing Review props and events unchanged plus `MeetingDisclosurePanel` from Task 1.
- Produces: card-contained tasks, agreements, and notes; notes use `areNotesExpanded` with `MeetingDisclosurePanel` and retain current edit/delete events.

- [ ] **Step 1: Write failing Review markup tests**

```ts
it('uses the shared disclosure for notes instead of a standalone toggle', () => {
  const wrapper = mountReview({ allNotes: [note] });
  expect(wrapper.findComponent(MeetingDisclosurePanel).exists()).toBe(true);
  expect(wrapper.find('.review-close-edit[aria-expanded]').exists()).toBe(
    false
  );
});

it('keeps note actions in one fixed right-side column', () => {
  const wrapper = mountReview({ allNotes: [note] });
  expect(
    wrapper.get('.review-close-item-actions').findAll('button')
  ).toHaveLength(2);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

Expected: FAIL because the reusable disclosure is not rendered.

- [ ] **Step 3: Implement the reference hierarchy without changing data flow**

Use the shared disclosure for the Notes card. Keep `notesBySection`, `areNotesExpanded`, item counts, capture emits, task toggles, and edit/delete emits. Update scoped styles for: compact progress row; centered check hero; padded white section cards; icon/title/count header; task responsibility chip; agreement and note rows; peach count badge; contained capture-prompt card; and inset bottom dock. Do not alter `.review-close-top-bar h1` font size.

- [ ] **Step 4: Run the focused Review test**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

Expected: PASS.

### Task 3: Apply the shared system to completed-meeting summary

**Files:**

- Modify: `src/pages/MeetingSummaryPage.vue`
- Modify: `src/styles/main.css:5274-5794`
- Modify: `src/pages/__tests__/MeetingSummaryPage.test.ts` or create it if absent

**Interfaces:**

- Consumes: existing `SummaryViewModel`, AI state computed values, share handlers, participant avatars, and full-notes route.
- Produces: unchanged data and actions presented through inset cards, compact rows, and the shared typography scale.

- [ ] **Step 1: Write failing Summary structure tests**

```ts
it('keeps summary sections inside the padded content area', () => {
  const wrapper = mountSummaryWithMeeting();
  expect(
    wrapper.get('.meeting-summary-content').findAll('.meeting-summary-section')
      .length
  ).toBeGreaterThan(0);
  expect(wrapper.get('.meeting-summary-bottom-action').classes()).toContain(
    'floating-bottom-block'
  );
});
```

- [ ] **Step 2: Run the focused test to verify it fails or exposes the old hierarchy**

Run: `npx vitest run src/pages/__tests__/MeetingSummaryPage.test.ts`

Expected: FAIL if the test is newly added, or PASS only after updating the expected revised semantic structure.

- [ ] **Step 3: Implement the summary-page presentation update**

Keep `MeetingSummaryPage` state and handlers unchanged. Add structural class hooks only where needed for title/icon/badge headers and readable decision/action rows. In `main.css`, replace only meeting-summary selectors with the approved warm background, padded card spacing, smaller body scale, restrained icon/badge treatments, non-full-width controls, and inset share dock. Leave `.meeting-summary-top-bar h1` font size unchanged.

- [ ] **Step 4: Run the focused Summary test**

Run: `npx vitest run src/pages/__tests__/MeetingSummaryPage.test.ts`

Expected: PASS.

### Task 4: Validate the visual-system integration

**Files:**

- Modify only if validation reveals a defect: files from Tasks 1–3.

**Interfaces:**

- Consumes: completed disclosure, Review, and Summary implementations.
- Produces: interaction-preserving, responsive summary screens that respect motion preferences and fit inside current page padding.

- [ ] **Step 1: Run focused component and page tests together**

Run: `npx vitest run src/features/meeting/components/__tests__/MeetingDisclosurePanel.test.ts src/features/meeting/components/__tests__/MeetingSectionStep.test.ts src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts src/pages/__tests__/MeetingSummaryPage.test.ts`

Expected: PASS.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Run project checks**

Run: `npm run check`

Expected: PASS, or report only unrelated pre-existing failures by path.

## Self-review

- Spec coverage: Task 1 supplies one reusable dropdown; Task 2 covers the Review screen’s typography, card layout, notes disclosure, capture panel, and controls; Task 3 covers the completed Summary page; Task 4 verifies both surfaces.
- Placeholder scan: no undefined component API or unfinished implementation step remains.
- Type consistency: `MeetingDisclosurePanel` uses `open`, `label`, `controls`, and `toggle` consistently across Tasks 1 and 2.
