import { z } from 'zod';

import { VALIDATION_LIMITS } from './validation-limits.schema.js';

export const trimmedString = (minLength: number, maxLength: number) =>
  z.string().trim().min(minLength).max(maxLength);

export const optionalTrimmedString = (maxLength: number) =>
  z.codec(
    z.string().trim().max(maxLength).optional(),
    z.string().max(maxLength).optional(),
    {
      decode: (value) => (value === '' ? undefined : value),
      encode: (value) => value?.trim() || undefined,
    },
  );

export const apiIdSchema = trimmedString(1, VALIDATION_LIMITS.apiIdMaxLength);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(VALIDATION_LIMITS.emailMaxLength)
  .pipe(z.email());

export const displayNameSchema = trimmedString(
  VALIDATION_LIMITS.displayNameMinLength,
  VALIDATION_LIMITS.displayNameMaxLength,
);

export const optionalDisplayNameSchema = optionalTrimmedString(
  VALIDATION_LIMITS.displayNameMaxLength,
);

export const isoDateTimeStringSchema = z.string().datetime();

export const isoDateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(parsed.getTime()) &&
      value === parsed.toISOString().slice(0, 10)
    );
  }, 'Invalid ISO date');

export const serverRevisionSchema = z.number().int().positive();

export const authTokenSchema = trimmedString(
  1,
  VALIDATION_LIMITS.authTokenMaxLength,
);

export const passwordSchema = trimmedString(
  VALIDATION_LIMITS.passwordMinLength,
  VALIDATION_LIMITS.passwordMaxLength,
);

export const avatarColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/);

export const nullableIsoDateTimeStringSchema = isoDateTimeStringSchema.nullable();

export type ApiId = z.infer<typeof apiIdSchema>;
