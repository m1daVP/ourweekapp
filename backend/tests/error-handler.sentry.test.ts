import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const captureException = vi.hoisted(() => vi.fn());

vi.mock('@sentry/node', () => ({
  captureException,
  init: vi.fn(),
  close: vi.fn(),
}));

async function buildAppWithErrorHandler() {
  const [{ registerErrorHandler }, { ApiError }] = await Promise.all([
    import('../src/shared/errors/error-handler.js'),
    import('../src/shared/errors/api-error.js'),
  ]);
  const app = Fastify({ logger: false });

  registerErrorHandler(app);

  app.get('/unexpected', async () => {
    throw new Error('database exploded');
  });

  app.get('/expected', async () => {
    throw new ApiError(404, 'not_found', 'That was not found.');
  });

  return app;
}

describe('error handler Sentry reporting', () => {
  beforeEach(() => {
    captureException.mockReset();
  });

  it('captures unexpected errors with request id, method and url only', async () => {
    const app = await buildAppWithErrorHandler();
    const response = await app.inject({ method: 'GET', url: '/unexpected' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ code: 'internal_server_error' });
    expect(captureException).toHaveBeenCalledTimes(1);

    const [error, context] = captureException.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('database exploded');
    expect(context).toEqual({
      tags: { requestId: expect.any(String) },
      extra: { method: 'GET', url: '/unexpected' },
    });

    await app.close();
  });

  it('does not capture expected ApiErrors', async () => {
    const app = await buildAppWithErrorHandler();
    const response = await app.inject({ method: 'GET', url: '/expected' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'not_found' });
    expect(captureException).not.toHaveBeenCalled();

    await app.close();
  });
});
