import type {
  MeetingSummary,
  MeetingSummaryTask,
} from '@/features/meeting/types';
import type { SupportedLocale } from '@/features/localization/types';
import { apiRequest } from './httpClient';

export interface GenerateMeetingSummaryRequestDto {
  meetingId: string;
  locale?: SupportedLocale;
  expectedServerRevision?: number;
  allowLowContent?: boolean;
}

export interface AiMeetingSummaryTaskDto {
  sourceId?: string;
  status?: MeetingSummaryTask['status'];
  responsibilityType?: MeetingSummaryTask['responsibilityType'];
  title: string;
  responsibleParticipantIds?: string[];
  dueDate?: string;
}

export interface AiMeetingSummaryDto extends Omit<MeetingSummary, 'tasks'> {
  tasks: AiMeetingSummaryTaskDto[];
}

export interface GenerateMeetingSummaryResponseDto {
  summary: AiMeetingSummaryDto;
  disclaimer: string;
  generatedAt: string;
  meetingSync?: AiMeetingSyncDto;
}

export interface AiMeetingSyncDto {
  meetingId: string;
  sourceServerRevision: number;
  serverRevision: number;
  updatedAt: string;
}

export interface GenerateMeetingSummaryOptions {
  signal?: AbortSignal;
}

export async function generateAiMeetingSummary(
  payload: GenerateMeetingSummaryRequestDto,
  options: GenerateMeetingSummaryOptions = {}
): Promise<GenerateMeetingSummaryResponseDto> {
  return apiRequest<GenerateMeetingSummaryResponseDto>('/ai/meeting-summary', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
    signal: options.signal,
  });
}
