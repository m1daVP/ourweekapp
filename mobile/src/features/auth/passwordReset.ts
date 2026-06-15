import {
  confirmPasswordReset,
  type PasswordResetConfirmRequestDto,
} from '@/shared/api/authApi';

export const minimumPasswordLength = 8;

export type ResetPasswordValidationError =
  | 'missingToken'
  | 'missingPassword'
  | 'passwordTooShort';

export type ResetPasswordResult =
  | { status: 'success' }
  | { status: 'invalid'; error: ResetPasswordValidationError };

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export type ConfirmPasswordResetRequest = (
  payload: PasswordResetConfirmRequestDto
) => Promise<void>;

export function normalizeResetPasswordToken(value: unknown) {
  if (Array.isArray(value)) {
    return normalizeResetPasswordToken(value[0]);
  }

  return typeof value === 'string' ? value.trim() : '';
}

export function validateResetPasswordInput(
  input: ResetPasswordInput
): ResetPasswordValidationError | null {
  if (!input.token.trim()) {
    return 'missingToken';
  }

  if (!input.password) {
    return 'missingPassword';
  }

  if (input.password.length < minimumPasswordLength) {
    return 'passwordTooShort';
  }

  return null;
}

export async function submitResetPasswordConfirmation(
  input: ResetPasswordInput,
  request: ConfirmPasswordResetRequest = confirmPasswordReset
): Promise<ResetPasswordResult> {
  const error = validateResetPasswordInput(input);

  if (error) {
    return { status: 'invalid', error };
  }

  await request({
    token: input.token.trim(),
    password: input.password,
  });

  return { status: 'success' };
}
