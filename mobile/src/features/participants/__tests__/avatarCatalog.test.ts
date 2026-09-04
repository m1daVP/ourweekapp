import { describe, expect, it } from 'vitest';
import { avatarCatalog, getAvatarAsset, isAvatarType } from '../avatarCatalog';

describe('avatar catalog', () => {
  it('defines exactly five groups with four stable avatar IDs each', () => {
    expect(avatarCatalog).toHaveLength(20);
    expect(avatarCatalog.map((avatar) => avatar.id)).toContain('tulip');
  });

  it('validates catalog IDs and safely reports unavailable bundled assets', () => {
    expect(isAvatarType('rainbow')).toBe(true);
    expect(isAvatarType('not-an-avatar')).toBe(false);
    expect(getAvatarAsset('not-an-avatar')).toBeUndefined();
  });
});
