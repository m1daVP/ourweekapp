import { z } from 'zod';

export const errorResponseSchema = z.object({
  message: z.string(),
  code: z.string(),
  details: z.record(z.string(), z.unknown()),
});

export type ErrorResponseDto = z.infer<typeof errorResponseSchema>;
