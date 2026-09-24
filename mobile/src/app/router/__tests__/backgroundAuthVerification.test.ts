import { describe, expect, it, vi } from 'vitest';
import type {
  RouteLocationNormalizedLoaded,
  RouteLocationRaw,
} from 'vue-router';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createBackgroundAuthVerificationCoordinator } from '@/app/router/backgroundAuthVerification';

type CurrentRoute = Pick<
  RouteLocationNormalizedLoaded,
  'fullPath' | 'meta' | 'name'
>;

function createDeferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    reject = promiseReject;
    resolve = promiseResolve;
  });

  return { promise, reject, resolve };
}

function createRoute(
  name: string,
  fullPath: string,
  guestOnly = false
): CurrentRoute {
  return {
    fullPath,
    meta: guestOnly ? { guestOnly: true } : {},
    name,
  };
}

function createHarness(
  initialRoute = createRoute('sign-in', '/sign-in', true)
) {
  let currentRoute = initialRoute;
  const authStore = {
    hasVerifiedCurrentUser: false,
    sessionCheckStatus: 'idle',
    verifyCurrentUser: vi.fn<() => Promise<boolean>>(),
  };
  const getSignedOutRedirect = vi.fn(
    (_routeName: unknown, fullPath: string): RouteLocationRaw => ({
      name: 'sign-in',
      query: { redirect: fullPath },
    })
  );
  const isUnauthenticatedRouteName = vi.fn(
    (routeName: unknown) =>
      typeof routeName === 'string' &&
      [
        'forgot-password',
        'reset-password',
        'sign-in',
        'sign-up',
        'welcome',
      ].includes(routeName)
  );
  const replace = vi
    .fn<(target: RouteLocationRaw) => Promise<unknown>>()
    .mockResolvedValue(undefined);
  const coordinator = createBackgroundAuthVerificationCoordinator({
    getAuthStore: () => authStore,
    getCurrentRoute: () => currentRoute,
    getSignedOutRedirect,
    isUnauthenticatedRouteName,
    replace,
  });

  return {
    authStore,
    coordinator,
    getSignedOutRedirect,
    replace,
    setCurrentRoute(route: CurrentRoute) {
      currentRoute = route;
    },
  };
}

