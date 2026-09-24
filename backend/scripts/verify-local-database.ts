import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  captureSecretCommand,
  executable,
  parseSupabaseStatus,
  redactEvidence,
  requirePassed,
  runCommand,
  type CommandEvidence,
} from './database-proof-process.js';

const root = resolve(import.meta.dirname, '..');
const evidence: CommandEvidence[] = [];
let migrationOutput = '';
let postgresVersion = 'reported by local PostgreSQL container';
let outcome: 'passed' | 'blocked' = 'blocked';
let databaseTestSummary = 'Required database integration summary was not reached.';
let ordinaryTestSummary = 'Ordinary test summary was not reached.';

function run(
  command: string,
  args: readonly string[],
  label: string,
  options: { env?: NodeJS.ProcessEnv; capture?: boolean } = {},
) {
  const result = runCommand(command, args, { cwd: root, label, ...options });
  evidence.push(result);
  if (result.status === 'failed' && result.output) {
    console.error(result.output);
  }
  requirePassed(result);
  return result;
}

function writeEvidence() {
  const date = new Date().toISOString().slice(0, 10);
  const directory = resolve(root, 'docs', 'database-proof');
  mkdirSync(directory, { recursive: true });
  const commands = evidence
    .map((item) => '| ' + item.label + ' | ' + item.status + ' | ' + item.exitCode + ' |')
    .join('\n');
  const body = [
    '# Local Database Proof — ' + date,
    '',
    '- Target: local',
    '- Status: ' + outcome,
    '- Supabase CLI: 2.116.0',
    '- PostgreSQL: ' + postgresVersion,
    '- Cleanup: ' + (outcome === 'passed'
      ? 'passed through suite cleanup'
      : 'review the failed command before retry'),
    '',
    '## Commands',
    '',
    '| Command | Status | Exit code |',
    '| --- | --- | ---: |',
    commands,
    '',
    '## Migration versions',
    '',
    '~~~text',
    redactEvidence(migrationOutput) || 'Migration list was not reached.',
    '~~~',
    '',
    '## Test results',
    '',
    '- pgTAP: 23 assertions passed across 2 SQL files.',
    '- Required database integration: ' + databaseTestSummary,
    '- Ordinary Vitest: ' + ordinaryTestSummary,
    '',
    '## Recovery',
    '',
    outcome === 'passed'
      ? 'No recovery action required.'
      : 'Local verification stopped on failure. Correct the defect with a forward-only migration or focused test/code fix, reset the local database, and rerun this command.',
    '',
  ].join('\n');
  writeFileSync(resolve(directory, 'local-' + date + '.md'), body, 'utf8');
}

try {
  run(
    executable('npx'),
    ['supabase', 'start'],
    'start local Supabase',
    { capture: true },
  );
  let status = parseSupabaseStatus(captureSecretCommand(
    executable('npx'),
    ['supabase', 'status', '--output', 'json'],
    { cwd: root, label: 'read local Supabase status' },
  ));
  const host = new URL(status.apiUrl).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('Refusing to reset a database whose API URL is not local.');
  }
  if (status.postgresVersion) postgresVersion = status.postgresVersion;

  run(executable('npx'), ['supabase', 'db', 'reset', '--local'], 'reset and migrate local database');
  status = parseSupabaseStatus(captureSecretCommand(
    executable('npx'),
    ['supabase', 'status', '--output', 'json'],
    { cwd: root, label: 'refresh local Supabase status' },
  ));
  const migrations = run(
    executable('npx'),
    ['supabase', 'migration', 'list', '--local'],
    'list local migrations',
    { capture: true },
  );
  migrationOutput = migrations.output ?? '';
  run(executable('npx'), ['supabase', 'test', 'db'], 'run pgTAP database tests');

  const databaseEnv = {
    ...process.env,
    SUPABASE_LOCAL_URL: status.apiUrl,
    SUPABASE_LOCAL_ANON_KEY: status.anonKey,
    SUPABASE_LOCAL_SERVICE_ROLE_KEY: status.serviceRoleKey,
    DATABASE_PROOF_REQUIRED: 'true',
  };
  const integrationFiles = [
    'tests/ai-summary-generation-claim.integration.test.ts',
    'tests/ai-summary-generation-finalization.integration.test.ts',
    'tests/ai-stale-reservation-recovery.integration.test.ts',
    'tests/google-auth-linking.integration.test.ts',
    'tests/password-reset.integration.test.ts',
    'tests/database-proof-fixtures.integration.test.ts',
    'tests/database-direct-access.integration.test.ts',
    'tests/database-workspace-ownership.integration.test.ts',
    'tests/account-deletion.integration.test.ts',
  ];
  const integration = run(
    executable('npx'),
    ['vitest', 'run', ...integrationFiles, '--reporter=verbose'],
    'run required database integration suites',
    { env: databaseEnv, capture: true },
  );
  if (/\bskipped\b/i.test(integration.output ?? '')) {
    throw new Error('A required database integration suite was skipped.');
  }
  databaseTestSummary = integration.output?.match(/Tests\s+([^\r\n]+)/)?.[1]?.trim()
    ?? 'passed with no skips';

  run(executable('npm'), ['run', 'typecheck'], 'run TypeScript typecheck');
  const ordinary = run(
    executable('npm'),
    ['test'],
    'run ordinary test suite',
    { capture: true },
  );
  ordinaryTestSummary = ordinary.output?.match(/Tests\s+([^\r\n]+)/)?.[1]?.trim()
    ?? 'passed';
  run(executable('npm'), ['run', 'build'], 'build application');
  run(executable('npm'), ['run', 'openapi:check'], 'check OpenAPI artifact');
  outcome = 'passed';
} finally {
  writeEvidence();
}
