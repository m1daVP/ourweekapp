import { defineStore } from 'pinia';
import {
  createDetectedLocalizationSettings,
  isSupportedLocale,
} from '@/features/localization/locale';
import type {
  LocalizationSettings,
  SupportedLocale,
} from '@/features/localization/types';
import { i18n, setDocumentLocale } from '@/features/localization/i18n';
import {
  readSettingsStorage,
  writeSettingsStorage,
} from '@/shared/services/storageService';

function normalizeStoredSettings(
  value: Partial<LocalizationSettings> | null
): LocalizationSettings {
  if (value && isSupportedLocale(value.locale)) {
    return {
      locale: value.locale,
      source: value.source === 'settings' ? 'settings' : 'device',
      detectedLanguage: value.detectedLanguage,
      updatedAt: value.updatedAt ?? new Date().toISOString(),
    };
  }

  const detected = createDetectedLocalizationSettings();
  writeSettingsStorage('localization', detected);
  return detected;
}

function getStoredLocalizationSettings() {
  return normalizeStoredSettings(
    readSettingsStorage<Partial<LocalizationSettings> | null>(
      'localization',
      null
    )
  );
}

export const useLocalizationStore = defineStore('localization', {
  state: () => ({
    settings: getStoredLocalizationSettings(),
  }),
  getters: {
    locale: (state) => state.settings.locale,
  },
  actions: {
    applyLocale() {
      i18n.global.locale.value = this.settings.locale;
      setDocumentLocale(this.settings.locale);
    },
    setLocale(locale: SupportedLocale) {
      if (!isSupportedLocale(locale)) {
        return;
      }

      this.settings = {
        ...this.settings,
        locale,
        source: 'settings',
        updatedAt: new Date().toISOString(),
      };
      writeSettingsStorage('localization', this.settings);
      this.applyLocale();
    },
  },
});
