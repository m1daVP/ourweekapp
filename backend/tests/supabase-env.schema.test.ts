import { describe, expect, it } from 'vitest';

import { supabaseServiceRoleKeySchema } from '../src/config/supabase-env.schema.js';

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
