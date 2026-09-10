import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {describe, expect, it} from 'vitest';

describe('capture safety plan', () => {
  it('requires fictional data and sandbox-only billing footage', async () => {
    const plan = await readFile(resolve(import.meta.dirname, '../capture-plan.md'), 'utf8');
    expect(plan).toContain('fictional demo household');
    expect(plan).toContain('sandbox purchase');
    expect(plan).toContain('local reminder');
    expect(plan).toContain('Never record a production account');
    expect(plan).toContain('real payment method');
  });
});
