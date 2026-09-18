import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { haptics } from '@/shared/services/hapticsService';
import { warnSafely } from '@/shared/services/safeLogService';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn() },
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn(),
    notification: vi.fn(),
    selectionStart: vi.fn(),
    selectionChanged: vi.fn(),
    selectionEnd: vi.fn(),
  },
  ImpactStyle: {
    Light: 'LIGHT',
    Medium: 'MEDIUM',
  },
  NotificationType: {
    Success: 'SUCCESS',
  },
}));

vi.mock('@/shared/services/safeLogService', () => ({
  warnSafely: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('haptics', () => {
  it('does nothing in the browser', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    await haptics.confirm();

    expect(Haptics.impact).not.toHaveBeenCalled();
    expect(Haptics.notification).not.toHaveBeenCalled();
  });

  it('uses a light impact for an ordinary confirmation', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    await haptics.confirm();

    expect(Haptics.impact).toHaveBeenCalledWith({
      style: ImpactStyle.Light,
    });
  });

  it('uses a success notification for a completed meeting', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    await haptics.completeMeeting();

    expect(Haptics.notification).toHaveBeenCalledWith({
      type: NotificationType.Success,
    });
  });

  it('uses a medium impact for a confirmed deletion', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    await haptics.impact();

    expect(Haptics.impact).toHaveBeenCalledWith({
      style: ImpactStyle.Medium,
    });
  });

  it('uses semantic feedback for removal and refresh readiness', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    await haptics.remove();
    await haptics.refreshReady();

    expect(Haptics.impact).toHaveBeenNthCalledWith(1, {
      style: ImpactStyle.Medium,
    });
    expect(Haptics.impact).toHaveBeenNthCalledWith(2, {
      style: ImpactStyle.Light,
    });
  });

  it('uses selection feedback for wheel interaction', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    await haptics.wheelStart();
    await haptics.wheelChange();
    await haptics.wheelEnd();

    expect(Haptics.selectionStart).toHaveBeenCalledOnce();
    expect(Haptics.selectionChanged).toHaveBeenCalledOnce();
    expect(Haptics.selectionEnd).toHaveBeenCalledOnce();
  });

  it('skips semantic feedback in the browser', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    await haptics.remove();
    await haptics.refreshReady();
    await haptics.wheelStart();
    await haptics.wheelChange();
    await haptics.wheelEnd();

    expect(Haptics.impact).not.toHaveBeenCalled();
    expect(Haptics.selectionStart).not.toHaveBeenCalled();
    expect(Haptics.selectionChanged).not.toHaveBeenCalled();
    expect(Haptics.selectionEnd).not.toHaveBeenCalled();
  });

  it('absorbs selection plugin failures', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Haptics.selectionChanged).mockRejectedValueOnce(
      new Error('unavailable')
    );

    await expect(haptics.wheelChange()).resolves.toBeUndefined();

    expect(warnSafely).toHaveBeenCalledWith(
      'Unable to provide haptic feedback.',
      expect.any(Error)
    );
  });

  it('absorbs native plugin failures', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Haptics.impact).mockRejectedValueOnce(new Error('unavailable'));

    await expect(haptics.confirm()).resolves.toBeUndefined();

    expect(warnSafely).toHaveBeenCalledWith(
      'Unable to provide haptic feedback.',
      expect.any(Error)
    );
  });
});
