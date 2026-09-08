import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('generate-secrets script', () => {
  it('outputs a Base64URL AI safety identifier secret with 256 bits of entropy', () => {
    const output = execFileSync(
      process.execPath,
      ['--import', 'tsx', resolve('scripts/generate-secrets.ts')],
      { encoding: 'utf8' },
    );

    const value = output
      .split(/\r?\n/)
      .find((line) => line.startsWith('AI_SAFETY_IDENTIFIER_SECRET='))
      ?.split('=', 2)[1];

    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
