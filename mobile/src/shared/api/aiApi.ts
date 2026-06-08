import type { MeetingSummary } from '@/features/meeting/types';
import type { SupportedLocale } from '@/features/localization/types';
import { translate } from '@/features/localization/i18n';
import { apiRequest, isBackendApiConfigured } from './httpClient';

export interface GenerateMeetingSummaryRequestDto {
  meetingId: string;
  locale: SupportedLocale;
}

export interface GenerateMeetingSummaryResponseDto {
  summary: MeetingSummary;
  disclaimer: string;
  generatedAt: string;
}

export async function generateAiMeetingSummary(
  payload: GenerateMeetingSummaryRequestDto
): Promise<GenerateMeetingSummaryResponseDto> {
  if (!isBackendApiConfigured()) {
    throw new Error(translate('api.backendNotConfigured'));
  }

  return apiRequest<GenerateMeetingSummaryResponseDto>('/ai/meeting-summary', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
  });
}
