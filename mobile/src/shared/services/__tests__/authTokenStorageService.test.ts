import { beforeEach, describe, expect, it, vi } from 'vitest';

const secureStorage = vi.hoisted(() => ({
  get: vi.fn(),
  remove: vi.fn(),
  set: vi.fn(),
  setDefaultKeychainAccess: vi.fn(),
  setKeyPrefix: vi.fn(),
  setSynchronize: vi.fn(),
}));
const debugSafely = vi.hoisted(() => vi.fn());
const warnSafely = vi.hoisted(() => vi.fn());

vi.mock('@aparajita/capacitor-secure-storage', () => ({
  KeychainAccess: {
    whenUnlockedThisDeviceOnly: 1,
  },
  SecureStorage: secureStorage,
}));

vi.mock('@/shared/services/safeLogService', () => ({
  debugSafely,
  warnSafely,
}));

async function loadService() {
  return import('@/shared/services/authTokenStorageService');
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  secureStorage.get.mockResolvedValue(null);
  secureStorage.remove.mockResolvedValue(false);
  secureStorage.set.mockResolvedValue(undefined);
  secureStorage.setDefaultKeychainAccess.mockResolvedValue(undefined);
  secureStorage.setKeyPrefix.mockResolvedValue(undefined);
  secureStorage.setSynchronize.mockResolvedValue(undefined);
});

