import { spawnSync } from 'node:child_process';

export type CommandEvidence = {
  label: string;
  startedAt: string;
  finishedAt: string;
  exitCode: number;
  status: 'passed' | 'failed';
  output?: string;
};

export type SupabaseStatus = {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  postgresVersion?: string;
};

export function executable(name: 'npm' | 'npx') {
  return name;
}

function launch(command: string, args: readonly string[]) {
  if (process.platform === 'win32' && (command === 'npm' || command === 'npx')) {
    return {
      command: process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', command, ...args],
    };
  }
  return { command, args: [...args] };
}

function statusValue(record: Record<string, unknown>, names: readonly string[]) {
  for (const name of names) {
    const value = record[name];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

export function parseSupabaseStatus(json: string): SupabaseStatus {
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const apiUrl = statusValue(parsed, ['API_URL', 'apiUrl', 'api_url']);
  const anonKey = statusValue(parsed, ['ANON_KEY', 'anonKey', 'anon_key']);
  const serviceRoleKey = statusValue(parsed, ['SERVICE_ROLE_KEY', 'serviceRoleKey', 'service_role_key']);
  const postgresVersion = statusValue(parsed, ['POSTGRES_VERSION', 'postgresVersion', 'postgres_version']);
  if (!apiUrl || !anonKey || !serviceRoleKey) {
    throw new Error('Supabase status did not contain the required local connection fields.');
  }
  return { apiUrl, anonKey, serviceRoleKey, ...(postgresVersion ? { postgresVersion } : {}) };
}

export function redactEvidence(value: string) {
  return value
    .replace(/\b[A-Za-z0-9_-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-jwt]')
    .replace(/(authorization|apikey|api[_-]?key|service[_-]?role[_-]?key|anon[_-]?key|password|token)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/https?:\/\/[^\s)]+\?[^\s)]*/gi, '[redacted-url]')
    .trim();
}

export function runCommand(
  command: string,
  args: readonly string[],
  options: { env?: NodeJS.ProcessEnv; capture?: boolean; label: string; cwd?: string },
): CommandEvidence {
  const startedAt = new Date().toISOString();
  const invocation = launch(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    windowsHide: true,
  });
  const finishedAt = new Date().toISOString();
  const exitCode = result.status ?? 1;
  const rawOutput = options.capture ? `${result.stdout ?? ''}\n${result.stderr ?? ''}` : undefined;
  const output = rawOutput ? redactEvidence(rawOutput) : undefined;
  return {
    label: options.label,
    startedAt,
    finishedAt,
    exitCode,
    status: exitCode === 0 ? 'passed' : 'failed',
    ...(output ? { output } : {}),
  };
}

export function captureSecretCommand(
  command: string,
  args: readonly string[],
  options: { env?: NodeJS.ProcessEnv; label: string; cwd?: string },
) {
  const invocation = launch(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: 'pipe',
    windowsHide: true,
  });
  if ((result.status ?? 1) !== 0) throw new Error(`${options.label} failed.`);
  return String(result.stdout ?? '');
}

export function requirePassed(evidence: CommandEvidence) {
  if (evidence.status === 'failed') throw new Error(`${evidence.label} failed.`);
}
