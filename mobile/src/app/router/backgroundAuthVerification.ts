import type {
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
} from 'vue-router';

type BackgroundAuthVerificationStore = {
  hasVerifiedCurrentUser: boolean;
  sessionCheckStatus: string;
  verifyCurrentUser: () => Promise<boolean>;
};

type BackgroundAuthVerificationDependencies = {
  getAuthStore: () => BackgroundAuthVerificationStore;
  getCurrentRoute: () => Pick<
    RouteLocationNormalizedLoaded,
    'fullPath' | 'meta' | 'name'
  >;
  getSignedOutRedirect: (
    routeName: unknown,
    fullPath: string
  ) => RouteLocationRaw;
  isUnauthenticatedRouteName: (routeName: unknown) => boolean;
  replace: (target: RouteLocationRaw) => Promise<unknown>;
};

export function createBackgroundAuthVerificationCoordinator({
  getAuthStore,
  getCurrentRoute,
  getSignedOutRedirect,
  isUnauthenticatedRouteName,
  replace,
}: BackgroundAuthVerificationDependencies) {
  let activeTask: Promise<void> | null = null;

  function requestVerification() {
    const authStore = getAuthStore();

    if (activeTask) {
      return activeTask;
    }

    if (authStore.hasVerifiedCurrentUser) {
      return;
    }

    const task = Promise.resolve()
      .then(() => authStore.verifyCurrentUser())
      .then(async (isVerified) => {
        const currentRoute = getCurrentRoute();

        if (isVerified) {
          if (currentRoute.meta.guestOnly) {
            await replace({ name: 'home' });
          }

          return;
        }

        if (
          authStore.sessionCheckStatus !== 'unauthorized' ||
          isUnauthenticatedRouteName(currentRoute.name)
        ) {
          return;
        }

        await replace(
          getSignedOutRedirect(currentRoute.name, currentRoute.fullPath)
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (activeTask === task) {
          activeTask = null;
        }
      });

    activeTask = task;
    return task;
  }

  return {
    requestVerification,
  };
}
