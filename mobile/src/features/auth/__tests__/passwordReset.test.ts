import { describe, expect, it, vi } from 'vitest';
import {
  normalizeResetPasswordToken,
  submitResetPasswordConfirmation,
  validateResetPasswordInput,
} from '@/features/auth/passwordReset';

describe('password reset confirmation helpers', () => {
  it('normalizes query token values', () => {
    expect(normalizeResetPasswordToken(' reset-token ')).toBe('reset-token');
    expect(normalizeResetPasswordToken([' first-token ', 'second-token'])).toBe(
      'first-token'
    );
    expect(normalizeResetPasswordToken(undefined)).toBe('');
  });

  it('rejects missing tokens and short passwords before submitting', async () => {
    const request = vi.fn();

    expect(
      validateResetPasswordInput({ token: '', password: 'password123' })
    ).toBe('missingToken');
    expect(validateResetPasswordInput({ token: 'token', password: '' })).toBe(
      'missingPassword'
    );
    expect(
      validateResetPasswordInput({ token: 'token', password: 'short' })
    ).toBe('passwordTooShort');

    await expect(
      submitResetPasswordConfirmation(
        { token: '', password: 'password123' },
        request
      )
    ).resolves.toEqual({ status: 'invalid', error: 'missingToken' });
    expect(request).not.toHaveBeenCalled();
  });

  it('submits a trimmed token and password to the backend wrapper', async () => {
    const request = vi.fn().mockResolvedValue(undefined);

    await expect(
      submitResetPasswordConfirmation(
        { token: ' reset-token ', password: 'password123' },
        request
      )
    ).resolves.toEqual({ status: 'success' });

    expect(request).toHaveBeenCalledWith({
      token: 'reset-token',
      password: 'password123',
    });
  });
});
