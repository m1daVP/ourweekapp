import type { MeetingSummary } from '@/features/meeting/types';
import type { SupportedLocale } from '@/features/localization/types';
import { translate } from '@/features/localization/i18n';
import { apiRequest, isBackendApiConfigured } from './httpClient';

export interface GenerateMeetingSummaryRequestDto {
  meetingId: string;
  locale?: SupportedLocale;
}

export interface AiMeetingSummaryTaskDto {
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
}

export interface GenerateMeetingSummaryOptions {
  signal?: AbortSignal;
}

export async function generateAiMeetingSummary(
  payload: GenerateMeetingSummaryRequestDto,
  options: GenerateMeetingSummaryOptions = {}
): Promise<GenerateMeetingSummaryResponseDto> {
  if (!isBackendApiConfigured()) {
    throw new Error(translate('api.backendNotConfigured'));
  }

  return apiRequest<GenerateMeetingSummaryResponseDto>('/ai/meeting-summary', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
    signal: options.signal,
  });
}
