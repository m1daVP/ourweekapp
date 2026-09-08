import { describe, expect, it } from 'vitest';
import { avatarCatalog, getAvatarAsset, isAvatarType } from '../avatarCatalog';

describe('avatar catalog', () => {
  it('validates catalog IDs and safely reports unavailable bundled assets', () => {
    expect(isAvatarType('rainbow')).toBe(true);
    expect(isAvatarType('not-an-avatar')).toBe(false);
    expect(getAvatarAsset('not-an-avatar')).toBeUndefined();
  });
});
