import { describe, expect, it } from 'vitest';
import {
  compareIsoDesc,
  latestIso,
  nowIso,
  toDateTime,
} from '@/shared/utils/dates';

describe('date utilities', () => {
  it('creates ISO timestamps', () => {
    expect(nowIso()).toEqual(expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
  });

  it('converts invalid dates to a safe timestamp value', () => {
    expect(toDateTime('not-a-date')).toBe(0);
    expect(toDateTime(null)).toBe(0);
  });

  it('sorts ISO timestamps newest first', () => {
    const dates = [
      '2026-06-01T09:00:00.000Z',
      '2026-06-01T11:00:00.000Z',
      '2026-06-01T10:00:00.000Z',
    ];

    expect([...dates].sort(compareIsoDesc)).toEqual([
      '2026-06-01T11:00:00.000Z',
      '2026-06-01T10:00:00.000Z',
      '2026-06-01T09:00:00.000Z',
    ]);
  });

  it('chooses the latest nullable ISO value', () => {
    expect(latestIso(null, '2026-06-01T10:00:00.000Z')).toBe(
      '2026-06-01T10:00:00.000Z'
    );
    expect(
      latestIso('2026-06-01T11:00:00.000Z', '2026-06-01T10:00:00.000Z')
    ).toBe('2026-06-01T11:00:00.000Z');
  });
});
