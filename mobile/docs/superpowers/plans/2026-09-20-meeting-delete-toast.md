# Meeting Delete Toast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the delete-recovery action fully visible in narrow mobile meeting toasts by using an icon-only undo button and a shrinkable message column.

**Architecture:** Leave the toast state and action callback unchanged. `AppShell.vue` renders the existing action as a labelled `undo` icon button, while `main.css` reserves a fixed action column in a two-column grid and allows only the message column to wrap.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vitest, Vue Test Utils, CSS grid, Material Symbols.

## Global Constraints

- Scope the change to shared web action toasts; do not change deletion, restoration, timing, native toasts, or other notifications.
- Keep the action a 48px touch target with a descriptive accessible label.
- Preserve the incumbent warm pill styling, elevation, bottom safe-area offset, and no-blur appearance.
- Use semantic buttons and the existing `toastState.action.label` as the action’s accessible name.
- Do not add dependencies or commit changes unless the user explicitly requests a commit.

---

## File structure

- Modify `src/shared/components/AppShell.vue` — render action-based toasts with an accessible Material `undo` button.
- Modify `src/styles/main.css` — make the toast a grid with a shrinkable/wrapping content column and fixed action column.
- Modify `src/shared/components/__tests__/AppShell.test.ts` — verify the action icon and existing recovery callback behavior.

### Task 1: Test and render the icon-only undo action

**Files:**

- Modify: `src/shared/components/AppShell.vue:228-251`
- Modify: `src/shared/components/__tests__/AppShell.test.ts:5-57, 125-175`

**Interfaces:**

- Consumes: existing `toastState.action`, `{ label: string; onClick: () => void }`.
- Produces: an `.app-toast__action` button whose text is `undo`, whose `aria-label` is `toastState.action.label`, and whose click preserves `handleToastAction(toastState.action.onClick)`.

- [x] **Step 1: Write the failing AppShell test**

Add these fields to the existing hoisted `state` object, then replace the toast mock so it can render a reactive toast:

```ts
dismissToast: vi.fn(),
toastState: {
  __v_isRef: true,
  value: null as null | Record<string, unknown>,
},

vi.mock('@/shared/composables/useToast', () => ({
  useToast: () => ({
    dismissToast: state.dismissToast,
    showToast: vi.fn(),
    toastState: state.toastState,
  }),
}));
```

Add this test and reset `state.toastState.value` plus `state.dismissToast` in `beforeEach`:

```ts
it('uses a labelled undo icon for a toast action', async () => {
  const undo = vi.fn();
  state.toastState.value = {
    action: { label: 'Undo deletion', onClick: undo },
    id: 1,
    loading: false,
    message: 'Note deleted.',
    persistent: false,
    tone: 'status',
  };

  const wrapper = mountAppShell();
  const action = wrapper.get('[aria-label="Undo deletion"]');

  expect(action.classes()).toContain('app-toast__action');
  expect(action.text()).toBe('undo');
  await action.trigger('click');
  expect(undo).toHaveBeenCalledOnce();
  expect(state.dismissToast).toHaveBeenCalledOnce();
});
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `npm exec -- vitest run src/shared/components/__tests__/AppShell.test.ts`

Expected: FAIL because the current action renders its textual label rather than `undo` and does not expose that label as `aria-label`.

- [x] **Step 3: Render the Material undo icon while preserving the callback**

Replace the action button body and attributes in `AppShell.vue` with:

```vue
<button
  v-if="toastState.action"
  type="button"
  class="app-toast__action material-symbols-outlined"
  :aria-label="toastState.action.label"
  @click="handleToastAction(toastState.action.onClick)"
>
  undo
</button>
```

Do not alter the current `v-else-if` dismiss button or `handleToastAction` implementation.

- [x] **Step 4: Run the focused test to verify it passes**

Run: `npm exec -- vitest run src/shared/components/__tests__/AppShell.test.ts`

Expected: PASS; the action uses the labelled undo icon, invokes recovery, and dismisses the toast.

### Task 2: Make the toast layout overflow-safe at mobile widths

**Files:**

- Modify: `src/styles/main.css:584-656`

**Interfaces:**

- Consumes: `.app-toast`, `.app-toast__content`, and `.app-toast__action` from `AppShell.vue`.
- Produces: an action toast that stays inside `width: min(calc(100vw - 48px), calc(var(--container-max-width) - 48px))` at a 360px viewport.

- [x] **Step 1: Change the toast container to an explicit two-column grid**

Replace the flex layout declarations with:

```css
.app-toast {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}
```

Keep its current fixed position, width, min-height, border, radius, background, padding, typography, shadow, and transform declarations unchanged.

- [x] **Step 2: Allow the message to shrink and wrap while keeping the action fixed**

Add these declarations to the existing selectors:

```css
.app-toast__content {
  display: flex;
  min-width: 0;
  overflow-wrap: anywhere;
}

.app-toast__action {
  width: 48px;
  min-width: 48px;
  height: 48px;
  min-height: 48px;
  padding: 0;
}
```

Retain spinner alignment and spacing. Remove the old action-only `width: auto`, `min-width: 64px`, horizontal padding, display-font declaration, and label-specific font weight because the icon inherits the Material Symbols font from its class.

- [ ] **Step 3: Check the rendered layout at a 360px viewport**

Open an action toast with the Ukrainian recovery label in a 360px-wide mobile preview. Verify the toast stays within its 24px side margins, its message can wrap, the undo icon is fully visible and tappable, and no page blur or horizontal page scroll appears.

### Task 3: Verify the completed toast refinement

**Files:**

- Verify: `src/shared/components/AppShell.vue`
- Verify: `src/styles/main.css`
- Verify: `src/shared/components/__tests__/AppShell.test.ts`

**Interfaces:**

- Consumes: completed Tasks 1–2.
- Produces: a verified, mobile-safe recovery toast.

- [x] **Step 1: Run the focused AppShell test**

Run: `npm exec -- vitest run src/shared/components/__tests__/AppShell.test.ts`

Expected: PASS.

- [ ] **Step 2: Run project verification**

Run: `npm run build`

Expected: PASS with Vue/TypeScript compilation and Vite build completing without errors.

Run: `npm run check`

Expected: PASS with Prettier and ESLint reporting no violations.

- [x] **Step 3: Run the required UI design detector once**

Run: `.agents/skills/impeccable/scripts/impeccable.cmd detect --json src/shared/components/AppShell.vue src/styles/main.css`

Expected: no blocking detector findings. If it reports an actionable issue, fix the relevant style or markup and rerun this detector once.
