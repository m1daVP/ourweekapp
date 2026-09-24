import { describe, expect, it, vi } from 'vitest';

const init = vi.hoisted(() => vi.fn());

vi.mock('@sentry/vue', () => ({ init }));

import {
  initializeSentry,
  sanitizeSentryEvent,
} from '@/shared/services/sentryPrivacy';

describe('Sentry privacy controls', () => {
  it('removes secrets from exception, request, user, breadcrumbs, and extras', () => {
    const circularExtra: Record<string, unknown> = {};
    circularExtra.self = circularExtra;

    const output = sanitizeSentryEvent({
      breadcrumbs: [{ message: 'private-note-SECRET' }],
      exception: {
        values: [
          {
            type: 'Error',
            value: 'private-note-SECRET',
            stacktrace: {
              frames: [
                {
                  filename:
                    'https://example.invalid/callback?code=oauth-SECRET',
                  function: 'safeFunction',
                  lineno: 12,
                  vars: { email: 'secret@example.invalid' },
                },
              ],
            },
          },
        ],
      },
      extra: { payload: { note: 'private-note-SECRET' }, circularExtra },
      request: { url: 'https://example.invalid/callback?code=oauth-SECRET' },
      tags: { feature: 'auth', provider: 'google', stage: 'oauth-SECRET' },
      type: undefined,
      user: { email: 'secret@example.invalid' },
    });

    expect(JSON.stringify(output)).not.toContain('SECRET');
    expect(JSON.stringify(output)).not.toContain('secret@example.invalid');
    expect(output).toMatchObject({
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Unhandled application error',
            stacktrace: { frames: [{ lineno: 12 }] },
          },
        ],
      },
      tags: { feature: 'auth', provider: 'google' },
    });
  });

  it('does not throw when a provider supplies malformed exception data', () => {
    expect(() =>
      sanitizeSentryEvent({
        exception: { values: 'private-note-SECRET' as never },
        type: undefined,
      })
    ).not.toThrow();
  });

  it('does not initialize or submit when the DSN is absent', () => {
    expect(initializeSentry({} as never, undefined)).toBe(false);
    expect(init).not.toHaveBeenCalled();
  });

  it('initializes once with final event and breadcrumb filtering when configured', () => {
    expect(initializeSentry({} as never, ' https://example.invalid/123 ')).toBe(
      true
    );

    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeBreadcrumb: expect.any(Function),
        beforeSend: sanitizeSentryEvent,
        dsn: 'https://example.invalid/123',
      })
    );
    expect(init.mock.calls[0][0].beforeBreadcrumb({})).toBeNull();
  });
});
