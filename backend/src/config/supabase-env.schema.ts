import { z } from 'zod';

export const supabaseServiceRoleKeySchema = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith('sb_publishable_'), {
    message: 'SUPABASE_SERVICE_ROLE_KEY must not be a publishable key',
  });
