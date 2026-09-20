# In-meeting Task Responsibility Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the resolved assignee/responsibility label on task cards during an active meeting.

**Architecture:** `MeetingSectionStep` already supplies enriched tasks whose `responsibilityLabel` has been resolved by `useMeetingSession`. `MeetingItemCard` will accept that optional field on its task input and render it as task metadata without importing the composable or resolving participant state itself.

**Tech Stack:** Vue 3 Composition API, TypeScript, vue-i18n, Vitest, Vue Test Utils.

## Global Constraints

- Keep `MeetingItemCard` compatible with un-enriched `MeetingTask` values.
- Use semantic markup and a mobile-readable secondary metadata treatment.
- Do not add dependencies or duplicate responsibility-resolution logic.
- Do not commit unless the user explicitly asks for a commit.

---

## File structure

- Modify: `src/features/meeting/components/MeetingItemCard.vue` — widen its task input shape and render responsibility metadata.
- Modify: `src/features/meeting/components/__tests__/MeetingItemCard.test.ts` — prove the active-meeting card displays an enriched task label and does not produce empty metadata for plain tasks.

### Task 1: Render responsibility metadata in the generic meeting item card

**Files:**

- Modify: `src/features/meeting/components/MeetingItemCard.vue:10-35, 65-78, 111-124`
- Test: `src/features/meeting/components/__tests__/MeetingItemCard.test.ts`

**Interfaces:**

- Consumes: `MeetingTask & { responsibilityLabel?: string }` supplied by `MeetingSectionStep`.
- Produces: A `.meeting-item-card__responsibility` element only when a task has a non-empty resolved label.

- [ ] **Step 1: Write the failing task-card test**

Add this test after the existing task action-menu test:

```ts
it('shows an enriched task responsibility label', () => {
  const wrapper = mount(MeetingItemCard, {
    props: {
      editable: false,
      type: 'task',
      item: {
        id: 'task-1',
        sectionId: 'tasks',
        title: 'Buy fruit',
        responsibilityType: 'participant',
        responsibleParticipantIds: ['participant-1'],
        responsibilityLabel: 'Rita',
        status: 'open',
        createdAt: '2026-09-14T10:00:00.000Z',
        updatedAt: '2026-09-14T10:00:00.000Z',
      },
    },
  });

  expect(wrapper.get('.meeting-item-card__responsibility').text()).toBe('Rita');
  wrapper.unmount();
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm exec vitest run src/features/meeting/components/__tests__/MeetingItemCard.test.ts`

Expected: FAIL because `.meeting-item-card__responsibility` is absent.

- [ ] **Step 3: Add a compatible enriched-task shape and metadata markup**

In `MeetingItemCard.vue`, define and use this local input type:

```ts
type MeetingItemCardTask = MeetingTask & {
  responsibilityLabel?: string;
};

const props = defineProps<{
  item: Agreement | MeetingNote | MeetingItemCardTask;
  type: 'agreement' | 'note' | 'task';
  editable: boolean;
}>();
```

Update `taskItem` to return `MeetingItemCardTask | null`, then replace the empty responsibility placeholder comment with:

```vue
<small
  v-if="taskItem?.responsibilityLabel"
  class="meeting-item-card__responsibility"
>
  {{ taskItem.responsibilityLabel }}
</small>
```

Keep it before the due-date metadata. Add scoped CSS that makes the label an inline-block, softly tinted pill with the project label font size and sufficient contrast:

```css
.meeting-item-card__responsibility {
  display: inline-block;
  margin: 6px 6px 0 0;
  border-radius: 8px;
  background: #eef4ef;
  padding: 2px 8px;
  color: #5d705f;
  font-size: var(--font-size-label-sm);
  font-weight: 650;
  line-height: 1.2;
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm exec vitest run src/features/meeting/components/__tests__/MeetingItemCard.test.ts`

Expected: PASS, including the new responsibility-label assertion and existing menu-action assertions.

- [ ] **Step 5: Verify no empty label is rendered for a plain task**

Add this assertion to the existing plain task test that uses `responsibilityType: 'needsDiscussion'` without `responsibilityLabel`:

```ts
expect(wrapper.find('.meeting-item-card__responsibility').exists()).toBe(false);
```

Run: `npm exec vitest run src/features/meeting/components/__tests__/MeetingItemCard.test.ts`

Expected: PASS.

- [ ] **Step 6: Run project validation**

Run: `npm run build`

Expected: PASS with no TypeScript or Vite errors.

Run: `npm run check`

Expected: PASS with formatting and ESLint checks clean.
