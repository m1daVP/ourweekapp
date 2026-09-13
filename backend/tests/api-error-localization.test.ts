import { describe, expect, it } from 'vitest';

import {
  getLocalizedApiErrorMessage,
  resolveApiLocale,
} from '../src/shared/localization/api-error-localization.js';

describe('API error localization', () => {
  it.each([
    ['uk', 'uk'],
    ['uk-UA, en;q=0.8', 'uk'],
    ['fr-CA;q=0.4, es-ES;q=0.9, en;q=0.8', 'es'],
    ['de-DE, fr;q=0.9', 'en'],
    [undefined, 'en'],
  ] as const)('resolves %s to %s', (header, expected) => {
    expect(resolveApiLocale(header)).toBe(expected);
  });

  it('localizes expected API errors by stable code', () => {
    expect(
      getLocalizedApiErrorMessage('uk', 'meeting_not_found', 404, 'Meeting not found.'),
    ).toBe('Зустріч не знайдено.');
  });

  it.each([
    [
      'uk',
      'Обліковий запис із цією адресою електронної пошти вже існує. Увійдіть у систему.',
    ],
    [
      'es',
      'Ya existe una cuenta con esta dirección de correo electrónico. Inicia sesión.',
    ],
  ] as const)('preserves the email-conflict meaning in %s', (locale, expected) => {
    expect(
      getLocalizedApiErrorMessage(
        locale,
        'email_already_registered',
        409,
        'An account with this email address already exists. Sign in instead.',
      ),
    ).toBe(expected);
  });

  it('uses the original English message when English is selected', () => {
    expect(
      getLocalizedApiErrorMessage('en', 'future_error_code', 500, 'Safe fallback.'),
    ).toBe('Safe fallback.');
  });

  it('keeps detailed fallback copy when a code has no reviewed translation', () => {
    expect(
      getLocalizedApiErrorMessage(
        'es',
        'future_error_code',
        500,
        'Unable to complete the specific operation.',
      ),
    ).toBe('Unable to complete the specific operation.');
  });
});
