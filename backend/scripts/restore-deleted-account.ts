import 'dotenv/config';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import {
  supabaseServiceRoleKeySchema,
  supabaseUrlSchema,
} from '../src/config/supabase-env.schema.js';
import { createServiceRoleSupabaseClient } from '../src/shared/supabase/create-service-client.js';

const argumentsSchema = z.object({
  email: z.string().trim().email(),
});

const restoreEnvironmentSchema = z.object({
  SUPABASE_URL: supabaseUrlSchema,
  SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKeySchema,
});

type RestoreResult = {
  restoredWorkspaceCount: number;
  restoredMembershipCount: number;
};

type AccountRestoreRow = {
  restored_workspace_count: number;
  restored_membership_count: number;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isAccountRestoreRow(value: unknown): value is AccountRestoreRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const row = value as Record<string, unknown>;
  return typeof row.restored_workspace_count === 'number'
    && typeof row.restored_membership_count === 'number';
}

export async function restoreDeletedAccount(
  supabase: SupabaseClient,
  emailInput: string,
): Promise<RestoreResult> {
  const email = argumentsSchema.parse({ email: emailInput }).email;
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id,deleted_at')
    .eq('email_normalized', normalizeEmail(email))
    .maybeSingle();

  if (userError || !user || !user.deleted_at) {
    throw new Error('No deleted account matches that email address.');
  }

  const { data, error } = await supabase
    .rpc('account_restore', { p_user_id: user.id })
    .returns<AccountRestoreRow[]>();
  const restoreRow = Array.isArray(data) ? data[0] : undefined;

  if (error || !isAccountRestoreRow(restoreRow)) {
    throw new Error('Account restoration could not be completed.');
  }

  return {
    restoredWorkspaceCount: restoreRow.restored_workspace_count,
    restoredMembershipCount: restoreRow.restored_membership_count,
  };
}

function parseArguments(argv: readonly string[]) {
  if (argv.length !== 2 || argv[0] !== '--email') {
    throw new Error('Usage: npm run account:restore -- --email <email>');
  }

  return argumentsSchema.parse({ email: argv[1] });
}

async function main() {
  const { email } = parseArguments(process.argv.slice(2));
  const environment = restoreEnvironmentSchema.parse(process.env);
  const supabase = createServiceRoleSupabaseClient(
    environment.SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
  );
  const result = await restoreDeletedAccount(supabase, email);

  process.stdout.write(
    `Account restored: ${result.restoredWorkspaceCount} workspace(s), ${result.restoredMembershipCount} membership(s).\n`,
  );
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll('\\', '/')}`) {
  main().catch((error: unknown) => {
    const message = error instanceof z.ZodError
      ? 'Invalid command input or Supabase configuration.'
      : error instanceof Error
        ? error.message
        : 'Account restoration could not be completed.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
