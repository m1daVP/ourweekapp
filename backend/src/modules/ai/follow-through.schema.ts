import { z } from 'zod';
import { apiIdSchema } from '../../shared/schemas/index.js';

const sentence = z.string().trim().min(1).max(700);
const observationFields = {
  title: z.string().trim().min(1).max(160),
  explanation: sentence,
  question: sentence,
  kind: z.enum(['clarify', 'continue']),
  reviewHorizon: z.enum(['beforeNextMeeting', 'nextMeeting']),
};
export const followThroughSourceSchema = z.object({
  sectionId: apiIdSchema.optional(),
  sectionIndex: z.number().int().min(0),
  kind: z.enum(['section', 'note', 'task', 'agreement']),
  itemId: apiIdSchema.optional(),
  label: z.string().min(1).max(12000),
});
export const followThroughSchema = z.object({
  version: z.literal(1),
  sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  observations: z.array(z.object({
    ...observationFields,
    sourceRefs: z.array(followThroughSourceSchema).min(1).max(6),
    action: z.object({
      type: z.enum(['openSource', 'createTask']),
      sourceRefIndex: z.number().int().min(0).max(5),
    }).optional(),
  })).max(3),
});

export const providerObservationsSchema = z.array(z.object({
  ...observationFields,
  sourceRefs: z.array(z.string().min(1).max(40)).min(1).max(6),
  action: z.object({
    type: z.enum(['openSource', 'createTask']),
    sourceRef: z.string().min(1).max(40),
  }).nullable(),
})).max(3);

// Explicit strict JSON schema avoids including server-owned evidence metadata in the model output.
export const PROVIDER_OBSERVATIONS_JSON_SCHEMA = {
  type: 'array', maxItems: 3,
  items: {
    type: 'object', additionalProperties: false,
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 160 },
      explanation: { type: 'string', minLength: 1, maxLength: 700 },
      question: { type: 'string', minLength: 1, maxLength: 700 },
      kind: { type: 'string', enum: ['clarify', 'continue'] },
      reviewHorizon: { type: 'string', enum: ['beforeNextMeeting', 'nextMeeting'] },
      sourceRefs: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'string' } },
      action: { anyOf: [
        { type: 'null' },
        { type: 'object', additionalProperties: false, properties: {
          type: { type: 'string', enum: ['openSource', 'createTask'] },
          sourceRef: { type: 'string' },
        }, required: ['type', 'sourceRef'] },
      ] },
    },
    required: ['title', 'explanation', 'question', 'kind', 'reviewHorizon', 'sourceRefs', 'action'],
  },
} as const;
