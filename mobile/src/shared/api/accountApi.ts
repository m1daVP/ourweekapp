import { apiRequest } from './httpClient';

export type AccountExportDto = Record<string, unknown>;

export async function exportAccountData(): Promise<AccountExportDto> {
  return apiRequest<AccountExportDto>('/account/export', {
    requiresAuth: true,
  });
}

export async function deleteAccount(): Promise<void> {
  await apiRequest<void>('/account/', {
    method: 'DELETE',
    requiresAuth: true,
  });
}
