import { afterEach, describe, expect, it, vi } from 'vitest';
import { createId, createPrefixedId, isUuid } from '@/shared/utils/ids';

describe('id utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when available', () => {
    const randomUUID = vi.fn(() => '123e4567-e89b-42d3-a456-426614174000');
    vi.stubGlobal('crypto', { randomUUID });

    expect(createId()).toBe('123e4567-e89b-42d3-a456-426614174000');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('creates a UUID-shaped fallback id', () => {
    vi.stubGlobal('crypto', {});

    const id = createId();

    expect(id).toEqual(expect.any(String));
    expect(isUuid(id)).toBe(true);
  });

  it('creates prefixed ids compatible with backend id length limits', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '123e4567-e89b-42d3-a456-426614174000',
    });

    const id = createPrefixedId('private-note');

    expect(id).toBe('private-note-123e4567-e89b-42d3-a456-426614174000');
    expect(id.length).toBeLessThanOrEqual(128);
  });

  it('checks UUID values only', () => {
    expect(isUuid('123e4567-e89b-42d3-a456-426614174000')).toBe(true);
    expect(isUuid('private-note-123e4567-e89b-42d3-a456-426614174000')).toBe(
      false
    );
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});
