import { describe, expect, it } from 'vitest';
import { buildGroundedSummaryOutput, summarySourceFingerprint } from '../src/modules/ai/follow-through.js';
import { buildSummarySourceSnapshot, type SummarySourceMeeting } from '../src/modules/ai/summary-source.js';
import { meetingSummarySchema } from '../src/modules/ai/ai.schema.js';

const meeting: SummarySourceMeeting = {
  templateId: 'weekly-family-check-in', participantIds: ['alex'], completedAt: '2026-09-01T10:00:00Z',
  sections: [{ id: 'plans', title: 'Plans',
    notes: [{ id: 'note', text: 'Pack for the trip.' }, { id: 'private', text: 'Secret', isPrivate: true }],
    tasks: [{ id: 'housing', title: 'Book housing', status: 'skipped', responsibilityType: 'participant',
      responsibleParticipantIds: ['alex'], dueDate: '2026-09-02' }],
    agreements: [{ id: 'budget', text: 'Pause optional purchases.' }],
  }],
};
const observation = {
  title: 'Clarify trip preparation', explanation: 'Packing is mentioned without a recorded next step.',
  question: 'Who will check what is ready?', kind: 'clarify', reviewHorizon: 'beforeNextMeeting',
  sourceRefs: ['s0.n0'], action: { type: 'createTask', sourceRef: 's0.n0' },
};
const output = (observations: unknown[] = [observation]) => ({
  shortSummary: 'Trip preparation needs clarification.', mainTopics: [], keyTensions: [],
  agreements: ['Invented agreement'], tasks: [{ title: 'Invented task', dueDate: '2099-01-01' }],
  suggestedNextMeetingFocus: [], observations,
});

describe('grounded meeting follow-through', () => {
  it('resolves only public source evidence and preserves actual commitments and task status', () => {
    const result = buildGroundedSummaryOutput(meeting, output());
    expect(result.tasks).toEqual([{ title: 'Book housing', sourceId: 'housing', status: 'skipped',
      responsibilityType: 'participant', responsibleParticipantIds: ['alex'], dueDate: '2026-09-02' }]);
    expect(result.agreements).toEqual(['Pause optional purchases.']);
    expect(result.followThrough.observations[0]).toMatchObject({
      sourceRefs: [{ sectionId: 'plans', sectionIndex: 0, itemId: 'note', kind: 'note', label: 'Pack for the trip.' }],
      action: { type: 'createTask', sourceRefIndex: 0 },
    });
    expect(JSON.stringify(result.followThrough)).not.toContain('Secret');
  });

  it.each(['s0.n1', 's1', 'another-workspace-task'])('rejects private or invented reference %s', (ref) => {
    expect(() => buildGroundedSummaryOutput(meeting, output([{ ...observation, sourceRefs: [ref], action: null }])))
      .toThrow('Unable to verify');
  });

  it('requires action evidence to belong to the observation', () => {
    expect(() => buildGroundedSummaryOutput(meeting, output([{ ...observation,
      action: { type: 'openSource', sourceRef: 's0.t0' } }]))).toThrow('Unable to verify');
  });

  it('opens an existing task instead of offering a duplicate', () => {
    const result = buildGroundedSummaryOutput(meeting, output([{ ...observation, sourceRefs: ['s0.n0', 's0.t0'] }]));
    expect(result.followThrough.observations[0]?.action).toEqual({ type: 'openSource', sourceRefIndex: 1 });
  });

  it('does not turn a section or recorded agreement into a new task', () => {
    for (const sourceRef of ['s0', 's0.a0']) {
      const result = buildGroundedSummaryOutput(meeting, output([{ ...observation, sourceRefs: [sourceRef],
        action: { type: 'createTask', sourceRef } }]));
      expect(result.followThrough.observations[0]?.action).toEqual({ type: 'openSource', sourceRefIndex: 0 });
    }
  });

  it('accepts no observations but rejects a missing observations field and more than three', () => {
    expect(buildGroundedSummaryOutput(meeting, output([])).followThrough.observations).toEqual([]);
    expect(() => buildGroundedSummaryOutput(meeting, {})).toThrow();
    expect(() => buildGroundedSummaryOutput(meeting, output(Array(4).fill(observation)))).toThrow();
  });

  it('keeps fingerprints stable for save metadata and changes them for public content or status', () => {
    const before = summarySourceFingerprint(meeting);
    expect(summarySourceFingerprint({ ...meeting, completedAt: '2026-09-01T10:00:00.000Z' })).toBe(before);
    const clone = structuredClone(meeting);
    const section = clone.sections[0] as { tasks: Array<{ status: string }> };
    section.tasks[0]!.status = 'done';
    expect(summarySourceFingerprint(clone)).not.toBe(before);
    const metadata = { ...meeting, updatedAt: '2099-01-01', aiSummary: output(), serverRevision: 99 };
    expect(summarySourceFingerprint(metadata)).toBe(before);
  });

  it('ignores changes to private text in source fingerprints', () => {
    const clone = structuredClone(meeting);
    const section = clone.sections[0] as { notes: Array<{ text: string }> };
    section.notes[1]!.text = 'Changed private text';
    expect(summarySourceFingerprint(clone)).toBe(summarySourceFingerprint(meeting));
    expect(JSON.stringify(buildSummarySourceSnapshot(clone))).not.toContain('private');
  });

  it('keeps legacy summaries readable and round-trips new fields through API serialization', () => {
    const legacy = { id: 'summary', meetingId: 'meeting', createdAt: '2026-09-01T10:00:00Z',
      shortSummary: 'Saved recap', mainTopics: [], keyTensions: [], agreements: [], tasks: [], suggestedNextMeetingFocus: [] };
    expect(meetingSummarySchema.parse(legacy).followThrough).toBeUndefined();
    const grounded = buildGroundedSummaryOutput(meeting, output());
    expect(meetingSummarySchema.parse({ ...legacy, ...grounded }).followThrough).toEqual(grounded.followThrough);
  });
});
