import type { Meeting, MeetingSummary } from '@/features/meeting/types';
import { translate } from '@/features/localization/i18n';
import { apiRequest, isBackendApiConfigured } from './httpClient';

export interface MeetingDto extends Meeting {
  serverRevision?: number;
  deletedAt?: string;
}

export interface ListMeetingsResponseDto {
  meetings: MeetingDto[];
  activeMeetingId: string | null;
  draftSavedAt: string | null;
  syncedAt: string;
}

export interface SyncMeetingsRequestDto {
  meetings: MeetingDto[];
  activeMeetingId: string | null;
  draftSavedAt: string | null;
  lastSyncedAt?: string;
  clientUpdatedAt: string;
}

export interface SyncMeetingsResponseDto {
  meetings: MeetingDto[];
  activeMeetingId: string | null;
  draftSavedAt: string | null;
  conflicts: MeetingDto[];
  syncedAt: string;
}

export interface SaveMeetingSummaryRequestDto {
  meetingId: string;
  summary: MeetingSummary;
}

function nowIso() {
  return new Date().toISOString();
}

export async function listMeetings(): Promise<ListMeetingsResponseDto> {
  if (!isBackendApiConfigured()) {
    return {
      meetings: [],
      activeMeetingId: null,
      draftSavedAt: null,
      syncedAt: nowIso(),
    };
  }

  return apiRequest<ListMeetingsResponseDto>('/meetings', {
    requiresAuth: true,
  });
}

export async function syncMeetingsApi(
  payload: SyncMeetingsRequestDto
): Promise<SyncMeetingsResponseDto> {
  if (!isBackendApiConfigured()) {
    return {
      meetings: payload.meetings,
      activeMeetingId: payload.activeMeetingId,
      draftSavedAt: payload.draftSavedAt,
      conflicts: [],
      syncedAt: nowIso(),
    };
  }

  return apiRequest<SyncMeetingsResponseDto>('/meetings/sync', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
  });
}

export async function saveMeetingSummary(
  payload: SaveMeetingSummaryRequestDto
): Promise<MeetingDto> {
  if (!isBackendApiConfigured()) {
    throw new Error(translate('api.saveSummaryNotConfigured'));
  }

  return apiRequest<MeetingDto>(`/meetings/${payload.meetingId}/summary`, {
    method: 'PUT',
    body: { summary: payload.summary },
    requiresAuth: true,
  });
}
