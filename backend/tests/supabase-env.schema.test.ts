import { describe, expect, it } from 'vitest';

import {
  supabaseServiceRoleKeySchema,
  supabaseUrlSchema,
} from '../src/config/supabase-env.schema.js';

describe('supabaseServiceRoleKeySchema', () => {
  it.each(['service-role-key', 'sb_secret_example', 'legacy.jwt.key'])(
    'accepts backend key format %s',
    (key) => {
      expect(supabaseServiceRoleKeySchema.safeParse(key).success).toBe(true);
    },
  );

  it('rejects publishable keys', () => {
    const result = supabaseServiceRoleKeySchema.safeParse(
      'sb_publishable_example',
    );

    expect(result.success).toBe(false);
  });
});

describe('supabaseUrlSchema', () => {
  it.each([
    'https://example.supabase.co',
    'http://127.0.0.1:54321',
    'http://localhost:54321',
  ])('accepts Supabase API URL %s', (url) => {
    expect(supabaseUrlSchema.safeParse(url).success).toBe(true);
  });

  it('rejects Supabase database host URLs', () => {
    const result = supabaseUrlSchema.safeParse(
      'https://db.example.supabase.co:5432',
    );

    expect(result.success).toBe(false);
  });
});
