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
    ).toBe('Запитаний елемент не знайдено.');
  });

  it('uses the original English message when English is selected', () => {
    expect(
      getLocalizedApiErrorMessage('en', 'future_error_code', 500, 'Safe fallback.'),
    ).toBe('Safe fallback.');
  });
});
