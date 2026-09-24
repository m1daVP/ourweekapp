# Pull-to-Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standard pull-down refresh gesture to Home, Tasks, History, and Settings that retrieves current backend data without leaving the page.

**Architecture:** A shared page-refresh service will compose the existing workspace, core-sync, and subscription operations and prevent duplicate requests. A reusable pull-to-refresh composable will own touch recognition and expose presentation state, while `AppShell.vue` will opt in the four approved routes and render one localized indicator.

**Tech Stack:** Vue 3.5 Composition API, TypeScript 6, Pinia 4, Vue Router 5, vue-i18n 11, Vitest 4, CSS, npm

## Global Constraints

- Enable the gesture only for route names `home`, `tasks`, `history`, and `settings`.
- Refresh meetings, tasks, agreements, participants, and workspace data on all four routes; refresh trusted subscription state only on Settings.
- Keep the current route open and preserve local-first merge and persistence behavior.
- Do not reload the Capacitor WebView or add a dependency.
- A pull starts only when `.app-main` is at the top and no refresh is active.
- Preserve normal scrolling, horizontal interactions, reduced-motion behavior, and Android WebView touch behavior.
- Keep user-facing copy in all existing locales (`en`, `uk`, and `es`).
- Show friendly sync/offline feedback and never expose raw service errors.
- Do not commit changes unless the user explicitly requests commits.

## File Structure

- Create `src/shared/services/pageRefreshService.ts`: route policy, refresh orchestration, failure classification, and single-flight protection.
- Create `src/shared/services/__tests__/pageRefreshService.test.ts`: coordinator and route-policy coverage.
- Create `src/shared/composables/usePullToRefresh.ts`: pure gesture helpers and Vue touch-listener lifecycle.
- Create `src/shared/composables/__tests__/usePullToRefresh.test.ts`: resistance, threshold, direction, and phase tests.
- Modify `src/shared/components/AppShell.vue`: opt-in, refresh callback, indicator, and feedback.
- Modify `src/features/localization/messages.ts`: English and Spanish copy.
- Modify `src/styles/main.css`: indicator styling and reduced-motion behavior.

---

### Task 1: Centralize page refresh behavior

**Files:**

- Create: `src/shared/services/pageRefreshService.ts`
- Create: `src/shared/services/__tests__/pageRefreshService.test.ts`

**Interfaces:**

- Consumes: `useWorkspaceStore().loadWorkspace(): Promise<boolean>`, `retrySync(): Promise<SyncResult[]>`, `getAggregateSyncStatus(): AggregateSyncStatus`, and `useSubscriptionStore().refreshCurrentPlan(): Promise<void>`.
- Produces: `PullToRefreshRouteName`, `isPullToRefreshRoute(routeName: unknown): routeName is PullToRefreshRouteName`, `PageRefreshError`, and `refreshPageData(routeName: PullToRefreshRouteName): Promise<void>`.

- [ ] **Step 1: Write the failing coordinator tests**

Create hoisted mocks so the test uses no API, persistence, or native provider:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadWorkspace: vi.fn<() => Promise<boolean>>(),
  refreshCurrentPlan: vi.fn<() => Promise<void>>(),
  retrySync: vi.fn(),
  getAggregateSyncStatus: vi.fn(),
  workspace: { errorMessage: '' },
  subscription: { errorMessage: '' },
}));

vi.mock('@/app/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    ...mocks.workspace,
    loadWorkspace: mocks.loadWorkspace,
  }),
}));
vi.mock('@/app/stores/subscription', () => ({
  useSubscriptionStore: () => ({
    ...mocks.subscription,
    refreshCurrentPlan: mocks.refreshCurrentPlan,
  }),
}));
vi.mock('@/shared/services/syncService', () => ({
  retrySync: mocks.retrySync,
  getAggregateSyncStatus: mocks.getAggregateSyncStatus,
}));

