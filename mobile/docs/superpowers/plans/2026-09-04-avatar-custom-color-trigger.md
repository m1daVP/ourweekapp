# Avatar Custom-Color Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the compact rainbow circle that opens the inline custom avatar-color picker.

**Architecture:** Keep `AvatarPickerSheet.vue` as the sole UI and interaction owner. Replace its text trigger with a visually nested gradient swatch; no picker state, persistence, i18n message, or data-model behavior changes.

**Tech Stack:** Vue 3 Composition API, TypeScript, scoped CSS, vue-i18n, Vitest, Vue Test Utils.

## Global Constraints

- Retain the separate inline color-picker panel and its existing state behavior.
- Use a semantic button, the existing localized custom-color label, and the existing 64px mobile touch target.
- Do not add dependencies, data migrations, or localization strings.
- Preserve the project’s calm, mobile-first design and reduced-motion support.
- Do not commit unless the user explicitly requests it.

---

### Task 1: Cover and restore the custom-color swatch

**Files:**

- Create: `src/features/participants/components/__tests__/AvatarPickerSheet.test.ts`
- Modify: `src/features/participants/components/AvatarPickerSheet.vue:137-145,194`

**Interfaces:**

- Consumes: `AvatarPickerSheet` props `{ open: boolean; avatarType: AvatarType | null; avatarColor: string }` and its existing `close`, `selectAvatar`, and `selectColor` emits.
- Produces: a `button.avatar-picker__custom-color` containing one decorative `.avatar-picker__custom-color-swatch` element; its click continues to call `toggleCustomColor()`.

- [ ] **Step 1: Write the failing component test**

Create `src/features/participants/components/__tests__/AvatarPickerSheet.test.ts` with this focused assertion, stubbing the bottom sheet and `@jaames/iro` so mounting does not initialize the wheel:

```ts
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock('@jaames/iro', () => ({ default: { ColorPicker: vi.fn() } }));
vi.mock('@/app/stores/participants', () => ({
  participantColors: ['#496a8f'],
}));

import AvatarPickerSheet from '../AvatarPickerSheet.vue';

describe('AvatarPickerSheet custom color trigger', () => {
  it('renders the custom-color trigger as a circular swatch', () => {
    const wrapper = shallowMount(AvatarPickerSheet, {
      props: { open: true, avatarType: null, avatarColor: '#496a8f' },
      global: {
        stubs: { BaseBottomSheet: { template: '<div><slot /></div>' } },
      },
    });

    expect(
      wrapper.get('button.avatar-picker__custom-color').attributes('aria-label')
    ).toBe('settings.customAvatarColor');
    expect(wrapper.find('.avatar-picker__custom-color-swatch').exists()).toBe(
      true
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run: `npm test -- src/features/participants/components/__tests__/AvatarPickerSheet.test.ts`

Expected: FAIL because the trigger does not yet expose `aria-label` or contain `.avatar-picker__custom-color-swatch`.

- [ ] **Step 3: Implement the minimal template and CSS change**

Replace the text content inside the existing custom trigger with a decorative child and keep its existing click handler and pressed state:

```vue
<button
  class="avatar-picker__custom-color"
  type="button"
  :aria-label="t('settings.customAvatarColor')"
  :aria-pressed="showCustomColor"
  @click="toggleCustomColor"
>
  <span class="avatar-picker__custom-color-swatch" aria-hidden="true" />
</button>
```

Remove the pill-specific width, padding, and border-radius override. Make the child a centered, 32px circular `conic-gradient` swatch; leave the shared 64px circular button styles and pressed border in effect:

```css
.avatar-picker__custom-color-swatch {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: conic-gradient(
    #e45b5b,
    #e5c052,
    #5fa76d,
    #4f9ed5,
    #8466ba,
    #e45b5b
  );
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/features/participants/components/__tests__/AvatarPickerSheet.test.ts`

Expected: PASS with the button labelled from `settings.customAvatarColor` and one custom-color swatch present.

- [ ] **Step 5: Run project verification**

Run: `npm run build && npm run check`

Expected: Both commands exit successfully. Manually confirm in the Avatar sheet that the rainbow circle toggles the existing inline wheel and hex input, and that confirming a chosen custom color still updates the participant avatar.
