export const supportedApiLocales = ['en', 'uk', 'es'] as const;

export type SupportedApiLocale = (typeof supportedApiLocales)[number];

type ErrorMessageKey =
  | 'authenticationRequired'
  | 'signInAgain'
  | 'invalidCredentials'
  | 'notFound'
  | 'forbidden'
  | 'premiumRequired'
  | 'alreadyExists'
  | 'conflict'
  | 'unavailable'
  | 'validationFailed'
  | 'rateLimitExceeded'
  | 'retryLater';

const localizedMessages: Record<SupportedApiLocale, Record<ErrorMessageKey, string>> = {
  en: {
    authenticationRequired: 'Authentication is required.',
    signInAgain: 'Please sign in again.',
    invalidCredentials: 'Email or password is incorrect.',
    notFound: 'The requested item was not found.',
    forbidden: 'You do not have permission to do that.',
    premiumRequired: 'Premium is required for this feature.',
    alreadyExists: 'This item already exists.',
    conflict: 'This item has changed. Please refresh and try again.',
    unavailable: 'This feature is not available right now.',
    validationFailed: 'Please check the request and try again.',
    rateLimitExceeded: 'Too many requests. Please try again later.',
    retryLater: 'Something went wrong. Please try again.',
  },
  uk: {
    authenticationRequired: 'Потрібна автентифікація.',
    signInAgain: 'Увійдіть у систему ще раз.',
    invalidCredentials: 'Неправильна електронна пошта або пароль.',
    notFound: 'Запитаний елемент не знайдено.',
    forbidden: 'У вас немає дозволу на цю дію.',
    premiumRequired: 'Для цієї функції потрібен Premium.',
    alreadyExists: 'Цей елемент уже існує.',
    conflict: 'Цей елемент змінився. Оновіть сторінку та спробуйте ще раз.',
    unavailable: 'Ця функція зараз недоступна.',
    validationFailed: 'Перевірте запит і спробуйте ще раз.',
    rateLimitExceeded: 'Забагато запитів. Спробуйте пізніше.',
    retryLater: 'Щось пішло не так. Спробуйте ще раз.',
  },
  es: {
    authenticationRequired: 'Se requiere autenticación.',
    signInAgain: 'Inicia sesión de nuevo.',
    invalidCredentials: 'El correo electrónico o la contraseña son incorrectos.',
    notFound: 'No se encontró el elemento solicitado.',
    forbidden: 'No tienes permiso para realizar esta acción.',
    premiumRequired: 'Se requiere Premium para esta función.',
    alreadyExists: 'Este elemento ya existe.',
    conflict: 'Este elemento cambió. Actualiza e inténtalo de nuevo.',
    unavailable: 'Esta función no está disponible en este momento.',
    validationFailed: 'Revisa la solicitud e inténtalo de nuevo.',
    rateLimitExceeded: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.',
    retryLater: 'Algo salió mal. Inténtalo de nuevo.',
  },
};

const messageKeyByCode: Record<string, ErrorMessageKey> = {
  unauthenticated: 'authenticationRequired',
  invalid_session: 'signInAgain',
  invalid_credentials: 'invalidCredentials',
  forbidden: 'forbidden',
  role_restricted: 'forbidden',
  feature_role_restricted: 'forbidden',
  subscription_owner_required: 'forbidden',
  premium_required: 'premiumRequired',
  validation_failed: 'validationFailed',
  rate_limit_exceeded: 'rateLimitExceeded',
  recap_allowance_exhausted: 'rateLimitExceeded',
  ai_summary_rate_limited: 'rateLimitExceeded',
  feature_not_available: 'unavailable',
  ai_provider_not_configured: 'unavailable',
  google_sign_in_not_configured: 'unavailable',
  subscription_provider_unavailable: 'unavailable',
  internal_server_error: 'retryLater',
};

function isSupportedApiLocale(value: string): value is SupportedApiLocale {
  return (supportedApiLocales as readonly string[]).includes(value);
}

export function resolveApiLocale(acceptLanguage?: string): SupportedApiLocale {
  if (!acceptLanguage) {
    return 'en';
  }

  const candidates = acceptLanguage
    .split(',')
    .map((item, index) => {
      const [languageRange, ...parameters] = item.trim().split(';');
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const quality = qualityParameter ? Number(qualityParameter.trim().slice(2)) : 1;

      return {
        index,
        locale: languageRange?.trim().toLowerCase().split('-')[0] ?? '',
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((candidate) => candidate.quality > 0)
    .sort((left, right) => right.quality - left.quality || left.index - right.index);

  const supportedCandidate = candidates.find((candidate) =>
    isSupportedApiLocale(candidate.locale),
  );

  return supportedCandidate && isSupportedApiLocale(supportedCandidate.locale)
    ? supportedCandidate.locale
    : 'en';
}

function inferMessageKey(code: string, statusCode: number): ErrorMessageKey {
  if (messageKeyByCode[code]) {
    return messageKeyByCode[code];
  }

  if (code.endsWith('_not_found') || statusCode === 404) {
    return 'notFound';
  }

  if (code.includes('_already_') || code.endsWith('_already_exists')) {
    return 'alreadyExists';
  }

  if (statusCode === 401) {
    return 'authenticationRequired';
  }

  if (statusCode === 403) {
    return 'forbidden';
  }

  if (statusCode === 409) {
    return 'conflict';
  }

  if (statusCode === 422) {
    return 'validationFailed';
  }

  if (statusCode === 429) {
    return 'rateLimitExceeded';
  }

  return 'retryLater';
}

export function getLocalizedApiErrorMessage(
  locale: SupportedApiLocale,
  code: string,
  statusCode: number,
  fallbackMessage: string,
): string {
  if (locale === 'en') {
    return fallbackMessage;
  }

  return localizedMessages[locale][inferMessageKey(code, statusCode)];
}
