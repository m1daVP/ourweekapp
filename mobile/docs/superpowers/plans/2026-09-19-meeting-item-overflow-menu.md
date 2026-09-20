# Meeting Item Overflow Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline Edit/Delete controls in the live meeting flow with a reusable, anchored three-dots action menu that does not obscure the page.

**Architecture:** Add a shared `AnchoredActionMenu` that owns its trigger, viewport-aware fixed positioning, focus management, outside-click dismissal, Escape handling, and Android Back handling. Keep item mutation events in `MeetingItemCard` and `MeetingReviewCloseStep`; those components will supply action labels and translate selected menu IDs into their existing events.

**Tech Stack:** Vue 3 Composition API, TypeScript, vue-i18n, Vitest, Vue Test Utils, Capacitor Android Back helper, scoped CSS.

## Global Constraints

- Keep the application mobile-only; every overflow trigger and menu action must have at least a 48px touch target.
- Preserve the warm, elevated-surface visual system: 16px radius, subtle tinted shadow, visible keyboard focus, and no scrim or blur.
- Use `<script setup lang="ts">`, explicit types, semantic button/menu elements, and i18n for all new visible or accessible copy.
- Use `registerAndroidBackHandler` so Android Back dismisses the open item menu before router navigation.
- Do not change existing edit, delete, task-toggle, authorization, completion-state, or delete-confirmation behavior.
- Do not add dependencies or commit changes unless the user explicitly requests a commit.

---

## File structure

- Create `src/shared/components/AnchoredActionMenu.vue` — reusable trigger plus a compact teleported popup that is positioned next to its trigger.
- Create `src/shared/components/__tests__/AnchoredActionMenu.test.ts` — unit coverage for action selection, outside dismissal, and menu accessibility.
- Modify `src/features/meeting/components/MeetingItemCard.vue` — replace its vertical inline buttons with `AnchoredActionMenu` and retain existing emits.
- Modify `src/features/meeting/components/MeetingReviewCloseStep.vue` — use the shared menu for task, agreement, and note rows while retaining all current events.
- Modify `src/features/meeting/components/__tests__/MeetingItemCard.test.ts` — assert the overflow trigger and selected actions.
- Modify `src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts` — assert task, agreement, and note menu actions still reach the existing emits.
- Modify `src/features/localization/messages.ts` — add `meeting.itemActionsAria` in English, Ukrainian, and Spanish.

### Task 1: Build and test the shared anchored action menu

**Files:**

- Create: `src/shared/components/AnchoredActionMenu.vue`
- Create: `src/shared/components/__tests__/AnchoredActionMenu.test.ts`

**Interfaces:**

- Produces: `AnchoredActionMenuItem`, `{ id: string; label: string; icon: string; variant?: 'default' | 'destructive' }`.
- Produces: `<AnchoredActionMenu :items="AnchoredActionMenuItem[]" :trigger-label="string" :menu-label="string" @select="(itemId: string) => void" />`.
- Consumes: `registerAndroidBackHandler` from `@/app/composables/useAndroidBackButton`.

- [x] **Step 1: Write the failing component tests**

```ts
it('opens labelled actions and emits the selected action', async () => {
  const wrapper = mount(AnchoredActionMenu, {
    attachTo: document.body,
    props: {
      triggerLabel: 'Open actions for Buy fruit',
      menuLabel: 'Actions for Buy fruit',
      items: [
        { id: 'edit', label: 'Edit', icon: 'edit' },
        {
          id: 'delete',
          label: 'Delete',
          icon: 'delete_outline',
          variant: 'destructive',
        },
      ],
    },
  });

  await wrapper
    .get('[aria-label="Open actions for Buy fruit"]')
    .trigger('click');
  expect(document.querySelector('[role="menu"]')?.textContent).toContain(
    'Edit'
  );
  await document.querySelector<HTMLButtonElement>('[role="menuitem"]')?.click();
  expect(wrapper.emitted('select')).toEqual([['edit']]);
});

it('closes when a pointer event lands outside its trigger and menu', async () => {
  const wrapper = mount(AnchoredActionMenu, {
    attachTo: document.body,
    props: {
      triggerLabel: 'Open actions for Buy fruit',
      menuLabel: 'Actions for Buy fruit',
      items: [{ id: 'edit', label: 'Edit', icon: 'edit' }],
    },
  });

  await wrapper
    .get('[aria-label="Open actions for Buy fruit"]')
    .trigger('click');
  document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
  await nextTick();

  expect(document.querySelector('[role="menu"]')).toBeNull();
});
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/shared/components/__tests__/AnchoredActionMenu.test.ts`

Expected: FAIL because `AnchoredActionMenu.vue` does not yet exist.

- [x] **Step 3: Implement `AnchoredActionMenu.vue`**

