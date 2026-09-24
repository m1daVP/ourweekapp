import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import 'dotenv/config';

import {
  captureSecretCommand,
  executable,
  redactEvidence,
  requirePassed,
  runCommand,
  type CommandEvidence,
} from './database-proof-process.js';

export function deriveStagingProjectRef(urlValue: string) {
  const url = new URL(urlValue);
  if (url.protocol !== 'https:') throw new Error('Staging database proof requires HTTPS.');
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    throw new Error('Staging database proof cannot target localhost.');
  }
  const suffix = '.supabase.co';
  if (!url.hostname.endsWith(suffix)) {
    throw new Error('Staging database proof requires a Supabase project URL.');
  }
  const ref = url.hostname.slice(0, -suffix.length);
  if (!/^[a-z0-9]+$/.test(ref)) {
    throw new Error('Staging Supabase project reference is invalid.');
  }
  return ref;
}

export function assertLinkedStagingTarget(urlValue: string, linkedRef: string) {
  const urlRef = deriveStagingProjectRef(urlValue);
  if (linkedRef.trim() !== urlRef) {
    throw new Error('Linked Supabase project does not match the staging URL.');
  }
  return urlRef;
}

export function assertProjectMetadataIsStaging(projectsJson: string, projectRef: string) {
  const projects = JSON.parse(projectsJson) as Array<{
    id?: string;
    ref?: string;
    name?: string;
  }>;
  const project = projects.find((candidate) =>
    candidate.id === projectRef || candidate.ref === projectRef);
  if (!project) {
    throw new Error('The linked staging project was not found in the Supabase project list.');
  }
  if (!project.name || !/(^|[^a-z0-9])staging($|[^a-z0-9])/i.test(project.name)) {
    throw new Error('The linked Supabase project is not positively identified as staging.');
  }
}

function requiredEnvironment() {
  const names = [
    'SUPABASE_STAGING_URL',
    'SUPABASE_STAGING_ANON_KEY',
    'SUPABASE_STAGING_SERVICE_ROLE_KEY',
  ];
  const missing = names.filter((name) => !process.env[name]);
  if (process.env.ALLOW_STAGING_DB_TESTS !== 'true') {
    missing.push('ALLOW_STAGING_DB_TESTS');
  }
  if (missing.length > 0) {
    throw new Error('Missing staging database proof configuration: ' + missing.join(', ') + '.');
  }
  return {
    url: process.env.SUPABASE_STAGING_URL!,
    anonKey: process.env.SUPABASE_STAGING_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY!,
  };
}

export function runStagingVerification() {
  const root = resolve(import.meta.dirname, '..');
  const configuration = requiredEnvironment();
  const linkedPath = resolve(root, 'supabase', '.temp', 'project-ref');
  if (!existsSync(linkedPath)) {
    throw new Error('No linked Supabase project reference is available.');
  }
  const projectRef = assertLinkedStagingTarget(
    configuration.url,
    readFileSync(linkedPath, 'utf8'),
  );
  const projects = captureSecretCommand(
    executable('npx'),
    ['supabase', 'projects', 'list', '--output', 'json'],
    { cwd: root, label: 'inspect Supabase projects' },
  );
  assertProjectMetadataIsStaging(projects, projectRef);

  const evidence: CommandEvidence[] = [];
  const run = (
    args: readonly string[],
    label: string,
    options: { env?: NodeJS.ProcessEnv; capture?: boolean } = {},
  ) => {
    const result = runCommand(executable('npx'), args, { cwd: root, label, ...options });
    evidence.push(result);
    if (result.status === 'failed' && result.output) {
      console.error(result.output);
    }
    requirePassed(result);
    return result;
  };

  const before = run(
    ['supabase', 'migration', 'list', '--linked'],
    'list staging migrations before',
    { capture: true },
  );
  const dryRun = run(
    ['supabase', 'db', 'push', '--dry-run'],
    'dry-run staging migrations',
    { capture: true },
  );
  const apply = process.env.APPLY_STAGING_MIGRATIONS === 'true';
  let status: 'dry-run-complete' | 'passed' = 'dry-run-complete';

  if (apply) {
    run(['supabase', 'db', 'push'], 'apply staging migrations');
    run(
      ['supabase', 'migration', 'list', '--linked'],
      'list staging migrations after',
      { capture: true },
    );
    const databaseEnv = {
      ...process.env,
      SUPABASE_STAGING_URL: configuration.url,
      SUPABASE_STAGING_ANON_KEY: configuration.anonKey,
      SUPABASE_STAGING_SERVICE_ROLE_KEY: configuration.serviceRoleKey,
      ALLOW_STAGING_DB_TESTS: 'true',
      DATABASE_PROOF_REQUIRED: 'true',
    };
    const smoke = run(
      [
        'vitest',
        'run',
        'tests/database-proof-fixtures.integration.test.ts',
        'tests/database-direct-access.integration.test.ts',
        'tests/database-workspace-ownership.integration.test.ts',
        'tests/account-deletion.integration.test.ts',
        '--reporter=verbose',
      ],
      'run staging database smoke suites',
      { env: databaseEnv, capture: true },
    );
    if (/\bskipped\b/i.test(smoke.output ?? '')) {
      throw new Error('A required staging database smoke suite was skipped.');
    }
    status = 'passed';
  }

  const date = new Date().toISOString().slice(0, 10);
  const directory = resolve(root, 'docs', 'database-proof');
  mkdirSync(directory, { recursive: true });
  const file = resolve(
    directory,
    (apply ? 'staging-' : 'staging-dry-run-') + date + '.md',
  );
  const body = [
    '# Staging Database Proof — ' + date,
    '',
    '- Target: staging (' + projectRef + ')',
    '- Status: ' + status,
    '- Cleanup: ' + (apply
      ? 'passed through smoke-suite cleanup'
      : 'not applicable; no fixtures created'),
    '',
    '## Commands',
    '',
    ...evidence.map((item) => '- ' + item.label + ': ' + item.status),
    '',
    '## Migration state before',
    '',
    '~~~text',
    redactEvidence(before.output ?? ''),
    '~~~',
    '',
    '## Migration dry-run',
    '',
    '~~~text',
    redactEvidence(dryRun.output ?? ''),
    '~~~',
    '',
    '## Recovery',
    '',
    'Stop dependent deployment on failure and create a reviewed forward-only migration. Never edit an applied migration or reset staging.',
    '',
  ].join('\n');
  writeFileSync(file, body, 'utf8');
}

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === entry) runStagingVerification();
