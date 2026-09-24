import { describe, expect, it } from 'vitest';

import {
  renderMeetingPdf,
  type MeetingPdfDocument,
} from '../src/modules/exports/meeting-pdf.js';

const document: MeetingPdfDocument = {
  title: 'Weekly check-in',
  status: 'Completed',
  occurredOn: 'Jun 7, 2026',
  generatedOn: 'Jun 7, 2026',
  privateNotesNotice: 'Private notes are not included.',
  summary: {
    shortSummary: 'A clear plan for the week.',
    mainTopics: ['School pickup', 'Presupuesto'],
    keyTensions: ['Потрібен запасний план'],
    agreements: ['Alternate pickup'],
    tasks: [
      {
        title: 'Book dentist',
        responsible: 'Rita',
        dueDate: 'Jun 12, 2026',
        status: 'Open',
      },
    ],
    suggestedNextMeetingFocus: ['Review the pickup plan'],
  },
  sections: [
    {
      title: 'Planning',
      prompt: 'What needs attention?',
      notes: [
        {
          author: 'Rita',
          createdAt: 'Jun 7, 2026',
          text: 'Confirm Thursday pickup.',
        },
      ],
      tasks: [
        {
          title: 'Book dentist',
          responsible: 'Rita',
          dueDate: 'Jun 12, 2026',
          status: 'Open',
        },
      ],
      agreements: [{ text: 'Alternate pickup', participants: 'Rita, Alex' }],
    },
  ],
};

describe('renderMeetingPdf', () => {
  it('renders a valid branded multi-language PDF', async () => {
    const pdf = await renderMeetingPdf(document);

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1_000);
  });

  it('renders an empty meeting without placeholder lists', async () => {
    const pdf = await renderMeetingPdf({
      ...document,
      summary: undefined,
      sections: [],
    });

    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
