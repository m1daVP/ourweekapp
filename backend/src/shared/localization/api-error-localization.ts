export const supportedApiLocales = ['en', 'uk', 'es'] as const;

export type SupportedApiLocale = (typeof supportedApiLocales)[number];

type NonEnglishLocale = Exclude<SupportedApiLocale, 'en'>;

type LocalizedErrorMessage = Record<NonEnglishLocale, string>;

// Keep this catalogue keyed by the stable API error code. Do not infer a
// message from a status code: different errors with the same status often
// require materially different guidance.
const localizedMessagesByCode: Record<string, LocalizedErrorMessage> = {
  account_deleted: {
    uk: 'Цей обліковий запис було видалено. Щоб відновити його, напишіть на ourweekapp@gmail.com.',
    es: 'Esta cuenta fue eliminada. Para restaurarla, escribe a ourweekapp@gmail.com.',
  },
  account_create_failed: {
    uk: 'Не вдалося створити обліковий запис. Спробуйте ще раз.',
    es: 'No se pudo crear la cuenta. Inténtalo de nuevo.',
  },
  account_link_conflict: {
    uk: 'Не вдалося пов’язати обліковий запис через конфлікт даних.',
    es: 'No se pudo vincular la cuenta debido a un conflicto de datos.',
  },
  account_link_email_mismatch: {
    uk: 'Електронна пошта не збігається з обліковим записом, який потрібно пов’язати.',
    es: 'El correo electrónico no coincide con la cuenta que se va a vincular.',
  },
  account_link_required: {
    uk: 'Щоб продовжити, потрібно пов’язати обліковий запис.',
    es: 'Debes vincular una cuenta para continuar.',
  },
  account_not_found: {
    uk: 'Обліковий запис не знайдено.',
    es: 'No se encontró la cuenta.',
  },
  ai_provider_not_configured: {
    uk: 'ШІ-підсумки зараз недоступні.',
    es: 'Los resúmenes con IA no están disponibles en este momento.',
  },
  ai_summary_generation_failed: {
    uk: 'Не вдалося створити ШІ-підсумок. Спробуйте ще раз.',
    es: 'No se pudo generar el resumen con IA. Inténtalo de nuevo.',
  },
  ai_summary_generation_in_progress: {
    uk: 'ШІ-підсумок уже створюється.',
    es: 'Ya se está generando un resumen con IA.',
  },
  ai_summary_input_too_large: {
    uk: 'Вміст зустрічі завеликий для безпечного створення підсумку.',
    es: 'El contenido de la reunión es demasiado grande para resumirlo de forma segura.',
  },
  ai_summary_insufficient_content: {
    uk: 'Для створення ШІ-підсумку потрібно більше вмісту зустрічі.',
    es: 'Se necesita más contenido de la reunión para generar un resumen con IA.',
  },
  ai_summary_invalid_source: {
    uk: 'Не вдалося перевірити джерела для продовження ШІ-підсумку. Спробуйте ще раз.',
    es: 'No se pudieron verificar las fuentes para el seguimiento del resumen con IA. Inténtalo de nuevo.',
  },
  ai_summary_rate_limited: {
    uk: 'Забагато запитів на ШІ-підсумок. Спробуйте пізніше.',
    es: 'Hay demasiadas solicitudes de resúmenes con IA. Inténtalo más tarde.',
  },
  ai_summary_request_cache_invalid: {
    uk: 'Не вдалося перевірити збережений ШІ-підсумок. Спробуйте ще раз.',
    es: 'No se pudo verificar el resumen con IA guardado. Inténtalo de nuevo.',
  },
  ai_summary_request_claim_invalid: {
    uk: 'Не вдалося зарезервувати створення ШІ-підсумку. Спробуйте ще раз.',
    es: 'No se pudo reservar la generación del resumen con IA. Inténtalo de nuevo.',
  },
  ai_summary_request_finalization_invalid: {
    uk: 'Не вдалося завершити створення ШІ-підсумку. Спробуйте ще раз.',
    es: 'No se pudo finalizar la generación del resumen con IA. Inténtalo de nuevo.',
  },
  auth_context_lookup_failed: {
    uk: 'Не вдалося перевірити ваш сеанс. Увійдіть у систему ще раз.',
    es: 'No se pudo verificar tu sesión. Inicia sesión de nuevo.',
  },
  auth_identity_link_failed: {
    uk: 'Не вдалося пов’язати обліковий запис. Спробуйте ще раз.',
    es: 'No se pudo vincular la cuenta. Inténtalo de nuevo.',
  },
  auth_identity_lookup_failed: {
    uk: 'Не вдалося завантажити дані входу. Спробуйте ще раз.',
    es: 'No se pudieron cargar los datos de inicio de sesión. Inténtalo de nuevo.',
  },
  auth_lookup_failed: {
    uk: 'Не вдалося завантажити дані автентифікації. Спробуйте ще раз.',
    es: 'No se pudieron cargar los datos de autenticación. Inténtalo de nuevo.',
  },
  calendar_cleanup_connection_unavailable: {
    uk: 'Підключення до календаря більше недоступне.',
    es: 'La conexión de calendario ya no está disponible.',
  },
  calendar_token_decrypt_failed: {
    uk: 'Не вдалося використати збережені дані календаря. Підключіть календар знову.',
    es: 'No se pudieron usar las credenciales guardadas del calendario. Vuelve a conectar el calendario.',
  },
  email_already_registered: {
    uk: 'Обліковий запис із цією адресою електронної пошти вже існує. Увійдіть у систему.',
    es: 'Ya existe una cuenta con esta dirección de correo electrónico. Inicia sesión.',
  },
  duplicate_participant_id: {
    uk: 'Ідентифікатори учасників мають бути унікальними.',
    es: 'Los identificadores de participantes deben ser únicos.',
  },
  feature_not_available: {
    uk: 'Ця функція недоступна.',
    es: 'Esta función no está disponible.',
  },
  feature_role_restricted: {
    uk: 'Ваша роль у просторі не дозволяє використовувати цю функцію.',
    es: 'Tu rol en el espacio no puede usar esta función.',
  },
  follow_up_not_found: {
    uk: 'Заплановану дію не знайдено.',
    es: 'No se encontró el seguimiento.',
  },
  forbidden: {
    uk: 'Вам не дозволено виконувати цю дію.',
    es: 'No tienes permiso para realizar esta acción.',
  },
  invitation_accept_failed: {
    uk: 'Не вдалося прийняти запрошення. Спробуйте ще раз.',
    es: 'No se pudo aceptar la invitación. Inténtalo de nuevo.',
  },
  invitation_delivery_failed: {
    uk: 'Не вдалося надіслати запрошення. Спробуйте ще раз.',
    es: 'No se pudo enviar la invitación. Inténtalo de nuevo.',
  },
  google_already_linked: {
    uk: 'Цей обліковий запис Google уже пов’язано з іншим користувачем.',
    es: 'Esta cuenta de Google ya está vinculada a otro usuario.',
  },
  google_sign_in_not_configured: {
    uk: 'Вхід через Google зараз не налаштовано.',
    es: 'El inicio de sesión con Google no está configurado en este momento.',
  },
  history_not_available: {
    uk: 'Історія зустрічей недоступна.',
    es: 'El historial de reuniones no está disponible.',
  },
  household_member_limit_reached: {
    uk: 'У вашій родині досягнуто ліміту учасників.',
    es: 'Tu hogar alcanzó el límite de miembros.',
  },
  internal_server_error: {
    uk: 'Щось пішло не так. Спробуйте ще раз.',
    es: 'Algo salió mal. Inténtalo de nuevo.',
  },
  invalid_calendar_redirect_url: {
    uk: 'Адреса переадресації календаря не дозволена.',
    es: 'La URL de redirección del calendario no está permitida.',
  },
  invalid_credentials: {
    uk: 'Неправильна електронна пошта або пароль.',
    es: 'El correo electrónico o la contraseña son incorrectos.',
  },
  invalid_google_token: {
    uk: 'Не вдалося підтвердити токен Google.',
    es: 'No se pudo verificar el token de Google.',
  },
  invalid_oauth_state: {
    uk: 'Недійсний стан авторизації. Спробуйте підключити календар ще раз.',
    es: 'El estado de autorización no es válido. Intenta conectar el calendario de nuevo.',
  },
  invalid_reset_code: {
    uk: 'Код скидання недійсний або прострочений.',
    es: 'El código de restablecimiento no es válido o venció.',
  },
  invalid_session: {
    uk: 'Увійдіть у систему ще раз.',
    es: 'Inicia sesión de nuevo.',
  },
  invitation_email_mismatch: {
    uk: 'Це запрошення призначене для іншої електронної пошти.',
    es: 'Esta invitación está destinada a otra dirección de correo electrónico.',
  },
  invitation_invalid_or_expired: {
    uk: 'Це запрошення недійсне або прострочене.',
    es: 'Esta invitación no es válida o venció.',
  },
  invitation_lookup_failed: {
    uk: 'Не вдалося завантажити запрошення. Спробуйте ще раз.',
    es: 'No se pudo cargar la invitación. Inténtalo de nuevo.',
  },
  meeting_invalid_reference: {
    uk: 'Підсумок посилається на учасників, яких немає на цій зустрічі.',
    es: 'El resumen hace referencia a participantes que no pertenecen a la reunión.',
  },
  meeting_not_completed: {
    uk: 'Зустріч потрібно завершити перед виконанням цієї дії.',
    es: 'Debes completar la reunión antes de realizar esta acción.',
  },
  meeting_not_found: {
    uk: 'Зустріч не знайдено.',
    es: 'No se encontró la reunión.',
  },
  meeting_summary_mismatch: {
    uk: 'Підсумок не відповідає цій зустрічі.',
    es: 'El resumen no coincide con esta reunión.',
  },
  meeting_summary_server_owned: {
    uk: 'Створюйте ШІ-дії через кінцеву точку підсумку.',
    es: 'Genera seguimientos con IA mediante el punto de resumen.',
  },
  meeting_update_conflict: {
    uk: 'Зустріч змінилася під час збереження підсумку. Оновіть дані та спробуйте ще раз.',
    es: 'La reunión cambió mientras se guardaba el resumen. Actualiza e inténtalo de nuevo.',
  },
  participant_avatar_forbidden: {
    uk: 'Цей аватар не можна використовувати для учасника.',
    es: 'Este avatar no se puede usar para el participante.',
  },
  participant_create_failed: {
    uk: 'Не вдалося зберегти учасника. Спробуйте ще раз.',
    es: 'No se pudo guardar el participante. Inténtalo de nuevo.',
  },
  participant_limit_exceeded: {
    uk: 'Досягнуто ліміту учасників.',
    es: 'Se alcanzó el límite de participantes.',
  },
  participant_not_found: {
    uk: 'Учасника не знайдено.',
    es: 'No se encontró el participante.',
  },
  password_reset_failed: {
    uk: 'Не вдалося скинути пароль. Спробуйте ще раз.',
    es: 'No se pudo restablecer la contraseña. Inténtalo de nuevo.',
  },
  premium_required: {
    uk: 'Для цієї функції потрібен Premium.',
    es: 'Se requiere Premium para esta función.',
  },
  rate_limit_exceeded: {
    uk: 'Забагато запитів. Спробуйте пізніше.',
    es: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.',
  },
  recap_allowance_exhausted: {
    uk: 'Зараз немає доступних ШІ-підсумків.',
    es: 'No hay resúmenes con IA disponibles en este momento.',
  },
  role_restricted: {
    uk: 'Ваша роль у просторі не дозволяє використовувати цю функцію.',
    es: 'Tu rol en el espacio no puede usar esta función.',
  },
  session_create_failed: {
    uk: 'Не вдалося створити сеанс. Спробуйте увійти ще раз.',
    es: 'No se pudo crear la sesión. Intenta iniciar sesión de nuevo.',
  },
  session_refresh_failed: {
    uk: 'Не вдалося оновити сеанс. Увійдіть у систему ще раз.',
    es: 'No se pudo renovar la sesión. Inicia sesión de nuevo.',
  },
  session_revoke_failed: {
    uk: 'Не вдалося завершити сеанс. Спробуйте ще раз.',
    es: 'No se pudo cerrar la sesión. Inténtalo de nuevo.',
  },
  subscription_owner_required: {
    uk: 'Лише власник простору може керувати підписками.',
    es: 'Solo el propietario del espacio puede gestionar las suscripciones.',
  },
  subscription_provider_unavailable: {
    uk: 'Постачальник підписок зараз недоступний. Спробуйте пізніше.',
    es: 'El proveedor de suscripciones no está disponible. Inténtalo más tarde.',
  },
  task_not_found: {
    uk: 'Завдання не знайдено.',
    es: 'No se encontró la tarea.',
  },
  task_review_decision_invalid_reference: {
    uk: 'Рішення щодо перегляду посилається на недійсне завдання або угоду.',
    es: 'La decisión de revisión hace referencia a una tarea o acuerdo no válido.',
  },
  unauthenticated: {
    uk: 'Потрібна автентифікація.',
    es: 'Se requiere autenticación.',
  },
  validation_failed: {
    uk: 'Перевірте запит і спробуйте ще раз.',
    es: 'Revisa la solicitud e inténtalo de nuevo.',
  },
  webhook_not_configured: {
    uk: 'Вебхук зараз не налаштовано.',
    es: 'El webhook no está configurado en este momento.',
  },
  webhook_unauthorized: {
    uk: 'Вебхук не авторизовано.',
    es: 'El webhook no está autorizado.',
  },
  workspace_invitation_not_found: {
    uk: 'Запрошення до простору не знайдено.',
    es: 'No se encontró la invitación al espacio.',
  },
  workspace_create_failed: {
    uk: 'Не вдалося створити простір. Спробуйте ще раз.',
    es: 'No se pudo crear el espacio. Inténtalo de nuevo.',
  },
  workspace_invitation_create_failed: {
    uk: 'Не вдалося створити запрошення до простору. Спробуйте ще раз.',
    es: 'No se pudo crear la invitación al espacio. Inténtalo de nuevo.',
  },
  workspace_last_owner: {
    uk: 'Не можна видалити останнього власника простору.',
    es: 'No se puede eliminar al último propietario del espacio.',
  },
  workspace_member_already_linked: {
    uk: 'Цей учасник уже пов’язаний із членом простору.',
    es: 'Este participante ya está vinculado a un miembro del espacio.',
  },
  workspace_member_already_exists: {
    uk: 'Цей член уже існує у просторі.',
    es: 'Este miembro ya existe en el espacio.',
  },
  workspace_member_not_found: {
    uk: 'Члена простору не знайдено.',
    es: 'No se encontró el miembro del espacio.',
  },
  workspace_member_role_invalid: {
    uk: 'Ця роль члена простору недійсна.',
    es: 'Este rol de miembro del espacio no es válido.',
  },
  workspace_member_status_transition_invalid: {
    uk: 'Цю зміну статусу члена простору не дозволено.',
    es: 'No se permite este cambio de estado del miembro del espacio.',
  },
  workspace_not_found: {
    uk: 'Простір не знайдено.',
    es: 'No se encontró el espacio.',
  },
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

export function getLocalizedApiErrorMessage(
  locale: SupportedApiLocale,
  code: string,
  _statusCode: number,
  fallbackMessage: string,
): string {
  if (locale === 'en') {
    return fallbackMessage;
  }

  return localizedMessagesByCode[code]?.[locale] ?? fallbackMessage;
}
