import { describe, expect, it } from 'vitest';

import {
  assertLinkedStagingTarget,
  assertProjectMetadataIsStaging,
  deriveStagingProjectRef,
} from '../scripts/verify-staging-database.js';

describe('staging database target guard', () => {
  it('accepts a matching HTTPS Supabase project reference', () => {
    expect(assertLinkedStagingTarget(
      'https://stagingref123.supabase.co',
      'stagingref123\n',
    )).toBe('stagingref123');
  });

  it('rejects a mismatched linked project', () => {
    expect(() => assertLinkedStagingTarget(
      'https://stagingref123.supabase.co',
      'differentref',
    )).toThrow('does not match');
  });

  it('rejects insecure, local, and non-Supabase URLs', () => {
    expect(() => deriveStagingProjectRef('http://stagingref123.supabase.co'))
      .toThrow('requires HTTPS');
    expect(() => deriveStagingProjectRef('https://localhost'))
      .toThrow('cannot target localhost');
    expect(() => deriveStagingProjectRef('https://example.com'))
      .toThrow('requires a Supabase project URL');
  });

  it('requires remote project metadata to identify the target as staging', () => {
    expect(() => assertProjectMetadataIsStaging(JSON.stringify([
      { id: 'stagingref123', name: 'OurWeek' },
    ]), 'stagingref123')).toThrow('not positively identified as staging');

    expect(() => assertProjectMetadataIsStaging(JSON.stringify([
      { id: 'otherref', name: 'OurWeek Staging' },
    ]), 'stagingref123')).toThrow('not found');

    expect(() => assertProjectMetadataIsStaging(JSON.stringify([
      { id: 'stagingref123', name: 'OurWeek Staging' },
    ]), 'stagingref123')).not.toThrow();

    expect(() => assertProjectMetadataIsStaging(JSON.stringify([
      { id: 'stagingref123', name: 'OurWeek (staging)' },
    ]), 'stagingref123')).not.toThrow();
  });
});
