# Avatar Color Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the platform-native participant avatar color input with one rich, staged color-picker bottom sheet shared by Android and iOS.

**Architecture:** A focused `AvatarColorPickerSheet` Vue component owns its temporary color draft and wraps iro.js inside the existing `BaseBottomSheet`. `HouseholdMembersSettings` continues to own the participant draft and receives a normalized opaque hex value only after the user selects it.

**Tech Stack:** Vue 3 Composition API, TypeScript, vue-i18n, existing `BaseBottomSheet`, Vitest/happy-dom, `@jaames/iro`.

## Global Constraints

- Use Vue 3 Composition API with `<script setup lang="ts">`.
- Use npm only; add no dependency beyond `@jaames/iro`.
- The app is mobile-only and Android-first while remaining iOS-ready.
- Use the existing bottom-sheet focus, backdrop, and Android-back behavior.
- Avatar colors are opaque lowercase `#rrggbb` values; do not introduce alpha support.
- Keep all user-facing copy translation-ready in English, Ukrainian, and Spanish.
- Do not persist a color until the parent participant form is saved.
- Do not commit unless the user explicitly requests a commit.

---

## File structure

- Create `src/features/participants/utils/avatarColor.ts`: validates and normalizes six-digit opaque hex colors.
- Create `src/features/participants/utils/__tests__/avatarColor.test.ts`: unit coverage for accepted, rejected, and normalized values.
- Create `src/features/participants/components/AvatarColorPickerSheet.vue`: reusable, staged custom-color sheet and iro.js lifecycle wrapper.
- Create `src/features/participants/components/__tests__/AvatarColorPickerSheet.test.ts`: component behavior for staged selection, cancel, and invalid hex input.
- Modify `src/features/participants/components/HouseholdMembersSettings.vue`: open the shared picker and accept its selected value; remove native `type="color"` handling.
- Modify `src/features/localization/messages.ts`: add the three locale strings used by the sheet.
- Modify `src/styles/main.css`: remove the obsolete hidden native-input selector, retaining the custom trigger’s existing visual treatment.
- Modify `package.json` and `package-lock.json`: add the production dependency.

### Task 1: Install the picker and add hex-color normalization

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/features/participants/utils/avatarColor.ts`
- Create: `src/features/participants/utils/__tests__/avatarColor.test.ts`

**Interfaces:**

- Produces: `normalizeOpaqueHexColor(value: string): string | null`, returning lowercase `#rrggbb` or `null`.
- Produces: installed `@jaames/iro` package importable as `import iro from '@jaames/iro'`.

- [ ] **Step 1: Add the failing color-utility test**

```ts
import { describe, expect, it } from 'vitest';
import { normalizeOpaqueHexColor } from '../avatarColor';

describe('normalizeOpaqueHexColor', () => {
  it('normalizes an opaque six-digit hex color', () => {
    expect(normalizeOpaqueHexColor(' #A1B2C3 ')).toBe('#a1b2c3');
  });

  it.each(['#abc', 'a1b2c3', '#a1b2c3ff', '#a1b2cg', ''])(
    'rejects %j',
    (value) => {
      expect(normalizeOpaqueHexColor(value)).toBeNull();
    }
  );
});
```

- [ ] **Step 2: Run the test to confirm the module is missing**

Run: `npm test -- src/features/participants/utils/__tests__/avatarColor.test.ts`

Expected: FAIL because `../avatarColor` does not exist.

- [ ] **Step 3: Install the production dependency**

Run: `npm install @jaames/iro`

Expected: `package.json` and `package-lock.json` list the package without changing package manager or unrelated dependency versions.

- [ ] **Step 4: Implement the normalization utility**

```ts
const opaqueHexColorPattern = /^#[0-9a-f]{6}$/i;

export function normalizeOpaqueHexColor(value: string) {
  const normalizedValue = value.trim();

  return opaqueHexColorPattern.test(normalizedValue)
    ? normalizedValue.toLocaleLowerCase()
    : null;
}
```

- [ ] **Step 5: Run the focused unit test**

Run: `npm test -- src/features/participants/utils/__tests__/avatarColor.test.ts`

Expected: PASS with the normalization and rejection cases green.

### Task 2: Create the reusable staged color-picker sheet

**Files:**

- Create: `src/features/participants/components/AvatarColorPickerSheet.vue`
- Create: `src/features/participants/components/__tests__/AvatarColorPickerSheet.test.ts`
- Modify: `src/features/localization/messages.ts`

**Interfaces:**

- Consumes: `normalizeOpaqueHexColor(value: string): string | null` from Task 1.
- Consumes: `BaseBottomSheet` `open`, `title`, and `close` interface.
- Produces: `AvatarColorPickerSheet` props `{ open: boolean; color: string }` and emits `{ close: []; select: [color: string] }`.

- [ ] **Step 1: Add the failing sheet behavior test**

