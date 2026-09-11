import type { Meeting, SummarySourceRef } from './types';
import {
  buildSummarySourceSnapshot,
  sanitizeSummarySections,
} from './summarySource';

export async function summarySourceFingerprint(
  meeting: Meeting
): Promise<string> {
  const bytes = new TextEncoder().encode(
    JSON.stringify(buildSummarySourceSnapshot(meeting))
  );
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

export function resolveSummarySource(
  meeting: Meeting,
  source: SummarySourceRef | undefined
) {
  if (!source) return null;
  const section = sanitizeSummarySections(meeting.sections).find(
    (item) => item.sectionIndex === source.sectionIndex
  );
  if (!section || (source.sectionId && section.id !== source.sectionId))
    return null;
  if (source.kind === 'section') return { section, text: section.title };
  const items =
    source.kind === 'task'
      ? section.tasks
      : source.kind === 'note'
        ? section.notes
        : section.agreements;
  const matches = items.filter((item) =>
    source.itemId
      ? item.id === source.itemId
      : ('title' in item ? item.title : item.text) === source.label
  );
  const item = matches.length === 1 ? matches[0] : undefined;
  if (!item) return null;
  return {
    section,
    text:
      'title' in item
        ? [item.title, item.description].filter(Boolean).join(' — ')
        : item.text,
  };
}

export async function suggestedTaskId(
  meetingId: string,
  observation: import('./types').FollowThroughObservation
) {
  const identity = JSON.stringify([
    meetingId,
    observation.question,
    observation.sourceRefs,
  ]);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(identity)
  );
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-4' +
    hex.slice(13, 16) +
    '-8' +
    hex.slice(17, 20) +
    '-' +
    hex.slice(20, 32)
  );
}
