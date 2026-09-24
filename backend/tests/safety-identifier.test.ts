import { describe, expect, it } from 'vitest';

import { buildSafetyIdentifier } from '../src/modules/ai/safety-identifier.js';

describe('AI safety identifier', () => {
  it('creates a stable versioned identifier without exposing the raw user ID', () => {
    const secret = 'a'.repeat(32);
    const identifier = buildSafetyIdentifier('user_123@example.invalid', secret);

    expect(identifier).toMatch(/^ow-v1-[A-Za-z0-9_-]{43}$/);
    expect(identifier).toBe(buildSafetyIdentifier('user_123@example.invalid', secret));
    expect(identifier).not.toContain('user_123');
    expect(identifier).not.toContain('@example');
  });

  it('changes when either the user identity or secret changes', () => {
    expect(buildSafetyIdentifier('user-a', 'a'.repeat(32)))
      .not.toBe(buildSafetyIdentifier('user-b', 'a'.repeat(32)));
    expect(buildSafetyIdentifier('user-a', 'a'.repeat(32)))
      .not.toBe(buildSafetyIdentifier('user-a', 'b'.repeat(32)));
  });

  it('rejects blank user IDs and short secrets', () => {
    expect(() => buildSafetyIdentifier('', 'a'.repeat(32))).toThrow();
    expect(() => buildSafetyIdentifier('user-a', 'short-secret')).toThrow();
  });
});
