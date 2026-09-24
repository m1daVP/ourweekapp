import { z } from 'zod';

import { isoDateTimeStringSchema } from '../../shared/schemas/index.js';
import { meetingIdSchema } from '../meetings/meetings.schema.js';

export const meetingExportFormatSchema = z.enum(['markdown', 'text']);

export const exportMeetingRequestSchema = z.object({
  meetingId: meetingIdSchema,
  format: meetingExportFormatSchema.default('markdown'),
});

export const exportMeetingPdfRequestSchema = z.object({
  meetingId: meetingIdSchema,
});

export const exportMeetingPdfResponseSchema = z.unknown().meta({
  contentMediaType: 'application/pdf',
});

export const exportMeetingResponseSchema = z.object({
  meetingId: meetingIdSchema,
  format: meetingExportFormatSchema,
  contentType: z.enum(['text/markdown', 'text/plain']),
  filename: z.string().min(1).max(255),
  content: z.string(),
  generatedAt: isoDateTimeStringSchema,
});

export type MeetingExportFormatDto = z.infer<typeof meetingExportFormatSchema>;
export type ExportMeetingRequestDto = z.infer<typeof exportMeetingRequestSchema>;
export type ExportMeetingPdfRequestDto = z.infer<typeof exportMeetingPdfRequestSchema>;
export type ExportMeetingResponseDto = z.infer<typeof exportMeetingResponseSchema>;
