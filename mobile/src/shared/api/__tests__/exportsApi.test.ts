import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequestBlob } from '@/shared/api/httpClient';
import {
  exportMeetingPdf,
  filenameFromContentDisposition,
} from '@/shared/api/exportsApi';

vi.mock('@/shared/api/httpClient', () => ({
  apiRequestBlob: vi.fn(),
}));

const apiRequestBlobMock = vi.mocked(apiRequestBlob);

beforeEach(() => {
  apiRequestBlobMock.mockReset();
  apiRequestBlobMock.mockResolvedValue({
    blob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
    contentDisposition: 'attachment; filename="weekly.pdf"',
  });
});

describe('exportsApi', () => {
  it('requests the authenticated server PDF endpoint', async () => {
    await exportMeetingPdf('meeting-1');

    expect(apiRequestBlobMock).toHaveBeenCalledWith('/exports/meeting/pdf', {
      method: 'POST',
      body: { meetingId: 'meeting-1' },
      headers: { Accept: 'application/pdf' },
      requiresAuth: true,
    });
  });

  it('uses a safe fallback for unsafe attachment filenames', () => {
    expect(
      filenameFromContentDisposition(
        'attachment; filename="../../meeting.pdf"',
        'fallback.pdf'
      )
    ).toBe('meeting.pdf');
    expect(filenameFromContentDisposition(null, 'fallback.pdf')).toBe(
      'fallback.pdf'
    );
  });
});
