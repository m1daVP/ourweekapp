import { describe, expect, it } from 'vitest';
import { normalizeOpaqueHexColor } from '../avatarColor';

describe('normalizeOpaqueHexColor', () => {
  it('normalizes an opaque six-digit hex color', () => {
    expect(normalizeOpaqueHexColor(' #A1B2C3 ')).toBe('#a1b2c3');
  });

  it.each(['#abc', 'a1b2c3', '#a1b2c3ff', '#a1b2cg', ''])(
    'rejects %j',
    (value) => {
      expect(normalizeOpaqueHexColor(value)).toBeNull();
    }
  );
});
