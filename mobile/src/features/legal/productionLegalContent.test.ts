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

  it('states the controller, deletion window, local deletion boundary, and integration explanations', () => {
    const copy = JSON.stringify(privacyPolicy);
    const headings = privacyPolicy.sections.map((section) => section.heading);

    expect(copy).toContain('VADYM PASICHNYK - WebWave');
    expect(copy).toContain('ourweekapp@gmail.com');
    expect(copy).toContain('30 days');
    expect(copy).toContain('90 days');
    expect(headings).toContain('AI summaries');
    expect(headings).toContain('Google Calendar');
    expect(headings).toContain('Diagnostics');
    expect(copy).toContain('If local cleanup fails');
    expect(copy).toContain('does not itself erase data stored on your devices');
    expect(copy).toContain('Private notes are local-only');
    expect(copy).toContain('raw error messages');
    expect(copy).toContain(
      'https://developers.openai.com/api/docs/guides/your-data'
    );
    expect(copy).toContain('https://myaccount.google.com/permissions');
  });

  it('keeps Polish law and app-store billing in the terms', () => {
    const copy = JSON.stringify(termsOfService);

    expect(copy).toContain('laws of Poland');
    expect(copy).toContain('app store');
  });
});
