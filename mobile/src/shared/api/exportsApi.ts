import { apiRequestBlob } from './httpClient';

function sanitizeFilename(value: string) {
  const filename = value
    .split(/[\\/]/u)
    .at(-1)
    ?.split('')
    .map((character) => {
      const codePoint = character.charCodeAt(0);
      return codePoint <= 31 || codePoint === 127 ? '-' : character;
    })
    .join('')
    .trim()
    .replace(/^\.+/, '');

  return filename || undefined;
}

export function filenameFromContentDisposition(
  contentDisposition: string | null,
  fallback: string
) {
  if (!contentDisposition) {
    return fallback;
  }

  const encodedMatch = /filename\*=UTF-8''([^;]+)/iu.exec(contentDisposition);

  if (encodedMatch?.[1]) {
    try {
      return sanitizeFilename(decodeURIComponent(encodedMatch[1])) ?? fallback;
    } catch {
      return fallback;
    }
  }

  const filenameMatch = /filename=(?:"([^"]+)"|([^;\s]+))/iu.exec(
    contentDisposition
  );
  const filename = filenameMatch?.[1] ?? filenameMatch?.[2];

  return filename ? (sanitizeFilename(filename) ?? fallback) : fallback;
}

export async function exportMeetingPdf(meetingId: string) {
  const result = await apiRequestBlob('/exports/meeting/pdf', {
    method: 'POST',
    body: { meetingId },
    headers: { Accept: 'application/pdf' },
    requiresAuth: true,
  });

  return {
    blob: result.blob,
    fileName: filenameFromContentDisposition(
      result.contentDisposition,
      `ourweek-meeting-${meetingId}.pdf`
    ),
  };
}