```ts
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import AvatarColorPickerSheet from '../AvatarColorPickerSheet.vue';

vi.mock('@jaames/iro', () => ({
  default: { ColorPicker: vi.fn(() => ({ on: vi.fn(), destroy: vi.fn() })) },
}));

const mountSheet = () =>
  mount(AvatarColorPickerSheet, {
    props: { open: true, color: '#496a8f' },
    global: { stubs: { BaseBottomSheet: { template: '<div><slot /></div>' } } },
  });

describe('AvatarColorPickerSheet', () => {
  it('emits only the normalized staged value after Select', async () => {
    const wrapper = mountSheet();
    await wrapper.get('input[type="text"]').setValue('#A1B2C3');
    await wrapper.get('[data-test="avatar-color-select"]').trigger('click');

    expect(wrapper.emitted('select')).toEqual([['#a1b2c3']]);
  });

  it('does not emit select when Cancel is pressed', async () => {
    const wrapper = mountSheet();
    await wrapper.get('[data-test="avatar-color-cancel"]').trigger('click');

    expect(wrapper.emitted('select')).toBeUndefined();
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to confirm the component is missing**

Run: `npm test -- src/features/participants/components/__tests__/AvatarColorPickerSheet.test.ts`

Expected: FAIL because `AvatarColorPickerSheet.vue` does not exist.

- [ ] **Step 3: Add localized sheet copy**

Add these `settings` keys in each existing locale block:

```ts
customAvatarColorTitle: 'Choose a custom avatar color',
customAvatarColorSelect: 'Select',
customAvatarColorInvalid: 'Enter a six-digit color, such as #496A8F.',
```

Use equivalent calm translations in Ukrainian and Spanish, placed beside the existing avatar-color keys.

- [ ] **Step 4: Implement the component and iro.js lifecycle**

```ts
const props = defineProps<{ open: boolean; color: string }>();
const emit = defineEmits<{ close: []; select: [color: string] }>();
const pickerElement = ref<HTMLElement | null>(null);
const draftColor = ref(props.color);
const hexError = ref('');

function confirmSelection() {
  const normalizedColor = normalizeOpaqueHexColor(draftColor.value);
  if (!normalizedColor) {
    hexError.value = t('settings.customAvatarColorInvalid');
    return;
  }
  emit('select', normalizedColor);
  emit('close');
}
```

On every open, reset `draftColor` from `props.color`, create an iro.js picker after `nextTick`, and subscribe to `color:change` to update `draftColor` with `color.hexString.toLocaleLowerCase()`. Destroy the iro.js instance on close and component unmount. Configure a wheel plus a value slider, never an alpha slider. Bind the preview background to `draftColor`; bind the text input to the draft; attach the provided test ids to Select and Cancel. Invalid hex must show the localized inline error and disable no other dismissal route.

- [ ] **Step 5: Run the focused sheet test**

Run: `npm test -- src/features/participants/components/__tests__/AvatarColorPickerSheet.test.ts`

Expected: PASS; only Select emits a normalized custom color.

### Task 3: Integrate the sheet into participant settings and remove native picker code

**Files:**

- Modify: `src/features/participants/components/HouseholdMembersSettings.vue:1-160, 760-806`
- Modify: `src/styles/main.css:1826-1842`

**Interfaces:**

- Consumes: `AvatarColorPickerSheet` props `{ open: boolean; color: string }` and `select`/`close` emits from Task 2.
- Produces: custom color selection that updates `participantDraft.avatarColor` only after the inner Select action, with the existing outer Save remaining persistence boundary.

- [ ] **Step 1: Add the component state and handlers**

Replace the native input ref and input-event handler with:

```ts
const isAvatarColorPickerOpen = ref(false);

function openCustomAvatarColorPicker() {
  isAvatarColorPickerOpen.value = true;
}

function closeCustomAvatarColorPicker() {
  isAvatarColorPickerOpen.value = false;
}

function selectCustomAvatarColor(color: string) {
  participantDraft.avatarColor = color;
  closeCustomAvatarColorPicker();
}
```

Import `AvatarColorPickerSheet` from the participant components directory.

- [ ] **Step 2: Replace the native input markup**

Keep the existing conic-gradient trigger button, remove the hidden
`input type="color"`, and add the shared sheet immediately after the existing
participant-edit `BaseBottomSheet`:

```vue
<AvatarColorPickerSheet
  :open="isAvatarColorPickerOpen"
  :color="participantDraft.avatarColor"
  @close="closeCustomAvatarColorPicker"
  @select="selectCustomAvatarColor"
/>
```

The custom button remains `type="button"`, retains its translated aria label,
and opens the sheet. It must not select or persist a color itself.

- [ ] **Step 3: Remove only obsolete native-input CSS**

Delete `.color-selector input.color-selector__native-input` from
`src/styles/main.css`. Keep `.color-selector__custom`, trigger, focus-visible,
and selected-state rules so preset and custom choices retain their current
appearance.

- [ ] **Step 4: Run focused tests and static validation**

Run:

```bash
npm test -- src/features/participants/utils/__tests__/avatarColor.test.ts src/features/participants/components/__tests__/AvatarColorPickerSheet.test.ts
npm run build
npm run check
```

Expected: all tests, TypeScript, Vite build, Prettier, and ESLint pass.

- [ ] **Step 5: Perform device verification**

Run `npm run cap:sync`, then test on Android and iOS with the following
observable results: the native color UI never appears; the bottom sheet opens
with the current color; wheel, brightness, and hex input update the preview;
Cancel/backdrop/Android back do not change the form; Select changes the swatch
and displayed hex; the outer Save persists the selected avatar color.

## Plan self-review

- Spec coverage: Task 1 supplies opaque color validation, Task 2 supplies the reusable cross-platform staged component and accessibility/error behavior, and Task 3 removes native UI, integrates it, and verifies build/device behavior.
- Placeholder scan: no deferred requirements, vague implementation steps, or unspecified interfaces remain.
- Type consistency: the sheet emits `select(color: string)` with the lowercase `#rrggbb` output defined by `normalizeOpaqueHexColor`; the parent handler receives the same `string` type.
