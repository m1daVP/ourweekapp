import { describe, expect, it } from 'vitest';
import {
  PUBLIC_LEGAL_URLS,
  privacyPolicy,
  termsOfService,
} from './productionLegalContent';

describe('production legal content', () => {
  it('publishes the approved external deletion route', () => {
    expect(PUBLIC_LEGAL_URLS.deleteAccount).toBe(
      'https://ourweekapp.com/delete-account'
    );
  });

  it('states the controller, deletion window, and support route', () => {
    const copy = JSON.stringify(privacyPolicy);

    expect(copy).toContain('VADYM PASICHNYK - WebWave');
    expect(copy).toContain('ourweekapp@gmail.com');
    expect(copy).toContain('30 days');
    expect(copy).toContain('90 days');
  });

  it('keeps Polish law and app-store billing in the terms', () => {
    const copy = JSON.stringify(termsOfService);

    expect(copy).toContain('laws of Poland');
    expect(copy).toContain('app store');
  });
});
