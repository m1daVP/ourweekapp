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
    throw new ApiError(404, 'meeting_not_found', 'Meeting not found.');
  });

  app.get('/expected-server', async () => {
    throw new ApiError(500, 'database_failed', 'Unable to load data.', {
      databaseCode: 'PGRST303',
      databaseMessage: 'JWT issued at future',
    });
  });

  app.get('/expected-client', async () => {
    throw new ApiError(409, 'meeting_update_conflict', 'Meeting changed while saving summary.', {
      serverRevision: 2,
    });
  });

  app.get('/validated', {
    schema: {
      querystring: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' } },
      },
    },
    handler: async () => ({ ok: true }),
  });

  app.get('/rate-limited', async () => {
    const error = Object.assign(new Error('Rate limit exceeded'), { statusCode: 429 });
    throw error;
  });

  return app;
}

describe('error handler Sentry reporting', () => {
  beforeEach(() => {
    captureException.mockReset();
  });

  it('captures unexpected errors with request id, method and url only', async () => {
    const app = await buildAppWithErrorHandler();
    const response = await app.inject({
      method: 'GET',
      url: '/unexpected',
      headers: { 'accept-language': 'uk' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      message: 'Щось пішло не так. Спробуйте ще раз.',
      code: 'internal_server_error',
      details: {},
    });
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
    const response = await app.inject({
      method: 'GET',
      url: '/expected',
      headers: { 'accept-language': 'es-ES, en;q=0.8' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      message: 'No se encontró la reunión.',
      code: 'meeting_not_found',
      details: {},
    });
    expect(captureException).not.toHaveBeenCalled();

    await app.close();
  });

  it('removes internal details from 5xx ApiError responses', async () => {
    const app = await buildAppWithErrorHandler();
    const response = await app.inject({
      method: 'GET',
      url: '/expected-server',
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      message: 'Unable to load data.',
      code: 'database_failed',
      details: {},
    });
    expect(captureException).not.toHaveBeenCalled();

    await app.close();
  });

  it('preserves safe details in 4xx ApiError responses', async () => {
    const app = await buildAppWithErrorHandler();
    const response = await app.inject({
      method: 'GET',
      url: '/expected-client',
      headers: { 'accept-language': 'uk' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      message: 'Зустріч змінилася під час збереження підсумку. Оновіть дані та спробуйте ще раз.',
      code: 'meeting_update_conflict',
      details: { serverRevision: 2 },
    });
    expect(captureException).not.toHaveBeenCalled();

    await app.close();
  });

  it('localizes validation errors without changing safe details', async () => {
    const app = await buildAppWithErrorHandler();
    const response = await app.inject({
      method: 'GET',
      url: '/validated',
      headers: { 'accept-language': 'uk-UA' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      message: 'Перевірте запит і спробуйте ще раз.',
      code: 'validation_failed',
      details: {
        context: 'querystring',
        issues: [expect.objectContaining({ path: '' })],
      },
    });
    await app.close();
  });

  it('localizes rate-limit errors', async () => {
    const app = await buildAppWithErrorHandler();
    const response = await app.inject({
      method: 'GET',
      url: '/rate-limited',
      headers: { 'accept-language': 'es' },
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toEqual({
      message: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.',
      code: 'rate_limit_exceeded',
      details: {},
    });
    await app.close();
  });
});
