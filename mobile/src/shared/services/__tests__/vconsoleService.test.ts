import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  destroyVConsole,
  initializeVConsole,
  isDebugDiagnosticsEnabled,
  shouldEnableVConsole,
} from '@/shared/services/vconsoleService';

describe('vconsoleService', () => {
  beforeEach(() => {
    destroyVConsole();
  });

  it.each(['development', 'staging'])(
    'enables vConsole when explicitly enabled in %s mode',
    (mode) => {
      expect(
        shouldEnableVConsole({
          MODE: mode,
          VITE_VCONSOLE_ENABLED: 'true',
        })
      ).toBe(true);
    }
  );

  it.each([
    { MODE: 'development' },
    { MODE: 'staging', VITE_VCONSOLE_ENABLED: 'false' },
    { MODE: 'development', VITE_VCONSOLE_ENABLED: 'TRUE ' },
  ])('applies the vConsole enablement flag', (env) => {
    expect(shouldEnableVConsole(env)).toBe(
      env.VITE_VCONSOLE_ENABLED?.trim().toLowerCase() === 'true'
    );
  });

  it.each(['production', 'release'])(
    'disables vConsole in %s mode even when explicitly enabled',
    (MODE) => {
      expect(
        shouldEnableVConsole({
          MODE,
          VITE_VCONSOLE_ENABLED: 'true',
        })
      ).toBe(false);
    }
  );

  it('enables redacted diagnostics in development and explicit staging builds', () => {
    expect(isDebugDiagnosticsEnabled({ DEV: true, MODE: 'development' })).toBe(
      true
    );
    expect(
      isDebugDiagnosticsEnabled({
        MODE: 'staging',
        VITE_VCONSOLE_ENABLED: 'true',
      })
    ).toBe(true);
    expect(
      isDebugDiagnosticsEnabled({
        DEV: false,
        MODE: 'release',
        VITE_VCONSOLE_ENABLED: 'true',
      })
    ).toBe(false);
  });

  it('opens vConsole and keeps its switch above the Android safe area', async () => {
    const destroy = vi.fn();
    const setSwitchPosition = vi.fn();
    const show = vi.fn();
    const showSwitch = vi.fn();
    let receivedOptions: unknown;

    class FakeVConsole {
      destroy = destroy;
      setSwitchPosition = setSwitchPosition;
      show = show;
      showSwitch = showSwitch;

      constructor(options?: unknown) {
        receivedOptions = options;
      }
    }

    await expect(
      initializeVConsole(
        { MODE: 'staging', VITE_VCONSOLE_ENABLED: 'true' },
        async () => ({ default: FakeVConsole })
      )
    ).resolves.toBe(true);

    expect(receivedOptions).toMatchObject({
      defaultPlugins: ['system', 'network'],
      network: {
        ignoreUrlRegExp: expect.any(RegExp),
      },
    });
    const networkOptions = receivedOptions as {
      network: { ignoreUrlRegExp: RegExp };
    };
    expect(networkOptions.network.ignoreUrlRegExp.test('/v1/auth/google')).toBe(
      true
    );
    expect(setSwitchPosition).toHaveBeenCalledWith(12, 72);
    expect(showSwitch).toHaveBeenCalledOnce();
    expect(show).toHaveBeenCalledOnce();
  });

  it('swallows vConsole initialization failures', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      initializeVConsole(
        { MODE: 'staging', VITE_VCONSOLE_ENABLED: 'true' },
        async () => {
          throw new Error('Simulated vConsole load failure');
        }
      )
    ).resolves.toBe(false);

    expect(warn).toHaveBeenCalledWith(
      'OurWeek vConsole could not be initialized.'
    );
    warn.mockRestore();
  });
});
