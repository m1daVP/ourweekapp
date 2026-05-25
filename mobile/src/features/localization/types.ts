export type SupportedLocale = 'en' | 'uk';

export type LocalizationSource = 'device' | 'settings';

export interface LocalizationSettings {
  locale: SupportedLocale;
  source: LocalizationSource;
  detectedLanguage?: string;
  updatedAt: string;
}
