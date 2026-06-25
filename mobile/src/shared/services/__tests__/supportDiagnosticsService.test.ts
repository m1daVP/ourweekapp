import { describe, expect, it } from 'vitest';
import {
  createSupportDiagnosticsSnapshot,
  serializeSupportDiagnostics,
  type SupportDiagnosticsInput,
} from '@/shared/services/supportDiagnosticsService';

const baseInput: SupportDiagnosticsInput = {
  generatedAt: '2026-06-14T10:00:00.000Z',
  app: {
    environment: 'local',
    backendOrigin: 'http://localhost:3030',
  },
  device: {
    platform: 'web',
    native: false,
    online: true,
    language: 'en-US',
  },
  account: {
    state: 'signed_in',
    role: 'owner',
  },
  subscription: {
    plan: 'free',
    premiumEntitlement: false,
    canManageSubscription: false,
  },
  localization: {
    locale: 'en',
  },
  sync: {
    state: 'failed',
    resources: ['meetings'],
    conflictCount: 1,
    lastAttemptedAt: '2026-06-14T09:58:00.000Z',
    errorMessage: 'Sync could not finish right now.',
  },
  storage: {
    hasIssue: true,
    messageCount: 1,
    backupCount: 1,
  },
  backend: {
    health: { state: 'unreachable' },
    liveness: { state: 'unreachable' },
    readiness: { state: 'not_ready', httpStatus: 503 },
  },
};

describe('supportDiagnosticsService', () => {
  it('creates diagnostics with category state and no family content fields', () => {
    const diagnostics = createSupportDiagnosticsSnapshot(baseInput);

    expect(diagnostics.account).toEqual({
      state: 'signed_in',
      role: 'owner',
    });
    expect(diagnostics.sync).toMatchObject({
      state: 'failed',
      conflictCount: 1,
    });
    expect(diagnostics.storage).toEqual({
      hasIssue: true,
      messageCount: 1,
      backupCount: 1,
    });
  });

  it('redacts sensitive fields before serialization', () => {
    const diagnostics = createSupportDiagnosticsSnapshot({
      ...baseInput,
      account: {
        ...baseInput.account,
        email: 'rita@example.com',
      } as never,
      backend: {
        ...baseInput.backend,
        accessToken: 'secret-token',
        privateNotes: 'private note body',
        meetingTitle: 'Difficult week',
      } as never,
    });
    const serialized = serializeSupportDiagnostics(diagnostics);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    expect(serialized).not.toContain('rita@example.com');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('private note body');
    expect(serialized).not.toContain('Difficult week');
    expect(parsed.account).not.toHaveProperty('email');
  });

  it('omits user agent and drops unknown fields before serialization', () => {
    const diagnostics = createSupportDiagnosticsSnapshot({
      ...baseInput,
      device: {
        ...baseInput.device,
        userAgent: 'Mozilla/5.0 detailed fingerprint',
      } as never,
      sync: {
        ...baseInput.sync,
        message: 'Meeting note hidden under a harmless key.',
      } as never,
      backend: {
        ...baseInput.backend,
        value: 'private note hidden under value',
        payload: 'task hidden under payload',
      } as never,
    });
    const serialized = serializeSupportDiagnostics(diagnostics);
    const parsed = JSON.parse(serialized) as {
      device: Record<string, unknown>;
      sync: Record<string, unknown>;
      backend: Record<string, unknown>;
    };

    expect(serialized).not.toContain('Mozilla/5.0 detailed fingerprint');
    expect(serialized).not.toContain('Meeting note hidden');
    expect(serialized).not.toContain('private note hidden');
    expect(serialized).not.toContain('task hidden');
    expect(parsed.device).not.toHaveProperty('userAgent');
    expect(parsed.sync).not.toHaveProperty('message');
    expect(parsed.backend).not.toHaveProperty('value');
    expect(parsed.backend).not.toHaveProperty('payload');
  });

  it('handles backend health failures without throwing', () => {
    expect(() =>
      createSupportDiagnosticsSnapshot({
        ...baseInput,
        backend: {
          health: { state: 'unreachable' },
          liveness: { state: 'unreachable' },
          readiness: { state: 'unreachable' },
        },
      })
    ).not.toThrow();
  });
});
