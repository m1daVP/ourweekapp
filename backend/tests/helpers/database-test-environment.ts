import { randomUUID } from 'node:crypto';

import {
  createClient,
  type PostgrestError,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { describe } from 'vitest';

export type DatabaseTestEnvironment = {
  target: 'local' | 'staging';
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  required: boolean;
};

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);

function configuredGroup(
  source: NodeJS.ProcessEnv,
  names: readonly [string, string, string],
) {
  const values = names.map((name) => source[name]);
  const configured = values.filter(Boolean).length;
  if (configured > 0 && configured < names.length) {
    throw new Error(`Incomplete database proof configuration: ${names.join(', ')} are required together.`);
  }
  return configured === names.length ? values as [string, string, string] : null;
}

export function resolveDatabaseTestEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): DatabaseTestEnvironment | null {
  const required = source.DATABASE_PROOF_REQUIRED === 'true';
  const local = configuredGroup(source, [
    'SUPABASE_LOCAL_URL',
    'SUPABASE_LOCAL_ANON_KEY',
    'SUPABASE_LOCAL_SERVICE_ROLE_KEY',
  ]);

  if (local) {
    const url = new URL(local[0]);
    if (!LOCAL_HOSTS.has(url.hostname)) {
      throw new Error('Local database proof requires a localhost URL.');
    }
    return {
      target: 'local',
      url: url.toString().replace(/\/$/, ''),
      anonKey: local[1],
      serviceRoleKey: local[2],
      required,
    };
  }

  const staging = configuredGroup(source, [
    'SUPABASE_STAGING_URL',
    'SUPABASE_STAGING_ANON_KEY',
    'SUPABASE_STAGING_SERVICE_ROLE_KEY',
  ]);
  if (!staging || source.ALLOW_STAGING_DB_TESTS !== 'true') {
    if (required) {
      throw new Error('Database proof credentials are required for this command.');
    }
    return null;
  }

  const url = new URL(staging[0]);
  if (url.protocol !== 'https:') {
    throw new Error('Staging database proof requires HTTPS.');
  }
  if (LOCAL_HOSTS.has(url.hostname)) {
    throw new Error('Staging database proof cannot target localhost.');
  }

  return {
    target: 'staging',
    url: url.toString().replace(/\/$/, ''),
    anonKey: staging[1],
    serviceRoleKey: staging[2],
    required,
  };
}

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const;

export function createServiceRoleClient(environment: DatabaseTestEnvironment) {
  return createClient(environment.url, environment.serviceRoleKey, clientOptions);
}

export function createAnonClient(environment: DatabaseTestEnvironment) {
  return createClient(environment.url, environment.anonKey, clientOptions);
}

export function requireDatabaseSuccess(
  error: Pick<PostgrestError, 'message'> | null,
  operation: string,
): asserts error is null {
  if (error) {
    throw new Error(`Database proof operation failed: ${operation}.`);
  }
}

export function databaseFixtureLabel(kind: string, id = randomUUID()) {
  return `db-proof-${kind}-${id}`;
}

export async function createAuthenticatedTestUser(
  environment: DatabaseTestEnvironment,
  label: string,
): Promise<{
  authUserId: string;
  client: SupabaseClient;
  cleanup(): Promise<void>;
}> {
  const service = createServiceRoleClient(environment);
  const anon = createAnonClient(environment);
  const id = randomUUID();
  const email = `db-proof-${label}-${id}@example.invalid`;
  const password = `Db-proof-${id}-A7!`;
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw new Error('Database proof operation failed: temporary Auth user creation.');
  }

  const authUserId = created.data.user.id;
  const signedIn = await anon.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) {
    await service.auth.admin.deleteUser(authUserId);
    throw new Error('Database proof operation failed: temporary Auth user sign-in.');
  }

  return {
    authUserId,
    client: anon,
    async cleanup() {
      await anon.auth.signOut();
      const result = await service.auth.admin.deleteUser(authUserId);
      if (result.error && !result.error.message.toLowerCase().includes('not found')) {
        throw new Error('Database proof operation failed: temporary Auth user cleanup.');
      }
    },
  };
}

export const databaseEnvironment = resolveDatabaseTestEnvironment();
export const describeDatabase = databaseEnvironment ? describe : describe.skip;

