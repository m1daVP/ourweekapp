import { describe, expect, it } from 'vitest';

import { parseSupabaseStatus, redactEvidence, runCommand } from '../scripts/database-proof-process.js';

describe('database proof process support', () => {
  it('parses uppercase Supabase status fields', () => {
    expect(parseSupabaseStatus(JSON.stringify({
      API_URL: 'http://127.0.0.1:54321',
      ANON_KEY: 'anon-secret',
      SERVICE_ROLE_KEY: 'service-secret',
      POSTGRES_VERSION: '17.4',
    }))).toEqual({
      apiUrl: 'http://127.0.0.1:54321',
      anonKey: 'anon-secret',
      serviceRoleKey: 'service-secret',
      postgresVersion: '17.4',
    });
  });

  it('parses lowercase Supabase status aliases', () => {
    expect(parseSupabaseStatus(JSON.stringify({
      api_url: 'http://localhost:54321',
      anon_key: 'anon-secret',
      service_role_key: 'service-secret',
    }))).toMatchObject({ apiUrl: 'http://localhost:54321' });
  });

  it('rejects status output without required fields', () => {
    expect(() => parseSupabaseStatus('{}')).toThrow('required local connection fields');
  });

  it('redacts secrets, JWTs, emails, and query-bearing URLs', () => {
    const redacted = redactEvidence([
      'service_role_key=super-secret',
      'authorization: Bearer-secret',
      'person@example.invalid',
      'eyJheader.payload.signature',
      'https://example.invalid/path?token=secret',
    ].join('\n'));
    expect(redacted).not.toContain('super-secret');
    expect(redacted).not.toContain('Bearer-secret');
    expect(redacted).not.toContain('person@example.invalid');
    expect(redacted).not.toContain('eyJheader.payload.signature');
    expect(redacted).not.toContain('?token=secret');
  });

  it('propagates a child process nonzero exit', () => {
    const evidence = runCommand(process.execPath, ['-e', 'process.exit(7)'], {
      label: 'synthetic failure',
      capture: true,
    });
    expect(evidence).toMatchObject({ exitCode: 7, status: 'failed' });
  });
});
