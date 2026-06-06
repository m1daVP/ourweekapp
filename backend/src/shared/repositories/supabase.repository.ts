import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { ApiError } from '../errors/index.js';

export type SupabaseRepositoryClient = SupabaseClient;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export function throwOnSupabaseError(
  error: PostgrestError | null,
  code = 'database_error',
  message = 'Unable to complete the database operation.',
): asserts error is null {
  if (!error) {
    return;
  }

  throw new ApiError(500, code, message, {
    databaseCode: error.code,
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
