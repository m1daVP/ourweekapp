import {
  readSettingsStorage,
  writeSettingsStorage,
} from '@/shared/services/storageService';

export const AI_RECAP_DISCLOSURE_VERSION = 'v2';

function isAcknowledgedPreference(value: unknown, userId: string) {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    value.version === AI_RECAP_DISCLOSURE_VERSION &&
    'userId' in value &&
    value.userId === userId
  );
}

export function hasAcknowledgedAiRecapDisclosure(userId: string) {
  return isAcknowledgedPreference(readSettingsStorage('aiRecap', null), userId);
}

export function acknowledgeAiRecapDisclosure(userId: string) {
  writeSettingsStorage('aiRecap', {
    version: AI_RECAP_DISCLOSURE_VERSION,
    userId,
  });
}