describe('authTokenStorageService', () => {
  it('writes the complete session in one secure-storage operation', async () => {
    const { writeAuthTokens } = await loadService();
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-07-21T14:00:00.000Z',
    };

    await writeAuthTokens(tokens);

    expect(secureStorage.set).toHaveBeenCalledOnce();
    expect(secureStorage.set).toHaveBeenCalledWith('session', tokens, false);
    expect(secureStorage.remove).not.toHaveBeenCalled();
  });

  it('does not verify a write that explicitly rejects', async () => {
    secureStorage.set.mockRejectedValue(new Error('native write failed'));
    const { writeAuthTokens } = await loadService();
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-07-21T14:00:00.000Z',
    };

    await expect(writeAuthTokens(tokens)).rejects.toMatchObject({
      code: 'secure_storage_native_error',
      name: 'AuthTokenStorageError',
      operation: 'write_session',
    });

    expect(secureStorage.get).not.toHaveBeenCalled();
  });

  it('recovers a timed-out write when the exact session is readable', async () => {
    vi.useFakeTimers();
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-07-21T14:00:00.000Z',
    };
    secureStorage.set.mockReturnValue(new Promise(() => undefined));
    secureStorage.get.mockResolvedValue(tokens);
    const { writeAuthTokens } = await loadService();

    try {
      const writePromise = writeAuthTokens(tokens);
      await vi.advanceTimersByTimeAsync(4_000);

      await expect(writePromise).resolves.toBeUndefined();
      expect(secureStorage.get).toHaveBeenCalledOnce();
      expect(secureStorage.get).toHaveBeenCalledWith('session', false);
      expect(debugSafely).toHaveBeenCalledWith(
        'Secure auth storage write recovered.',
        {
          operation: 'verify_session',
          outcome: 'recovered_after_write_timeout',
        }
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects a timed-out write when read-back does not match', async () => {
    vi.useFakeTimers();
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-07-21T14:00:00.000Z',
    };
    secureStorage.set.mockReturnValue(new Promise(() => undefined));
    secureStorage.get.mockResolvedValue({
      ...tokens,
      refreshToken: 'different-refresh-token',
    });
    const { writeAuthTokens } = await loadService();

    try {
      const writePromise = writeAuthTokens(tokens);
      const rejection = expect(writePromise).rejects.toMatchObject({
        code: 'secure_storage_verification_failed',
        operation: 'verify_session',
      });
      await vi.advanceTimersByTimeAsync(4_000);

      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects when both write acknowledgement and verification time out', async () => {
    vi.useFakeTimers();
    secureStorage.set.mockReturnValue(new Promise(() => undefined));
    secureStorage.get.mockReturnValue(new Promise(() => undefined));
    const { writeAuthTokens } = await loadService();
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-07-21T14:00:00.000Z',
    };

    try {
      const writePromise = writeAuthTokens(tokens);
      const rejection = expect(writePromise).rejects.toMatchObject({
        code: 'secure_storage_timeout',
        operation: 'verify_session',
      });
      await vi.advanceTimersByTimeAsync(8_000);

      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a late write callback after read-back recovery', async () => {
    vi.useFakeTimers();
    const tokenWrite = createDeferred<void>();
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-07-21T14:00:00.000Z',
    };
    secureStorage.set.mockReturnValue(tokenWrite.promise);
    secureStorage.get.mockResolvedValue(tokens);
    const { writeAuthTokens } = await loadService();

    try {
      const writePromise = writeAuthTokens(tokens);
      await vi.advanceTimersByTimeAsync(4_000);
      await expect(writePromise).resolves.toBeUndefined();

      tokenWrite.resolve();
      await Promise.resolve();

      expect(secureStorage.get).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads the atomic session without touching legacy token keys', async () => {
    const tokens = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-07-21T14:00:00.000Z',
    };
    secureStorage.get.mockResolvedValue(tokens);
    const { readAuthTokens } = await loadService();

    await expect(readAuthTokens()).resolves.toEqual(tokens);

    expect(secureStorage.get).toHaveBeenCalledOnce();
    expect(secureStorage.get).toHaveBeenCalledWith('session', false);
    expect(secureStorage.set).not.toHaveBeenCalled();
  });

  it('migrates legacy token keys into the atomic session record', async () => {
    secureStorage.get.mockImplementation(async (key: string) => {
      const values: Record<string, unknown> = {
        session: null,
        'access-token': 'legacy-access-token',
        'refresh-token': 'legacy-refresh-token',
        'expires-at': '2026-07-21T14:00:00.000Z',
      };

      return values[key] ?? null;
    });
    const { readAuthTokens } = await loadService();

    await expect(readAuthTokens()).resolves.toEqual({
      accessToken: 'legacy-access-token',
      refreshToken: 'legacy-refresh-token',
      expiresAt: '2026-07-21T14:00:00.000Z',
    });

    expect(secureStorage.set).toHaveBeenCalledWith(
      'session',
      {
        accessToken: 'legacy-access-token',
        refreshToken: 'legacy-refresh-token',
        expiresAt: '2026-07-21T14:00:00.000Z',
      },
      false
    );
    expect(secureStorage.remove.mock.calls).toEqual([
      ['access-token'],
      ['refresh-token'],
      ['expires-at'],
    ]);
  });

  it('keeps legacy tokens available when migration cleanup fails', async () => {
    secureStorage.get.mockImplementation(async (key: string) => {
      const values: Record<string, unknown> = {
        session: null,
        'access-token': 'legacy-access-token',
        'refresh-token': 'legacy-refresh-token',
        'expires-at': null,
      };

      return values[key] ?? null;
    });
    secureStorage.remove.mockRejectedValueOnce(new Error('cleanup failed'));
    const { readAuthTokens } = await loadService();

    await expect(readAuthTokens()).resolves.toEqual({
      accessToken: 'legacy-access-token',
      refreshToken: 'legacy-refresh-token',
      expiresAt: null,
    });
    expect(warnSafely).toHaveBeenCalledWith(
      'Unable to clear secure auth token storage.',
      {
        errorCategory: 'secure_storage_native_error',
        operation: 'remove_legacy_access_token',
      }
    );
  });

  it('clears both the atomic session and legacy keys sequentially', async () => {
    const { clearAuthTokens } = await loadService();

    await clearAuthTokens();

    expect(secureStorage.remove.mock.calls).toEqual([
      ['session'],
      ['access-token'],
      ['refresh-token'],
      ['expires-at'],
    ]);
    expect(secureStorage.remove.mock.invocationCallOrder).toEqual(
      [...secureStorage.remove.mock.invocationCallOrder].sort()
    );
  });

  it('bounds every cleanup operation and continues best-effort', async () => {
    vi.useFakeTimers();
    secureStorage.remove.mockReturnValue(new Promise(() => undefined));
    const { clearAuthTokens } = await loadService();

    try {
      const clearPromise = clearAuthTokens();
      await vi.runAllTimersAsync();

      await expect(clearPromise).resolves.toBeUndefined();
      expect(secureStorage.remove.mock.calls).toEqual([
        ['session'],
        ['access-token'],
        ['refresh-token'],
        ['expires-at'],
      ]);
      expect(warnSafely).toHaveBeenCalledTimes(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it('bounds startup session reads', async () => {
    vi.useFakeTimers();
    secureStorage.get.mockReturnValue(new Promise(() => undefined));
    const { readAuthTokens } = await loadService();

    try {
      const readPromise = readAuthTokens();
      const rejection = expect(readPromise).rejects.toMatchObject({
        code: 'secure_storage_timeout',
        operation: 'read_session',
      });
      await vi.advanceTimersByTimeAsync(4_000);

      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });
});