describe('pageRefreshService', () => {
  beforeEach(() => {
    mocks.workspace.errorMessage = '';
    mocks.subscription.errorMessage = '';
    mocks.loadWorkspace.mockReset().mockResolvedValue(true);
    mocks.refreshCurrentPlan.mockReset().mockResolvedValue(undefined);
    mocks.retrySync.mockReset().mockResolvedValue([]);
    mocks.getAggregateSyncStatus.mockReset().mockReturnValue({
      state: 'synced',
      resources: ['meetings', 'tasks', 'participants'],
      conflictCount: 0,
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('enables only the approved routes', async () => {
    const { isPullToRefreshRoute } =
      await import('@/shared/services/pageRefreshService');
    expect(
      ['home', 'tasks', 'history', 'settings'].every(isPullToRefreshRoute)
    ).toBe(true);
    expect(
      ['meeting', 'meeting-details', 'account', undefined].some(
        isPullToRefreshRoute
      )
    ).toBe(false);
  });

  it('loads workspace and core data on a supported page', async () => {
    const { refreshPageData } =
      await import('@/shared/services/pageRefreshService');
    await refreshPageData('tasks');
    expect(mocks.loadWorkspace).toHaveBeenCalledOnce();
    expect(mocks.retrySync).toHaveBeenCalledOnce();
    expect(mocks.refreshCurrentPlan).not.toHaveBeenCalled();
  });

  it('also refreshes subscription state on Settings', async () => {
    const { refreshPageData } =
      await import('@/shared/services/pageRefreshService');
    await refreshPageData('settings');
    expect(mocks.refreshCurrentPlan).toHaveBeenCalledOnce();
  });

  it('classifies offline refresh without starting requests', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const { refreshPageData } =
      await import('@/shared/services/pageRefreshService');
    await expect(refreshPageData('home')).rejects.toMatchObject({
      reason: 'offline',
    });
    expect(mocks.loadWorkspace).not.toHaveBeenCalled();
  });

  it('shares one in-flight refresh', async () => {
    let finishWorkspace!: (value: boolean) => void;
    mocks.loadWorkspace.mockReturnValue(
      new Promise((resolve) => {
        finishWorkspace = resolve;
      })
    );
    const { refreshPageData } =
      await import('@/shared/services/pageRefreshService');
    const first = refreshPageData('history');
    const second = refreshPageData('history');
    expect(first).toBe(second);
    finishWorkspace(true);
    await first;
    expect(mocks.retrySync).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run:

```bash
npm test -- src/shared/services/__tests__/pageRefreshService.test.ts
```

Expected: FAIL because `pageRefreshService.ts` does not exist.

- [ ] **Step 3: Implement the route policy and single-flight coordinator**

```ts
import { useSubscriptionStore } from '@/app/stores/subscription';
import { useWorkspaceStore } from '@/app/stores/workspace';
import {
  getAggregateSyncStatus,
  retrySync,
} from '@/shared/services/syncService';

const PULL_TO_REFRESH_ROUTES = [
  'home',
  'tasks',
  'history',
  'settings',
] as const;

export type PullToRefreshRouteName = (typeof PULL_TO_REFRESH_ROUTES)[number];
export type PageRefreshFailureReason = 'offline' | 'failed';

export class PageRefreshError extends Error {
  constructor(public readonly reason: PageRefreshFailureReason) {
    super(reason);
    this.name = 'PageRefreshError';
  }
}

export function isPullToRefreshRoute(
  routeName: unknown
): routeName is PullToRefreshRouteName {
  return (
    typeof routeName === 'string' &&
    (PULL_TO_REFRESH_ROUTES as readonly string[]).includes(routeName)
  );
}

let activeRefresh: Promise<void> | null = null;

async function runPageRefresh(routeName: PullToRefreshRouteName) {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new PageRefreshError('offline');
    }

    const workspaceStore = useWorkspaceStore();
    if (!(await workspaceStore.loadWorkspace())) {
      throw new PageRefreshError('failed');
    }

    await retrySync();
    const state = getAggregateSyncStatus().state;
    if (state === 'offline' || state === 'failed') {
      throw new PageRefreshError(state);
    }

    if (routeName === 'settings') {
      const subscriptionStore = useSubscriptionStore();
      await subscriptionStore.refreshCurrentPlan();
      if (subscriptionStore.errorMessage) {
        throw new PageRefreshError('failed');
      }
    }
  } catch (error) {
    if (error instanceof PageRefreshError) throw error;
    throw new PageRefreshError('failed');
  }
}

export function refreshPageData(
  routeName: PullToRefreshRouteName
): Promise<void> {
  if (activeRefresh) return activeRefresh;
  activeRefresh = runPageRefresh(routeName).finally(() => {
    activeRefresh = null;
  });
  return activeRefresh;
}
```

Add cases for `loadWorkspace() === false`, aggregate `failed`, aggregate
`offline`, and a Settings subscription error. Each must assert the matching
`PageRefreshError.reason`, and none may expose a raw store message.

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm test -- src/shared/services/__tests__/pageRefreshService.test.ts
```

Expected: PASS for route policy, normal refresh, Settings refresh, error
classification, and single-flight behavior.

- [ ] **Step 5: Review the Task 1 diff**

Run:

```bash
git diff --check -- src/shared/services/pageRefreshService.ts src/shared/services/__tests__/pageRefreshService.test.ts
```

Expected: no whitespace errors. If the user explicitly requests a commit, use
`feat(sync): add page refresh coordinator`.

---

### Task 2: Implement reusable touch gesture state

**Files:**

- Create: `src/shared/composables/usePullToRefresh.ts`
- Create: `src/shared/composables/__tests__/usePullToRefresh.test.ts`

**Interfaces:**

- Consumes: Vue `Ref`, `ComputedRef`, lifecycle functions, and reactivity.
- Produces: `PullToRefreshPhase`, `calculatePullDistance(deltaY: number): number`, `classifyPullGesture(deltaX: number, deltaY: number)`, `getPullToRefreshPhase(distance: number, refreshing: boolean)`, and `usePullToRefresh(options)`.

- [ ] **Step 1: Write failing pure gesture tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  PULL_ACTIVATION_PX,
  PULL_MAX_DISTANCE_PX,
  PULL_THRESHOLD_PX,
  calculatePullDistance,
  classifyPullGesture,
  getPullToRefreshPhase,
} from '@/shared/composables/usePullToRefresh';

describe('pull-to-refresh gesture helpers', () => {
  it('adds resistance and caps visible distance', () => {
    expect(calculatePullDistance(0)).toBe(0);
    expect(calculatePullDistance(40)).toBeLessThan(40);
    expect(calculatePullDistance(1000)).toBe(PULL_MAX_DISTANCE_PX);
  });

  it('accepts only activated downward vertical movement', () => {
    expect(classifyPullGesture(1, PULL_ACTIVATION_PX - 1)).toBe('pending');
    expect(classifyPullGesture(3, PULL_ACTIVATION_PX + 4)).toBe('pulling');
    expect(classifyPullGesture(20, 8)).toBe('cancelled');
    expect(classifyPullGesture(0, -10)).toBe('cancelled');
  });

  it('maps state to presentation phases', () => {
    expect(getPullToRefreshPhase(0, false)).toBe('idle');
    expect(getPullToRefreshPhase(PULL_THRESHOLD_PX - 1, false)).toBe('pulling');
    expect(getPullToRefreshPhase(PULL_THRESHOLD_PX, false)).toBe('ready');
    expect(getPullToRefreshPhase(0, true)).toBe('refreshing');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the expected failure**

Run:

```bash
npm test -- src/shared/composables/__tests__/usePullToRefresh.test.ts
```

Expected: FAIL because the composable does not exist.

- [ ] **Step 3: Implement helpers and listener lifecycle**

Use these contracts:

```ts
export const PULL_ACTIVATION_PX = 8;
export const PULL_THRESHOLD_PX = 72;
export const PULL_MAX_DISTANCE_PX = 104;
const PULL_RESISTANCE = 0.55;
const REFRESH_HOLD_DISTANCE_PX = 48;

export type PullToRefreshPhase = 'idle' | 'pulling' | 'ready' | 'refreshing';

export interface UsePullToRefreshOptions {
  container: Ref<HTMLElement | null>;
  enabled: ComputedRef<boolean>;
  onRefresh: () => Promise<void>;
}
```

Implementation requirements:

- `calculatePullDistance` returns a clamped `deltaY * 0.55`.
- `classifyPullGesture` returns pending below 8 px, cancelled for upward or
  horizontal-dominant motion, and pulling for activated downward vertical motion.
- `getPullToRefreshPhase` prioritizes refreshing, then idle at zero, ready at
  72 px, and pulling otherwise.
- Register `touchstart`, `touchmove`, `touchend`, and `touchcancel` on the
  current container in `onMounted`. Make only `touchmove` non-passive.
- Begin only for one touch when enabled, not refreshing, and
  `container.scrollTop <= 0`.
- Store initial client X/Y. Do not call `preventDefault()` before a downward
  vertical pull is captured.
- Cancel upward/horizontal movement. On capture, set resisted distance and
  prevent WebView scrolling beneath the indicator.
- A release below threshold resets without a request. A threshold release holds
  at 48 px, calls `onRefresh` once, and resets in `finally`.
- When `enabled` becomes false, cancel presentation but do not abort a request
  already sent. Remove all listeners on unmount.

Return:

```ts
return {
  phase: computed(() =>
    getPullToRefreshPhase(pullDistance.value, isRefreshing.value)
  ),
  pullDistance: readonly(pullDistance),
  isRefreshing: readonly(isRefreshing),
};
```

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
npm test -- src/shared/composables/__tests__/usePullToRefresh.test.ts
npm test
```

Expected: both PASS.

- [ ] **Step 5: Review the Task 2 diff**

Run:

```bash
git diff --check -- src/shared/composables/usePullToRefresh.ts src/shared/composables/__tests__/usePullToRefresh.test.ts
```

Expected: no whitespace errors. If the user explicitly requests a commit, use
`feat(ui): add pull-to-refresh gesture controller`.

---

### Task 3: Integrate the indicator into the app shell

**Files:**

- Modify: `src/shared/components/AppShell.vue`
- Modify: `src/features/localization/messages.ts`
- Modify: `src/styles/main.css`

**Interfaces:**

- Consumes: `isPullToRefreshRoute`, `refreshPageData`, `PageRefreshError`, and `usePullToRefresh`.
- Produces: visible and accessible in-place refresh behavior on exactly four routes.

- [ ] **Step 1: Add localized copy**

Under `app` in English:

```ts
refresh: {
  pull: 'Pull to refresh',
  release: 'Release to refresh',
  updating: 'Updating...',
  updated: 'Page updated.',
},
```

Under `app` in Spanish:

```ts
refresh: {
  pull: 'Desliza para actualizar',
  release: 'Suelta para actualizar',
  updating: 'Actualizando...',
  updated: 'Página actualizada.',
},
```

- [ ] **Step 2: Wire the route and callback into `AppShell.vue`**

```ts
import {
  PageRefreshError,
  isPullToRefreshRoute,
  refreshPageData,
} from '@/shared/services/pageRefreshService';
import { usePullToRefresh } from '@/shared/composables/usePullToRefresh';
const pullToRefreshEnabled = computed(() => isPullToRefreshRoute(route.name));

async function handlePageRefresh() {
  if (!isPullToRefreshRoute(route.name)) return;

  try {
    await refreshPageData(route.name);
    await showToast(t('app.refresh.updated'));
  } catch (error) {
    const message =
      error instanceof PageRefreshError && error.reason === 'offline'
        ? t('sync.offline')
        : t('sync.failed');
    await showToast(message, { tone: 'error', durationMs: 3600 });
  }
}

const { phase: pullPhase, pullDistance } = usePullToRefresh({
  container: mainElement,
  enabled: pullToRefreshEnabled,
  onRefresh: handlePageRefresh,
});

const pullStatusText = computed(() => {
  if (pullPhase.value === 'ready') return t('app.refresh.release');
  if (pullPhase.value === 'refreshing') return t('app.refresh.updating');
  return t('app.refresh.pull');
});

const pullIndicatorStyle = computed(
  () => ({ '--pull-distance': `${pullDistance.value}px` }) as CSSProperties
);
```

Add `type CSSProperties` to the existing named import from `vue`.

Destructure `showToast` with the existing toast methods. Keep the existing
route scroll-to-top watcher.

- [ ] **Step 3: Render the indicator first inside `.app-main`**

```vue
<div
  v-if="pullToRefreshEnabled"
  :class="['pull-to-refresh', `pull-to-refresh--${pullPhase}`]"
  :style="pullIndicatorStyle"
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  <span
    :class="[
      'material-symbols-outlined',
      { 'pull-to-refresh__spinner': pullPhase === 'refreshing' },
    ]"
    aria-hidden="true"
  >
    refresh
  </span>
  <span>{{ pullStatusText }}</span>
</div>
```

- [ ] **Step 4: Style the indicator and reduced-motion state**

Add near `.app-main`, using existing tokens:

```css
.pull-to-refresh {
  display: flex;
  height: 0;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  overflow: visible;
  color: var(--color-on-surface-variant);
  font-size: var(--font-size-label-sm);
  font-weight: 700;
  opacity: 0;
  pointer-events: none;
  transform: translateY(calc(var(--pull-distance, 0px) - 48px));
  transition:
    transform 160ms ease,
    opacity 120ms ease;
}

.pull-to-refresh--pulling,
.pull-to-refresh--ready,
.pull-to-refresh--refreshing {
  opacity: 1;
}

.pull-to-refresh--ready {
  color: var(--color-primary);
}

.pull-to-refresh__spinner {
  animation: pull-to-refresh-spin 700ms linear infinite;
}

@keyframes pull-to-refresh-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pull-to-refresh {
    transition: none;
  }

  .pull-to-refresh__spinner {
    animation-duration: 1.5s;
  }
}
```

Under `app` in Ukrainian:

```ts
refresh: {
  pull: 'Потягніть, щоб оновити',
  release: 'Відпустіть, щоб оновити',
  updating: 'Оновлюємо...',
  updated: 'Сторінку оновлено.',
},
```

- [ ] **Step 5: Run automated verification**

Run:

```bash
npm test
npm run build
npm run check
```

Expected: tests pass, Vue/TypeScript build succeeds, and Prettier/ESLint report
no errors. If formatting alone fails, run `npm run format`, then repeat build
and check.

- [ ] **Step 6: Perform mobile QA**

Verify:

- Home, Tasks, History, Settings at the top: a short pull cancels and a threshold pull refreshes once.
- Those pages when scrolled: scrolling stays normal and no indicator appears.
- Meeting, detail, summary, template, account, and authentication routes: no refresh gesture.
- Horizontal task interactions: no accidental refresh.
- A second touch during refresh: no duplicate request.
- Success: current route remains open, fresh data renders, and "Page updated." appears.
- Offline/failure: local data stays visible, friendly feedback appears, and a later pull retries.
- Settings: workspace and trusted subscription state both update.
- Reduced motion: no rebound transition or fast spinner.

- [ ] **Step 7: Review the complete diff**

Run:

```bash
git diff --check
git status --short
```

Expected: only the approved spec, this plan, implementation files, and any
unrelated pre-existing user changes remain. If the user explicitly requests a
commit, use `feat(ui): add pull-to-refresh on primary pages`.
