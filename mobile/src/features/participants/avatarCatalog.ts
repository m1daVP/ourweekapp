import catalog from './avatar-catalog.json';

export type AvatarType = string;
export type AvatarGroupId = string;

const bundledAvatarAssets = import.meta.glob<string>(
  '/src/assets/avatars/**/*.webp',
  { eager: true, import: 'default', query: '?url' }
);

export const avatarGroups = catalog.groups.map((group) => group.id);
export const avatarCatalog = catalog.groups.flatMap((group) =>
  group.avatars.map((avatar) => ({
    ...avatar,
    groupId: group.id,
    asset: bundledAvatarAssets[avatar.path],
  }))
);

export function getAvatarAsset(value: string | null | undefined) {
  return avatarCatalog.find((avatar) => avatar.id === value)?.asset;
}

export function isAvatarType(value: unknown): value is AvatarType {
  return (
    typeof value === 'string' &&
    avatarCatalog.some((avatar) => avatar.id === value)
  );
}
