import { describe, expect, it } from 'vitest';
import { uniqueStrings } from '@/shared/utils/collections';

describe('collection utilities', () => {
  it('trims strings, removes blanks, and preserves first-seen order', () => {
    expect(
      uniqueStrings([' a ', '', undefined, 'b', 'a', null, ' c '])
    ).toEqual(['a', 'b', 'c']);
  });
});
