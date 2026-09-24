import { z } from 'zod';

export const syncResourceTypeSchema = z.enum([
  'participant',
  'meeting',
  'task',
  'agreement',
]);

export const syncConflictReasonSchema = z.enum([
  'updated_on_client_and_server',
  'deleted_on_server_updated_on_client',
  'deleted_on_client_updated_on_server',
  'invalid_reference',
]);

export const syncConflictBaseSchema = z.object({
  resourceType: syncResourceTypeSchema,
  resourceId: z.string(),
  reason: syncConflictReasonSchema,
  baseServerRevision: z.number().int().positive().optional(),
  serverRevision: z.number().int().positive().optional(),
  detectedAt: z.string().datetime(),
});

export type SyncResourceType = z.infer<typeof syncResourceTypeSchema>;
export type SyncConflictReason = z.infer<typeof syncConflictReasonSchema>;
export type SyncConflictDto<T> = z.infer<typeof syncConflictBaseSchema> & {
  clientVersion?: T;
  serverVersion?: T;
};
