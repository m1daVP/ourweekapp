import { describe, expect, it } from 'vitest';
import {
  formatAiQuotaMessage,
  getAiQuotaMessage,
  parseAiQuotaError,
  isRecapAllowanceExhausted,
  getAiRecapRecovery,
} from '@/features/meeting/aiSummaryService';
import { ApiClientError } from '@/shared/api/httpClient';
import { AiMeetingSyncRequiredError } from '@/shared/services/syncService';

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
  it('keeps credit exhaustion separate from hourly anti-abuse limits', () => {
    const exhausted = new ApiClientError('No recaps remain.', {
      status: 429,
      code: 'recap_allowance_exhausted',
    });
    expect(isRecapAllowanceExhausted(exhausted)).toBe(true);
    expect(parseAiQuotaError(exhausted)).toBeNull();
    expect(isRecapAllowanceExhausted(quotaError({}))).toBe(false);
    expect(
      isRecapAllowanceExhausted(new Error('recap_allowance_exhausted'))
    ).toBe(false);
  });
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

describe('getAiRecapRecovery', () => {
  it('keeps allowance exhaustion separate from hourly anti-abuse limits', () => {
    const allowance = getAiRecapRecovery(
      new ApiClientError('No recaps remain.', {
        status: 429,
        code: 'recap_allowance_exhausted',
      })
    );
    const quota = getAiRecapRecovery(
      quotaError({
        userLimit: 5,
        workspaceLimit: 20,
        scope: 'user',
        resetAt: '2026-07-15T15:45:00.000Z',
      })
    );

    expect(allowance).toMatchObject({
      kind: 'allowanceExhausted',
      retryable: false,
    });
    expect(quota).toMatchObject({
      kind: 'hourlyLimit',
      messageKey: 'ai.quotaUserLimitReached',
      retryable: false,
      messageParams: expect.objectContaining({ count: 5 }),
    });
  });

  it.each([
    ['conflict', 'syncRequired', 'ai.recap.recovery.syncRequired'],
    ['missing', 'syncRequired', 'ai.recap.recovery.syncRequired'],
    ['changed', 'syncRequired', 'ai.recap.recovery.syncRequired'],
    ['failed', 'syncRequired', 'ai.recap.recovery.syncRequired'],
    ['offline', 'offline', 'ai.recap.recovery.offline'],
  ] as const)(
    'classifies completion sync %s safely',
    (reason, kind, messageKey) => {
      expect(
        getAiRecapRecovery(new AiMeetingSyncRequiredError(reason))
      ).toMatchObject({ kind, messageKey, retryable: true });
    }
  );

  it('classifies a retryable revision conflict without exposing its raw text', () => {
    const recovery = getAiRecapRecovery(
      new ApiClientError('raw meeting conflict details', {
        status: 409,
        code: 'meeting_update_conflict',
        requestId: 'req_mobile_support_123',
      })
    );

    expect(recovery).toMatchObject({
      kind: 'revisionConflict',
      messageKey: 'ai.recap.recovery.revisionConflict',
      retryable: true,
      requestId: 'req_mobile_support_123',
    });
    expect(JSON.stringify(recovery)).not.toContain(
      'raw meeting conflict details'
    );
  });

  it('classifies temporary provider, configuration, timeout, network, and unknown failures', () => {
    expect(
      getAiRecapRecovery(
        new ApiClientError('raw provider error', {
          status: 503,
          code: 'ai_summary_generation_failed',
          requestId: 'req_mobile_support_123',
        })
      )
    ).toMatchObject({
      kind: 'providerUnavailable',
      retryable: true,
      requestId: 'req_mobile_support_123',
    });
    expect(
      getAiRecapRecovery(
        new ApiClientError('not configured', {
          status: 503,
          code: 'ai_provider_not_configured',
        })
      )
    ).toMatchObject({ kind: 'configurationUnavailable', retryable: false });
    expect(
      getAiRecapRecovery(
        Object.assign(new Error('timed out'), { name: 'AbortError' })
      )
    ).toMatchObject({ kind: 'timeout', retryable: true });
    expect(getAiRecapRecovery(new TypeError('Failed to fetch'))).toMatchObject({
      kind: 'offline',
      retryable: true,
    });
    expect(getAiRecapRecovery(new Error('raw unknown failure'))).toMatchObject({
      kind: 'unknown',
      retryable: false,
    });
  });
});
