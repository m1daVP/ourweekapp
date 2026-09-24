import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { ApiError } from '../errors/index.js';

export type SupabaseRepositoryClient = SupabaseClient;

const MAX_PROVIDER_DIAGNOSTIC_LENGTH = 256;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function sanitizeProviderDiagnostic(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  const sanitized = value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PROVIDER_DIAGNOSTIC_LENGTH);

  return sanitized || undefined;
}

export function throwOnSupabaseError(
  error: PostgrestError | null,
  code = 'database_error',
  message = 'Unable to complete the database operation.',
): asserts error is null {
  if (!error) {
    return;
  }

  const databaseMessage =
    error.code === 'PGRST303' ? sanitizeProviderDiagnostic(error.message) : undefined;
  const databaseHint =
    error.code === 'PGRST303' ? sanitizeProviderDiagnostic(error.hint) : undefined;

  throw new ApiError(500, code, message, {
    databaseCode: error.code,
    ...(databaseMessage ? { databaseMessage } : {}),
    ...(databaseHint ? { databaseHint } : {}),
  });
}

export function requireRow<T>(
  data: T | null,
  error: PostgrestError | null,
  code = 'database_error',
  message = 'Unable to load the requested record.',
) {
  throwOnSupabaseError(error, code, message);

  if (!data) {
    throw new ApiError(500, code, message);
  }

  return data;
}
