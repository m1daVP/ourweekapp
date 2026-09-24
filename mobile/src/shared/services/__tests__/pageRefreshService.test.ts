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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('classifies workspace failures without starting core sync', async () => {
    mocks.loadWorkspace.mockResolvedValue(false);
    const { refreshPageData } =
      await import('@/shared/services/pageRefreshService');

    await expect(refreshPageData('history')).rejects.toMatchObject({
      reason: 'failed',
    });
    expect(mocks.retrySync).not.toHaveBeenCalled();
  });

  it.each(['failed', 'offline'] as const)(
    'classifies an aggregate %s sync result',
    async (state) => {
      mocks.getAggregateSyncStatus.mockReturnValue({
        state,
        resources: ['tasks'],
        conflictCount: 0,
      });
      const { refreshPageData } =
        await import('@/shared/services/pageRefreshService');

      await expect(refreshPageData('tasks')).rejects.toMatchObject({
        reason: state,
      });
    }
  );

  it('classifies a Settings subscription failure', async () => {
    mocks.subscription.errorMessage = 'provider details must stay hidden';
    const { refreshPageData } =
      await import('@/shared/services/pageRefreshService');

    await expect(refreshPageData('settings')).rejects.toMatchObject({
      message: 'failed',
      reason: 'failed',
    });
  });

  it('wraps unexpected service failures', async () => {
    mocks.retrySync.mockRejectedValue(new Error('raw backend error'));
    const { refreshPageData } =
      await import('@/shared/services/pageRefreshService');

    await expect(refreshPageData('home')).rejects.toMatchObject({
      message: 'failed',
      reason: 'failed',
    });
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
