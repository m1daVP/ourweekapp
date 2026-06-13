import { appConfig } from '@/shared/config/env';

export function openExternalAuthUrl(url: string) {
  const parsedUrl = new URL(url);
  const isLocalHttpUrl =
    appConfig.appEnvironment !== 'production' &&
    parsedUrl.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname);

  if (parsedUrl.protocol !== 'https:' && !isLocalHttpUrl) {
    throw new Error('Unsupported authorization URL.');
  }

  if (typeof window === 'undefined') {
    return;
  }

  window.location.assign(parsedUrl.toString());
}
