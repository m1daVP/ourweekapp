import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const signInUser = vi.hoisted(() => vi.fn());

Object.assign(process.env, {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  PUBLIC_API_BASE_URL: 'http://localhost:3000/v1',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ACCESS_TOKEN_SECRET: 'access-token-secret-at-least-32-bytes',
  REFRESH_TOKEN_SECRET: 'refresh-token-secret-at-least-32-bytes',
  PASSWORD_RESET_TOKEN_SECRET: 'password-reset-secret-at-least-32-bytes',
  TOKEN_ENCRYPTION_KEY: 'token-encryption-key-at-least-32-byte',
  CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
});

vi.mock('../src/plugins/supabase.js', async () => {
  const { default: fp } = await import('fastify-plugin');

  return {
    default: fp(async (app: FastifyInstance) => {
      app.decorate('supabase', {});
    }),
  };
});

vi.mock('../src/modules/auth/auth.service.js', () => ({
  confirmPasswordReset: vi.fn(),
  getCurrentUser: vi.fn(),
  refreshSession: vi.fn(),
  registerUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInUser,
  signOutUser: vi.fn(),
}));

function authSessionResponse() {
  const now = '2026-06-07T12:00:00.000Z';

  return {
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      workspaceId: '33333333-3333-4333-8333-333333333333',
      email: 'rita@example.com',
      displayName: 'Rita',
      role: 'owner',
      planType: 'free',
      createdAt: now,
      updatedAt: now,
    },
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt: now,
  };
}

describe('buildApp proxy awareness', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { buildApp } = await import('../src/app.js');

    app = await buildApp({ logger: false });
    app.get('/test/client-ip', async (request) => ({ ip: request.ip }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('derives request.ip from x-forwarded-for behind the Render proxy', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test/client-ip',
      remoteAddress: '10.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ip: '203.0.113.7' });
  });

  it('allows PUT requests from configured CORS origins', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/workspace',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'PUT',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-methods'])
      .toBe('GET, HEAD, POST, PUT, DELETE, OPTIONS');
  });

  it('keys rate limits per forwarded client IP, not per proxy address', async () => {
    signInUser.mockResolvedValue(authSessionResponse());
    const payload = {
      email: 'rita@example.com',
      password: 'correct-password',
    };

    // All requests arrive from the same proxy address; only the forwarded
    // client IP differs. Without trustProxy they would share one bucket.
    const firstClientResponses = [];
    for (let index = 0; index < 6; index += 1) {
      firstClientResponses.push(
        await app.inject({
          method: 'POST',
          url: '/v1/auth/sign-in',
          remoteAddress: '10.0.0.1',
          headers: { 'x-forwarded-for': '1.1.1.1' },
          payload,
        }),
      );
    }

    expect(firstClientResponses.slice(0, 5).map((response) => response.statusCode))
      .toEqual([200, 200, 200, 200, 200]);
    expect(firstClientResponses[5]?.statusCode).toBe(429);

    const otherClientResponse = await app.inject({
      method: 'POST',
      url: '/v1/auth/sign-in',
      remoteAddress: '10.0.0.1',
      headers: { 'x-forwarded-for': '2.2.2.2' },
      payload,
    });

    expect(otherClientResponse.statusCode).toBe(200);
  });
});
