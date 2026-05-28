export type SupportedLocale = 'en' | 'uk' | 'es';

export type LocalizationSource = 'device' | 'settings';

export interface LocalizationSettings {
  locale: SupportedLocale;
  source: LocalizationSource;
  detectedLanguage?: string;
  updatedAt: string;
}
