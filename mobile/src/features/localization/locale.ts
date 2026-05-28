import type { LocalizationSettings, SupportedLocale } from './types';

export const supportedLocales: SupportedLocale[] = ['en', 'uk', 'es'];

export const localeNames: Record<SupportedLocale, string> = {
  en: 'English',
  uk: 'Українська',
  es: 'Español',
};

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return value === 'en' || value === 'uk' || value === 'es';
}

export function getPrimaryDeviceLanguage() {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  return navigator.languages?.[0] ?? navigator.language;
}

export function resolveInitialLocale(language = getPrimaryDeviceLanguage()) {
  const normalized = language?.trim().toLowerCase();

  if (!normalized) {
    return 'en';
  }

  if (normalized.startsWith('uk') || normalized.startsWith('ru')) {
    return 'uk';
  }

  if (normalized.startsWith('en')) {
    return 'en';
  }

  if (normalized.startsWith('es')) {
    return 'es';
  }

  return 'en';
}

export function createDetectedLocalizationSettings(): LocalizationSettings {
  const detectedLanguage = getPrimaryDeviceLanguage();

  return {
    locale: resolveInitialLocale(detectedLanguage),
    source: 'device',
    detectedLanguage,
    updatedAt: new Date().toISOString(),
  };
}
