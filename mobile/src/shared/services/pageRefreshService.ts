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

    const syncState = getAggregateSyncStatus().state;

    if (syncState === 'offline' || syncState === 'failed') {
      throw new PageRefreshError(syncState);
    }

    if (routeName === 'settings') {
      const subscriptionStore = useSubscriptionStore();

      await subscriptionStore.refreshCurrentPlan();

      if (subscriptionStore.errorMessage) {
        throw new PageRefreshError('failed');
      }
    }
  } catch (error) {
    if (error instanceof PageRefreshError) {
      throw error;
    }

    throw new PageRefreshError('failed');
  }
}

export function refreshPageData(
  routeName: PullToRefreshRouteName
): Promise<void> {
  if (activeRefresh) {
    return activeRefresh;
  }

  activeRefresh = runPageRefresh(routeName).finally(() => {
    activeRefresh = null;
  });

  return activeRefresh;
}