```ts
const props = defineProps<{
  items: AnchoredActionMenuItem[];
  triggerLabel: string;
  menuLabel: string;
}>();
const emit = defineEmits<{ select: [itemId: string] }>();

const isOpen = ref(false);
const triggerElement = ref<HTMLButtonElement | null>(null);
const panelElement = ref<HTMLElement | null>(null);
const panelStyle = ref<Record<string, string>>({});

function selectAction(itemId: string) {
  isOpen.value = false;
  emit('select', itemId);
}
```

Render a 48px `more_vert` trigger. Teleport an element with `role="menu"` to `body` only while open; render each action as a labelled `role="menuitem"` button, including destructive styling for `variant: 'destructive'`. On open, calculate a fixed position from `triggerElement.getBoundingClientRect()`, constrain it to the visual viewport margins, and place it above the trigger when it would overflow below. Focus the first enabled menu item after `nextTick`.

Register document `pointerdown` and `keydown` listeners only while open. Close when the pointer target is outside both refs or when Escape is pressed; then restore focus to the trigger. Register one `registerAndroidBackHandler` callback that closes when open and returns `true`, otherwise returns `false`; remove listeners and unregister the handler on unmount. Add scoped CSS for the fixed elevated panel, 48px trigger and actions, destructive text color, and `:focus-visible` treatment. Do not add a scrim, backdrop, filter, or blur.

- [x] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- src/shared/components/__tests__/AnchoredActionMenu.test.ts`

Expected: PASS; the menu opens, emits `edit`, and closes after the outside pointer event.

### Task 2: Convert active meeting item cards and add localized trigger copy

**Files:**

- Modify: `src/features/meeting/components/MeetingItemCard.vue`
- Modify: `src/features/meeting/components/__tests__/MeetingItemCard.test.ts`
- Modify: `src/features/localization/messages.ts`

**Interfaces:**

- Consumes: `AnchoredActionMenu` and `AnchoredActionMenuItem` from `@/shared/components/AnchoredActionMenu.vue`.
- Consumes: `meeting.itemActionsAria` with interpolation parameter `{ item: string }`.
- Produces: Existing `edit`, `delete`, and `toggle-task` emits unchanged.

- [x] **Step 1: Replace the existing card test with overflow-menu expectations**

```ts
it('uses an overflow trigger and emits the selected note action', async () => {
  const wrapper = mount(MeetingItemCard, { props: editableNoteProps });

  expect(wrapper.find('[aria-label="meeting.itemActionsAria"]').exists()).toBe(
    true
  );
  await wrapper.get('[aria-label="meeting.itemActionsAria"]').trigger('click');
  await document
    .querySelector<HTMLButtonElement>('[aria-label="common.edit"]')
    ?.click();

  expect(wrapper.emitted('edit')).toEqual([['note-1']]);
  expect(wrapper.find('.meeting-item-card__actions').exists()).toBe(false);
});
```

Keep the task-toggle assertion and add a deletion selection assertion using the destructively styled `common.delete` menu item.

- [x] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/features/meeting/components/__tests__/MeetingItemCard.test.ts`

Expected: FAIL because the current component still renders the inline actions.

- [x] **Step 3: Add one i18n key in all shipped locales**

Add these entries inside each `meeting` message group in `src/features/localization/messages.ts`:

```ts
// en
itemActionsAria: 'Open actions for {item}',
// uk
itemActionsAria: 'Відкрити дії для {item}',
// es
itemActionsAria: 'Abrir acciones para {item}',
```

- [x] **Step 4: Replace inline controls with the shared menu**

```ts
const itemActions = computed<AnchoredActionMenuItem[]>(() => [
  { id: 'edit', label: t('common.edit'), icon: 'edit' },
  {
    id: 'delete',
    label: t('common.delete'),
    icon: 'delete_outline',
    variant: 'destructive',
  },
]);

function handleActionSelection(actionId: string) {
  if (actionId === 'edit') emit('edit', props.item.id);
  if (actionId === 'delete') emit('delete', props.item.id);
}
```

Import `AnchoredActionMenu`; render it when `editable` is true with `:trigger-label="t('meeting.itemActionsAria', { item: text })"`, `:menu-label="t('meeting.itemActionsAria', { item: text })"`, the computed items, and `@select="handleActionSelection"`. Remove `.meeting-item-card__actions`, `.meeting-item-card__action`, and its delete modifier styles without changing the card or task-toggle layout.

- [x] **Step 5: Run the focused test to verify it passes**

Run: `npm test -- src/features/meeting/components/__tests__/MeetingItemCard.test.ts`

Expected: PASS; the card has one overflow trigger, Edit/Delete remain reachable through the popup, and the existing task toggle still emits its status.

### Task 3: Convert Review & Close item rows to the same menu

**Files:**

