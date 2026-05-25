import { createI18n } from 'vue-i18n';
import { messages, type MessageSchema } from './messages';
import type { SupportedLocale } from './types';

export const i18n = createI18n<[MessageSchema], SupportedLocale>({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages,
});

export function setDocumentLocale(locale: SupportedLocale) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
}

export function translate(key: string, params?: Record<string, unknown>) {
  return i18n.global.t(key, params ?? {});
}