describe('backgroundAuthVerification', () => {
  it('lets an already-verified fresh session complete its explicit Home navigation', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/',
          name: 'home',
          component: { template: '<div>Home</div>' },
        },
        {
          path: '/sign-in',
          name: 'sign-in',
          component: { template: '<div>Sign in</div>' },
          meta: { guestOnly: true },
        },
      ],
    });
    await router.push('/sign-in');
    await router.isReady();
    const authStore = {
      hasVerifiedCurrentUser: true,
      sessionCheckStatus: 'verified',
      verifyCurrentUser: vi.fn<() => Promise<boolean>>(),
    };
    const coordinator = createBackgroundAuthVerificationCoordinator({
      getAuthStore: () => authStore,
      getCurrentRoute: () => router.currentRoute.value,
      getSignedOutRedirect: () => ({ name: 'sign-in' }),
      isUnauthenticatedRouteName: () => false,
      replace: (target) => router.replace(target),
    });
    router.beforeEach(() => {
      void coordinator.requestVerification();
      return true;
    });

    await expect(router.replace({ name: 'home' })).resolves.toBeUndefined();

    expect(router.currentRoute.value.name).toBe('home');
    expect(authStore.verifyCurrentUser).not.toHaveBeenCalled();
  });

  it('skips background verification for an already-verified session', async () => {
    const { authStore, coordinator, replace } = createHarness();
    authStore.hasVerifiedCurrentUser = true;

    expect(coordinator.requestVerification()).toBeUndefined();
    await Promise.resolve();

    expect(authStore.verifyCurrentUser).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shares one verification task across repeated requests', async () => {
    const verification = createDeferred<boolean>();
    const { authStore, coordinator } = createHarness();
    authStore.verifyCurrentUser.mockReturnValue(verification.promise);

    const firstTask = coordinator.requestVerification();
    const secondTask = coordinator.requestVerification();
    await Promise.resolve();

    expect(secondTask).toBe(firstTask);
    expect(authStore.verifyCurrentUser).toHaveBeenCalledOnce();

    verification.resolve(false);
    await firstTask;
  });

  it('redirects a restored session away from a guest route once', async () => {
    const { authStore, coordinator, replace } = createHarness();
    authStore.verifyCurrentUser.mockImplementation(async () => {
      authStore.hasVerifiedCurrentUser = true;
      authStore.sessionCheckStatus = 'verified';
      return true;
    });

    await coordinator.requestVerification();

    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith({ name: 'home' });
  });

  it('keeps redirect ownership while the replacement is pending', async () => {
    const verification = createDeferred<boolean>();
    const replacement = createDeferred<unknown>();
    const { authStore, coordinator, replace } = createHarness();
    authStore.verifyCurrentUser.mockReturnValue(verification.promise);
    replace.mockReturnValue(replacement.promise);

    const firstTask = coordinator.requestVerification();
    await Promise.resolve();
    verification.resolve(true);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledOnce());

    const reentrantTask = coordinator.requestVerification();

    expect(reentrantTask).toBe(firstTask);
    expect(authStore.verifyCurrentUser).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledOnce();

    replacement.resolve(undefined);
    await firstTask;
  });

  it('does not redirect a verified session already on an app route', async () => {
    const { authStore, coordinator, replace } = createHarness(
      createRoute('tasks', '/tasks')
    );
    authStore.verifyCurrentUser.mockResolvedValue(true);

    await coordinator.requestVerification();

    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects an unauthorized protected route to sign-in', async () => {
    const { authStore, coordinator, getSignedOutRedirect, replace } =
      createHarness(createRoute('tasks', '/tasks?filter=open'));
    authStore.sessionCheckStatus = 'unauthorized';
    authStore.verifyCurrentUser.mockResolvedValue(false);

    await coordinator.requestVerification();

    expect(getSignedOutRedirect).toHaveBeenCalledWith(
      'tasks',
      '/tasks?filter=open'
    );
    expect(replace).toHaveBeenCalledWith({
      name: 'sign-in',
      query: { redirect: '/tasks?filter=open' },
    });
  });

  it('leaves an unauthorized public route unchanged', async () => {
    const { authStore, coordinator, getSignedOutRedirect, replace } =
      createHarness();
    authStore.sessionCheckStatus = 'unauthorized';
    authStore.verifyCurrentUser.mockResolvedValue(false);

    await coordinator.requestVerification();

    expect(getSignedOutRedirect).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('uses the current route when delayed verification finishes', async () => {
    const verification = createDeferred<boolean>();
    const { authStore, coordinator, replace, setCurrentRoute } =
      createHarness();
    authStore.verifyCurrentUser.mockReturnValue(verification.promise);

    const task = coordinator.requestVerification();
    await Promise.resolve();
    setCurrentRoute(createRoute('settings', '/settings'));
    verification.resolve(true);
    await task;

    expect(replace).not.toHaveBeenCalled();
  });

  it('clears failed tasks so a later verification can retry', async () => {
    const { authStore, coordinator } = createHarness(
      createRoute('settings', '/settings')
    );
    authStore.verifyCurrentUser
      .mockRejectedValueOnce(new Error('verification unavailable'))
      .mockResolvedValueOnce(true);

    await expect(coordinator.requestVerification()).resolves.toBeUndefined();
    await expect(coordinator.requestVerification()).resolves.toBeUndefined();

    expect(authStore.verifyCurrentUser).toHaveBeenCalledTimes(2);
  });

  it('clears failed redirects without creating an unhandled rejection', async () => {
    const { authStore, coordinator, replace } = createHarness();
    authStore.verifyCurrentUser.mockResolvedValue(true);
    replace
      .mockRejectedValueOnce(new Error('navigation rejected'))
      .mockResolvedValueOnce(undefined);

    await expect(coordinator.requestVerification()).resolves.toBeUndefined();
    await expect(coordinator.requestVerification()).resolves.toBeUndefined();

    expect(authStore.verifyCurrentUser).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledTimes(2);
  });
});
