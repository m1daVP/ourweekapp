import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  value: null as unknown,
  write: vi.fn(),
}));

vi.mock('@/shared/services/storageService', () => ({
  readSettingsStorage: vi.fn(() => storage.value),
  writeSettingsStorage: storage.write,
}));

import {
  AI_RECAP_DISCLOSURE_VERSION,
  acknowledgeAiRecapDisclosure,
  hasAcknowledgedAiRecapDisclosure,
} from '../aiRecapDisclosure';

describe('AI recap disclosure acknowledgement', () => {
  beforeEach(() => {
    storage.value = null;
    storage.write.mockReset();
  });

  it('records acknowledgement for the current account only', () => {
    acknowledgeAiRecapDisclosure('user-a');

    expect(storage.write).toHaveBeenCalledWith('aiRecap', {
      version: AI_RECAP_DISCLOSURE_VERSION,
      userId: 'user-a',
    });
  });

  it('does not reuse another account’s acknowledgement after an account switch', () => {
    storage.value = {
      version: AI_RECAP_DISCLOSURE_VERSION,
      userId: 'user-a',
    };

    expect(hasAcknowledgedAiRecapDisclosure('user-a')).toBe(true);
    expect(hasAcknowledgedAiRecapDisclosure('user-b')).toBe(false);
  });
});
