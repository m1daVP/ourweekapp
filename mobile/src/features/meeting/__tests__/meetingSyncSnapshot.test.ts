import { describe, expect, it } from 'vitest';
import { meetingSyncContent } from '../meetingSyncSnapshot';
import { meetingFixture, sharedNoteFixture } from './recapFixtures';

describe('meeting sync snapshot', () => {
  it('omits absent note attribution while preserving legacy attribution', () => {
    const meeting = meetingFixture(false);
    meeting.sections[0]!.notes.push(sharedNoteFixture());

    const notes = JSON.parse(meetingSyncContent(meeting)).sections[0].notes;

    expect(notes).toEqual([
      expect.objectContaining({ participantId: 'participant-1' }),
      expect.not.objectContaining({ participantId: expect.anything() }),
    ]);
  });
});