- Modify: `src/features/meeting/components/MeetingReviewCloseStep.vue`
- Modify: `src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

**Interfaces:**

- Consumes: `AnchoredActionMenu` and the existing `meeting.itemActionsAria` i18n key.
- Produces: Existing `edit-task`, `delete-task`, `edit-agreement`, `delete-agreement`, `edit-note`, and `delete-note` emits unchanged.

- [x] **Step 1: Extend the Review & Close test for each item type**

```ts
await wrapper
  .get('[aria-label="Open actions for Move the operation"]')
  .trigger('click');
await document.querySelector<HTMLButtonElement>('[aria-label="Edit"]')?.click();
expect(wrapper.emitted('edit-task')).toHaveLength(1);

await wrapper
  .get(
    '[aria-label="Open actions for We will prepare the next day in the evening."]'
  )
  .trigger('click');
await document
  .querySelector<HTMLButtonElement>('[aria-label="Delete"]')
  ?.click();
expect(wrapper.emitted('delete-agreement')).toEqual([['agreement-1']]);
```

Expand the notes disclosure first, then verify its menu emits `edit-note`. Retain the existing task-toggle, capture, notes visibility, and finish assertions. Assert no `.review-close-item-actions` element remains.

- [x] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

Expected: FAIL because the Review & Close rows still expose individual inline action buttons.

- [x] **Step 3: Add action factories and selection handlers**

```ts
const itemActions = computed<AnchoredActionMenuItem[]>(() => [
  { id: 'edit', label: t('common.edit'), icon: 'edit' },
  {
    id: 'delete',
    label: t('common.delete'),
    icon: 'delete_outline',
    variant: 'destructive',
  },
]);

function handleTaskAction(actionId: string, task: EnrichedMeetingTask) {
  if (actionId === 'edit') emit('edit-task', task);
  if (actionId === 'delete') emit('delete-task', task.id);
}

function handleAgreementAction(actionId: string, agreement: EnrichedAgreement) {
  if (actionId === 'edit') emit('edit-agreement', agreement);
  if (actionId === 'delete') emit('delete-agreement', agreement.id);
}

function handleNoteAction(actionId: string, note: EnrichedMeetingNote) {
  if (actionId === 'edit') emit('edit-note', note);
  if (actionId === 'delete') emit('delete-note', note.id);
}
```

Import the shared component and type.

- [x] **Step 4: Render the menu in all three Review & Close lists**

Replace each `review-close-item-actions` `<div>` with this pattern, substituting the current item and its matching selection handler:

```vue
<AnchoredActionMenu
  v-if="canEditTasks && !isCompleted"
  :items="itemActions"
  :trigger-label="t('meeting.itemActionsAria', { item: task.title })"
  :menu-label="t('meeting.itemActionsAria', { item: task.title })"
  @select="handleTaskAction($event, task)"
/>
```

Use `canEditMeeting && !isCompleted` for agreement and note rows, with `agreement.text` or `note.text` as the interpolation value. Remove now-unused `review-close-item-actions`, `.meeting-note-item__edit`, and `review-close-delete` CSS only if those selectors have no other consumers in the component.

- [x] **Step 5: Run the focused test to verify it passes**

Run: `npm test -- src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

Expected: PASS; task, agreement, and note edit/delete selections all emit exactly their pre-existing payloads, while task toggling and the rest of the step remain intact.

### Task 4: Validate the integrated interaction

**Files:**

- Verify: `src/shared/components/AnchoredActionMenu.vue`
- Verify: `src/features/meeting/components/MeetingItemCard.vue`
- Verify: `src/features/meeting/components/MeetingReviewCloseStep.vue`

**Interfaces:**

- Consumes: completed Tasks 1–3.
- Produces: verified mobile-safe meeting item action menus.

- [x] **Step 1: Run all focused component tests together**

Run: `npm test -- src/shared/components/__tests__/AnchoredActionMenu.test.ts src/features/meeting/components/__tests__/MeetingItemCard.test.ts src/features/meeting/components/__tests__/MeetingReviewCloseStep.test.ts`

Expected: PASS.

- [ ] **Step 2: Run project verification**

Run: `npm run build`

Expected: PASS with Vue/TypeScript compilation and Vite build completing without errors.

Run: `npm run check`

Expected: PASS with Prettier and ESLint reporting no violations.

- [x] **Step 3: Run the required UI design detector once**

Run: `.agents/skills/impeccable/scripts/impeccable.cmd detect --json src/shared/components/AnchoredActionMenu.vue src/features/meeting/components/MeetingItemCard.vue src/features/meeting/components/MeetingReviewCloseStep.vue`

Expected: no blocking detector findings. If the detector reports an actionable issue, fix it in the relevant component and rerun this detector once.

- [ ] **Step 4: Perform one manual mobile interaction pass**

Open an editable active meeting step and Review & Close on a phone-sized viewport. Verify every three-dots target is easy to tap, the popup stays inside the viewport, another item trigger closes the previous popup, no page blur appears, and tapping outside/Escape/Android Back closes the popup before navigation. Verify completed meetings and users without edit permission show no trigger.
