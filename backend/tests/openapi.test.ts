import { beforeAll, describe, expect, it } from 'vitest';

const requiredEnv = {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  PUBLIC_API_BASE_URL: 'http://127.0.0.1:3000',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  SUPABASE_ANON_KEY: 'test-anon-key',
  ACCESS_TOKEN_SECRET: 'a'.repeat(32),
  REFRESH_TOKEN_SECRET: 'b'.repeat(32),
  PASSWORD_RESET_TOKEN_SECRET: 'c'.repeat(32),
  TOKEN_ENCRYPTION_KEY: 'd'.repeat(32),
};

type OpenApiDocument = {
  paths: Record<
    string,
    Record<
      string,
      {
        responses?: Record<string, unknown>;
        security?: Array<Record<string, string[]>>;
      }
    >
  >;
  components?: {
    securitySchemes?: Record<string, unknown>;
  };
};

describe('OpenAPI generation', () => {
  let document: OpenApiDocument;

  beforeAll(async () => {
    Object.assign(process.env, requiredEnv);

    const { buildApp } = await import('../src/app.js');
    const app = await buildApp({ logger: false });

    await app.ready();
    document = app.swagger() as OpenApiDocument;
    await app.close();
  });

  it('includes implemented public and versioned routes', () => {
    expect(document.paths['/health']?.get).toBeDefined();
    expect(document.paths['/v1/auth/register']?.post).toBeDefined();
    expect(document.paths['/v1/workspace/']?.get).toBeDefined();
    expect(document.paths['/v1/meetings/sync']?.post).toBeDefined();
    expect(document.paths['/v1/tasks/sync']?.post).toBeDefined();
    expect(document.paths['/v1/ai/meeting-summary']?.post).toBeDefined();
    expect(document.paths['/v1/account/export']?.get).toBeDefined();
  });

  it('documents bearer auth and expected error responses for protected routes', () => {
    expect(document.components?.securitySchemes?.bearerAuth).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });

    expect(document.paths['/v1/workspace/']?.get?.security).toEqual([
      { bearerAuth: [] },
    ]);
    expect(document.paths['/v1/auth/me']?.get?.security).toEqual([
      { bearerAuth: [] },
    ]);
    expect(document.paths['/v1/auth/register']?.post?.security).toBeUndefined();
    expect(document.paths['/v1/auth/sign-in']?.post?.responses).toHaveProperty('429');
    expect(document.paths['/v1/workspace/']?.get?.responses).toHaveProperty('401');
    expect(document.paths['/v1/workspace/']?.get?.responses).toHaveProperty('403');
    expect(document.paths['/v1/meetings/sync']?.post?.responses).toHaveProperty('409');
    expect(document.paths['/v1/ai/meeting-summary']?.post?.responses).toHaveProperty('429');
  });
});
