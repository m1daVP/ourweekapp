# Premium Profile Ring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a subtle OurWeek green ring around the header profile avatar only for an active Premium entitlement.

**Architecture:** The existing `AppShell` is the only component that renders the global header. It will consume the existing subscription Pinia store and add a CSS modifier class to the existing Settings link. The global stylesheet will render the ring with a pseudo-element, preserving the 40px header slot, 32px avatar, link target, and existing avatar presentation.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia, Vue Test Utils, Vitest, CSS custom properties.

## Global Constraints

- Premium state must come from the trusted existing `hasPremiumEntitlement` store getter; no frontend override or mock provider is added.
- The application is mobile-only; retain the existing 40px header avatar slot and Settings link touch target.
- Use the existing OurWeek colour token `--color-primary-container` for the static ring.
- Do not add copy, dependencies, API calls, animation, or persistent state.
- Do not create a Git commit unless the user explicitly asks for one.

---

### Task 1: Conditionally render and style the Premium profile ring

**Files:**

- Create: `src/shared/components/__tests__/AppShell.test.ts`
- Modify: `src/shared/components/AppShell.vue:1-22,130-142`
- Modify: `src/styles/main.css:299-322`

**Interfaces:**

- Consumes: `useSubscriptionStore(): { hasPremiumEntitlement: boolean }` from `@/app/stores/subscription`.
- Produces: The existing `.app-top-bar__avatar` link additionally has `.app-top-bar__avatar--premium` only when `hasPremiumEntitlement` is `true`.

- [ ] **Step 1: Write the failing component test**

Create `src/shared/components/__tests__/AppShell.test.ts` with the Premium state exposed through a mocked subscription store. Stub only the shell's child components and assert the modifier class on the existing profile RouterLink.

```ts
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { shallowMount } from '@vue/test-utils';

const state = vi.hoisted(() => ({ hasPremiumEntitlement: false }));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'home', fullPath: '/' }),
}));
vi.mock('@/app/stores/participants', () => ({
  useParticipantsStore: () => ({ activeParticipants: [] }),
}));
vi.mock('@/app/stores/subscription', () => ({
  useSubscriptionStore: () => state,
}));
vi.mock('@/shared/composables/useToast', () => ({
  useToast: () => ({
    dismissToast: vi.fn(),
    showToast: vi.fn(),
    toastState: null,
  }),
}));
vi.mock('@/shared/composables/usePullToRefresh', () => ({
  usePullToRefresh: () => ({
    phase: { value: 'idle' },
    pullDistance: { value: 0 },
  }),
}));
vi.mock('@/shared/services/storageService', () => ({
  clearStorageRecoveryMessages: vi.fn(),
  storageRecoveryState: { value: { messages: [] } },
}));
vi.mock('@/shared/services/pageRefreshService', () => ({
  PageRefreshError: class PageRefreshError extends Error {},
  isPullToRefreshRoute: () => false,
  refreshPageData: vi.fn(),
}));

import AppShell from '../AppShell.vue';

function mountAppShell() {
  return shallowMount(AppShell, {
    global: { stubs: { BottomNavigation: true, RouterLink: true } },
  });
}

describe('AppShell Premium profile ring', () => {
  it('adds the Premium modifier only with an active entitlement', () => {
    state.hasPremiumEntitlement = true;
    expect(mountAppShell().find('.app-top-bar__avatar').classes()).toContain(
      'app-top-bar__avatar--premium'
    );

    state.hasPremiumEntitlement = false;
    expect(
      mountAppShell().find('.app-top-bar__avatar').classes()
    ).not.toContain('app-top-bar__avatar--premium');
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/shared/components/__tests__/AppShell.test.ts`

Expected: FAIL because `AppShell.vue` does not yet import the subscription store or render `app-top-bar__avatar--premium`.

- [ ] **Step 3: Add the entitlement-driven modifier to the header link**

In `src/shared/components/AppShell.vue`, add this import beside the existing store imports:

```ts
import { useSubscriptionStore } from '@/app/stores/subscription';
```

Create the store after `participantsStore`:

```ts
const subscriptionStore = useSubscriptionStore();
```

Change the profile link class to preserve its base class and add the modifier only for active Premium:

```vue
<RouterLink
  :class="[
    'app-top-bar__avatar',
    { 'app-top-bar__avatar--premium': subscriptionStore.hasPremiumEntitlement },
  ]"
  :to="{ name: 'settings' }"
  :aria-label="t('app.openSettings')"
>
```

- [ ] **Step 4: Add the static OurWeek ring without changing avatar layout**

In `src/styles/main.css`, keep the current `.app-top-bar__avatar` dimensions and add these rules immediately after its base declaration. The pseudo-element makes a 2px ring inside the current 40px visual box, and `pointer-events: none` preserves the link interaction.

```css
.app-top-bar__avatar--premium {
  position: relative;
}

.app-top-bar__avatar--premium::before {
  position: absolute;
  inset: 1px;
  border: 2px solid var(--color-primary-container);
  border-radius: inherit;
  content: '';
  pointer-events: none;
}
```

- [ ] **Step 5: Run the focused test to verify the entitlement condition**

Run: `npm test -- src/shared/components/__tests__/AppShell.test.ts`

Expected: PASS. The class is present only for `hasPremiumEntitlement: true`.

- [ ] **Step 6: Manually verify both visual states**

Run: `npm run dev`

Verify in a mobile-width browser or Android WebView:

1. With an active Premium entitlement, the profile avatar has a static green ring that does not cover its initials or avatar colour.
2. With a Free or unresolved entitlement, the profile avatar is unchanged.
3. Tapping the avatar still opens Settings, and the visible keyboard focus indicator remains usable.

- [ ] **Step 7: Run project validation**

Run:

```bash
npm run build
npm run check
```

Expected: both commands exit successfully.
