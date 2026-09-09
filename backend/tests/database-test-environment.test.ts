import { describe, expect, it } from 'vitest';

import { resolveDatabaseTestEnvironment } from './helpers/database-test-environment.js';

const env = (values: Record<string, string>) => values as NodeJS.ProcessEnv;

describe('database test environment', () => {
  it('returns null when no target is configured', () => {
    expect(resolveDatabaseTestEnvironment(env({}))).toBeNull();
  });

  it('accepts a complete localhost target', () => {
    expect(resolveDatabaseTestEnvironment(env({
      SUPABASE_LOCAL_URL: 'http://127.0.0.1:54321',
      SUPABASE_LOCAL_ANON_KEY: 'anon',
      SUPABASE_LOCAL_SERVICE_ROLE_KEY: 'service',
    }))).toEqual({
      target: 'local',
      url: 'http://127.0.0.1:54321',
      anonKey: 'anon',
      serviceRoleKey: 'service',
      required: false,
    });
  });

  it('rejects a non-local URL configured as local', () => {
    expect(() => resolveDatabaseTestEnvironment(env({
      SUPABASE_LOCAL_URL: 'https://project.supabase.co',
      SUPABASE_LOCAL_ANON_KEY: 'anon',
      SUPABASE_LOCAL_SERVICE_ROLE_KEY: 'service',
    }))).toThrow('Local database proof requires a localhost URL.');
  });

  it('rejects partial credential groups', () => {
    expect(() => resolveDatabaseTestEnvironment(env({
      SUPABASE_LOCAL_URL: 'http://localhost:54321',
    }))).toThrow('are required together');
  });

  it('does not enable staging without the explicit opt-in', () => {
    expect(resolveDatabaseTestEnvironment(env({
      SUPABASE_STAGING_URL: 'https://stagingref.supabase.co',
      SUPABASE_STAGING_ANON_KEY: 'anon',
      SUPABASE_STAGING_SERVICE_ROLE_KEY: 'service',
    }))).toBeNull();
  });

  it('rejects insecure and local staging URLs', () => {
    const base = {
      SUPABASE_STAGING_ANON_KEY: 'anon',
      SUPABASE_STAGING_SERVICE_ROLE_KEY: 'service',
      ALLOW_STAGING_DB_TESTS: 'true',
    };
    expect(() => resolveDatabaseTestEnvironment(env({
      ...base,
      SUPABASE_STAGING_URL: 'http://stagingref.supabase.co',
    }))).toThrow('Staging database proof requires HTTPS.');
    expect(() => resolveDatabaseTestEnvironment(env({
      ...base,
      SUPABASE_STAGING_URL: 'https://localhost:54321',
    }))).toThrow('Staging database proof cannot target localhost.');
  });

  it('accepts explicitly opted-in HTTPS staging and required mode', () => {
    expect(resolveDatabaseTestEnvironment(env({
      SUPABASE_STAGING_URL: 'https://stagingref.supabase.co',
      SUPABASE_STAGING_ANON_KEY: 'anon',
      SUPABASE_STAGING_SERVICE_ROLE_KEY: 'service',
      ALLOW_STAGING_DB_TESTS: 'true',
      DATABASE_PROOF_REQUIRED: 'true',
    }))).toMatchObject({ target: 'staging', required: true });
  });

  it('fails required mode when no target is configured', () => {
    expect(() => resolveDatabaseTestEnvironment(env({
      DATABASE_PROOF_REQUIRED: 'true',
    }))).toThrow('Database proof credentials are required for this command.');
  });
});
