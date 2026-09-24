import { z } from 'zod';

import {
  syncConflictBaseSchema,
  syncConflictReasonSchema,
  syncResourceTypeSchema,
} from '../sync/conflict.js';

export { syncConflictReasonSchema, syncResourceTypeSchema };

export const createSyncConflictSchema = <T extends z.ZodType>(versionSchema: T) =>
  syncConflictBaseSchema.extend({
    clientVersion: versionSchema.optional(),
    serverVersion: versionSchema.optional(),
  });

export const createTypedSyncConflictSchema = <
  ResourceType extends z.infer<typeof syncResourceTypeSchema>,
  VersionSchema extends z.ZodType,
>(
  resourceType: ResourceType,
  versionSchema: VersionSchema,
) =>
  syncConflictBaseSchema.extend({
    resourceType: z.literal(resourceType),
    clientVersion: versionSchema.optional(),
    serverVersion: versionSchema.optional(),
  });

export const syncConflictDtoSchema = createSyncConflictSchema(z.unknown());
