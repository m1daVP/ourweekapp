import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import {
  navigateAfterAuthentication,
  PostAuthNavigationError,
  resolvePostAuthTarget,
} from '@/features/auth/postAuthNavigation';

function createTestRouter() {
  return createRouter({
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
      {
        path: '/forgot-password',
        name: 'forgot-password',
        component: { template: '<div>Forgot password</div>' },
      },
      {
        path: '/tasks',
        name: 'tasks',
        component: { template: '<div>Tasks</div>' },
      },
    ],
  });
}

describe('postAuthNavigation', () => {
  it('preserves valid internal redirect paths', () => {
    const router = createTestRouter();

    expect(resolvePostAuthTarget(router, '/tasks?filter=open')).toBe(
      '/tasks?filter=open'
    );
  });

  it.each(['/sign-in', '/forgot-password', '/missing', '//example.com'])(
    'falls back to Home for unsafe redirect %s',
    (redirect) => {
      const router = createTestRouter();

      expect(resolvePostAuthTarget(router, redirect)).toEqual({ name: 'home' });
    }
  );

  it('awaits router replacement and opens the resolved destination', async () => {
    const router = createTestRouter();
    await router.push('/sign-in');
    await router.isReady();

    await navigateAfterAuthentication(router, '/tasks');

    expect(router.currentRoute.value.name).toBe('tasks');
  });

  it('reports aborted navigation as an explicit failure', async () => {
    const router = createTestRouter();
    await router.push('/sign-in');
    await router.isReady();
    router.beforeEach((to) => to.name !== 'tasks');

    await expect(
      navigateAfterAuthentication(router, '/tasks')
    ).rejects.toBeInstanceOf(PostAuthNavigationError);
    expect(router.currentRoute.value.name).toBe('sign-in');
  });
});
