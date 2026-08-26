import { describe, expect, it } from 'vitest';
import {
  formatAiQuotaMessage,
  getAiQuotaMessage,
  parseAiQuotaError,
} from '@/features/meeting/aiSummaryService';
import { ApiClientError } from '@/shared/api/httpClient';

function quotaError(details: Record<string, unknown>) {
  return new ApiClientError(
    'Please wait before generating another AI summary.',
    {
      status: 429,
      code: 'ai_summary_rate_limited',
      details,
    }
  );
}

describe('parseAiQuotaError', () => {
  it('parses a well-formed user-scope quota error', () => {
    expect(
      parseAiQuotaError(
        quotaError({
          userLimit: 5,
          workspaceLimit: 20,
          windowSeconds: 3600,
          scope: 'user',
          remaining: 0,
          resetAt: '2026-07-15T15:45:00.000Z',
        })
      )
    ).toEqual({ scope: 'user', limit: 5, resetAt: '2026-07-15T15:45:00.000Z' });
  });

  it('parses a well-formed workspace-scope quota error', () => {
    expect(
      parseAiQuotaError(
        quotaError({
          userLimit: 5,
          workspaceLimit: 20,
          windowSeconds: 3600,
          scope: 'workspace',
          remaining: 0,
          resetAt: '2026-07-15T15:45:00.000Z',
        })
      )
    ).toEqual({
      scope: 'workspace',
      limit: 20,
      resetAt: '2026-07-15T15:45:00.000Z',
    });
  });

  it('returns null for a non-quota ApiClientError', () => {
    expect(
      parseAiQuotaError(
        new ApiClientError('Too many requests.', {
          status: 429,
          code: 'rate_limit_exceeded',
          details: {},
        })
      )
    ).toBeNull();
  });

  it('returns null for errors missing quota details', () => {
    expect(parseAiQuotaError(quotaError({ scope: 'user' }))).toBeNull();
  });

  it('returns null for a plain Error', () => {
    expect(parseAiQuotaError(new Error('boom'))).toBeNull();
  });
});

describe('formatAiQuotaMessage / getAiQuotaMessage', () => {
  it('formats a user-scope message with the limit and reset time', () => {
    const message = formatAiQuotaMessage({
      scope: 'user',
      limit: 5,
      resetAt: '2026-07-15T15:45:00.000Z',
    });

    expect(message).toContain('5');
  });

  it('formats a workspace-scope message with the limit and reset time', () => {
    const message = formatAiQuotaMessage({
      scope: 'workspace',
      limit: 20,
      resetAt: '2026-07-15T15:45:00.000Z',
    });

    expect(message).toContain('20');
  });

  it('getAiQuotaMessage returns the formatted message for a quota error', () => {
    const message = getAiQuotaMessage(
      quotaError({
        userLimit: 5,
        workspaceLimit: 20,
        windowSeconds: 3600,
        scope: 'user',
        remaining: 0,
        resetAt: '2026-07-15T15:45:00.000Z',
      })
    );

    expect(message).toContain('5');
  });

  it('getAiQuotaMessage returns null for a non-quota error', () => {
    expect(getAiQuotaMessage(new Error('boom'))).toBeNull();
  });
});
