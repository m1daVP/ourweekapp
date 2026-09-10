import { afterEach, describe, expect, it, vi } from 'vitest';
import { useInAppNotification } from '../useInAppNotification';

const { dismissInAppNotification, notificationState, showInAppNotification } =
  useInAppNotification();

afterEach(() => {
  dismissInAppNotification();
  vi.useRealTimers();
});

describe('useInAppNotification', () => {
  it('dismisses a standard notification after three seconds', () => {
    vi.useFakeTimers();

    showInAppNotification('Account export downloaded.');

    expect(notificationState.value?.message).toBe('Account export downloaded.');
    vi.advanceTimersByTime(2999);
    expect(notificationState.value).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(notificationState.value).toBeNull();
  });

  it('replaces the active message and restarts its timeout', () => {
    vi.useFakeTimers();

    showInAppNotification('First message');
    const firstId = notificationState.value?.id;
    vi.advanceTimersByTime(2000);
    showInAppNotification('Second message', { tone: 'error' });

    expect(notificationState.value).toMatchObject({
      message: 'Second message',
      tone: 'error',
    });
    expect(notificationState.value?.id).not.toBe(firstId);
    vi.advanceTimersByTime(2000);
    expect(notificationState.value).not.toBeNull();
    vi.advanceTimersByTime(1000);
    expect(notificationState.value).toBeNull();
  });
});
