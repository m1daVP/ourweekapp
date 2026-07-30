import {
  isNavigationFailure,
  NavigationFailureType,
  type RouteLocationRaw,
  type Router,
} from 'vue-router';

const BLOCKED_POST_AUTH_ROUTE_NAMES = new Set([
  'welcome',
  'sign-in',
  'sign-up',
  'forgot-password',
  'reset-password',
]);

export class PostAuthNavigationError extends Error {
  constructor() {
    super('Post-authentication navigation failed.');
    this.name = 'PostAuthNavigationError';
  }
}

export function resolvePostAuthTarget(
  router: Router,
  redirect: unknown
): RouteLocationRaw {
  if (
    typeof redirect !== 'string' ||
    !redirect.startsWith('/') ||
    redirect.startsWith('//')
  ) {
    return { name: 'home' };
  }

  try {
    const resolvedRoute = router.resolve(redirect);
    const isBlockedRoute =
      resolvedRoute.matched.length === 0 ||
      (typeof resolvedRoute.name === 'string' &&
        BLOCKED_POST_AUTH_ROUTE_NAMES.has(resolvedRoute.name)) ||
      resolvedRoute.matched.some((record) => record.meta.guestOnly);

    return isBlockedRoute ? { name: 'home' } : redirect;
  } catch {
    return { name: 'home' };
  }
}

export async function navigateAfterAuthentication(
  router: Router,
  redirect?: unknown
) {
  const failure = await router.replace(resolvePostAuthTarget(router, redirect));

  if (
    failure &&
    isNavigationFailure(failure) &&
    !isNavigationFailure(failure, NavigationFailureType.duplicated)
  ) {
    throw new PostAuthNavigationError();
  }
}
