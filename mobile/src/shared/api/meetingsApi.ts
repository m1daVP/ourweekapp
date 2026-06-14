import type { MeetingSummary } from '@/features/meeting/types';
import { translate } from '@/features/localization/i18n';
import { apiRequest, isBackendApiConfigured } from './httpClient';
import { nowIso } from '@/shared/utils/dates';
import type { MeetingDto } from '@/shared/api/syncDtos';

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

function normalizeListMeetingsResponse(
  response: ListMeetingsResponseDto
): ListMeetingsResponseDto {
  return {
    meetings: Array.isArray(response.meetings) ? response.meetings : [],
    activeMeetingId: response.activeMeetingId ?? null,
    draftSavedAt: response.draftSavedAt ?? null,
    syncedAt: response.syncedAt ?? nowIso(),
  };
}

function normalizeSyncMeetingsResponse(
  response: SyncMeetingsResponseDto
): SyncMeetingsResponseDto {
  return {
    meetings: Array.isArray(response.meetings) ? response.meetings : [],
    activeMeetingId: response.activeMeetingId ?? null,
    draftSavedAt: response.draftSavedAt ?? null,
    conflicts: Array.isArray(response.conflicts) ? response.conflicts : [],
    syncedAt: response.syncedAt ?? nowIso(),
  };
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

  const response = await apiRequest<ListMeetingsResponseDto>('/meetings/', {
    requiresAuth: true,
  });

  return normalizeListMeetingsResponse(response);
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

  const response = await apiRequest<SyncMeetingsResponseDto>('/meetings/sync', {
    method: 'POST',
    body: payload,
    requiresAuth: true,
  });

  return normalizeSyncMeetingsResponse(response);
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
