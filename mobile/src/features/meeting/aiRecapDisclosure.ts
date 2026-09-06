import {
  readSettingsStorage,
  writeSettingsStorage,
} from '@/shared/services/storageService';

export const AI_RECAP_DISCLOSURE_VERSION = 'v1';

function isAcknowledgedPreference(value: unknown) {
  return typeof value === 'object'
    && value !== null
    && 'version' in value
    && value.version === AI_RECAP_DISCLOSURE_VERSION;
}

export function hasAcknowledgedAiRecapDisclosure() {
  return isAcknowledgedPreference(readSettingsStorage('aiRecap', null));
}

export function acknowledgeAiRecapDisclosure() {
  writeSettingsStorage('aiRecap', { version: AI_RECAP_DISCLOSURE_VERSION });
}
