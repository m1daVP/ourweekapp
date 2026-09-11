import { createHash } from 'node:crypto';
import type { z } from 'zod';
import { ApiError } from '../../shared/errors/index.js';
import { followThroughSchema, followThroughSourceSchema, providerObservationsSchema } from './follow-through.schema.js';
import { buildSummarySourceSnapshot, type SummarySourceMeeting } from './summary-source.js';

export function summarySourceFingerprint(meeting: SummarySourceMeeting) {
  return createHash('sha256').update(JSON.stringify(buildSummarySourceSnapshot(meeting))).digest('hex');
}

function invalidReference(): never {
  throw new ApiError(502, 'ai_summary_invalid_source', 'Unable to verify AI follow-up sources. Please try again.');
}

export function buildGroundedSummaryOutput(meeting: SummarySourceMeeting, output: unknown) {
  const value = typeof output === 'object' && output !== null && !Array.isArray(output)
    ? output as Record<string, unknown> : {};
  const observations = providerObservationsSchema.parse(value.observations);
  const snapshot = buildSummarySourceSnapshot(meeting);
  const sources = new Map<string, z.infer<typeof followThroughSourceSchema>>();
  for (const step of snapshot.steps) {
    const base = { sectionIndex: step.sectionIndex, ...(step.id ? { sectionId: step.id } : {}) };
    sources.set(step.sourceRef, { ...base, kind: 'section', label: step.title ?? step.prompt ?? step.sourceRef });
    for (const [kind, items] of [
      ['note', step.notes], ['task', step.tasks], ['agreement', step.agreements],
    ] as const) {
      for (const item of items) {
        sources.set(item.sourceRef, { ...base, kind,
          ...(item.id ? { itemId: item.id } : {}),
          label: 'title' in item ? item.title : item.text });
      }
    }
  }
  const allowedIds = new Set(meeting.participantIds);
  return {
    ...value,
    suggestedNextMeetingFocus: observations.filter((item) => item.reviewHorizon === 'nextMeeting').map((item) => item.question),
    // Recorded commitments come from the meeting, never reconstructed by the model.
    agreements: snapshot.steps.flatMap((step) => step.agreements.map((item) => item.text)).slice(0, 20),
    tasks: snapshot.steps.flatMap((step) => step.tasks.map((task) => ({
      title: task.title,
      ...(task.id ? { sourceId: task.id } : {}),
      ...(task.status ? { status: task.status } : {}),
      ...(task.responsibilityType ? { responsibilityType: task.responsibilityType } : {}),
      ...(task.dueDate ? { dueDate: task.dueDate } : {}),
      responsibleParticipantIds: (task.responsibleParticipantIds ?? []).filter((id) => allowedIds.has(id)),
    }))).slice(0, 20),
    followThrough: followThroughSchema.parse({
      version: 1,
      sourceFingerprint: summarySourceFingerprint(meeting),
      observations: observations.map(({ sourceRefs, action, ...observation }) => {
        const refs = [...new Set(sourceRefs)];
        const resolved = refs.map((ref) => sources.get(ref) ?? invalidReference());
        if (action && !refs.includes(action.sourceRef)) invalidReference();
        const sourceRefIndex = action ? refs.indexOf(action.sourceRef) : -1;
        // Existing task evidence opens the record instead of offering a duplicate.
        const existingTaskIndex = resolved.findIndex((ref) => ref.kind === 'task');
        const safeAction = action?.type === 'createTask' && (existingTaskIndex >= 0 || resolved[sourceRefIndex]?.kind !== 'note')
          ? { type: 'openSource' as const, sourceRefIndex: existingTaskIndex >= 0 ? existingTaskIndex : sourceRefIndex }
          : action ? { type: action.type, sourceRefIndex } : undefined;
        return { ...observation, sourceRefs: resolved, ...(safeAction ? { action: safeAction } : {}) };
      }),
    }),
  };
}
