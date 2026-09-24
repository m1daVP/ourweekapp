import { z } from 'zod';

export const supabaseUrlSchema = z
  .string()
  .url()
  .superRefine((value, context) => {
    const url = new URL(value);

    if (url.hostname.startsWith('db.') && url.hostname.endsWith('.supabase.co')) {
      context.addIssue({
        code: 'custom',
        message:
          'SUPABASE_URL must be the Supabase API URL, not the database host. Use https://<project-ref>.supabase.co.',
      });
    }

    if (url.port === '5432') {
      context.addIssue({
        code: 'custom',
        message:
          'SUPABASE_URL must not use the PostgreSQL port 5432. Use the Supabase API URL instead.',
      });
    }
  });

export const supabaseServiceRoleKeySchema = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith('sb_publishable_'), {
    message: 'SUPABASE_SERVICE_ROLE_KEY must not be a publishable key',
  });
