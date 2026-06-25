export interface ProductionConfigEnv {
  VITE_API_BASE_URL?: string;
  VITE_REVENUECAT_ANDROID_API_KEY?: string;
  VITE_REVENUECAT_ENTITLEMENT_ID?: string;
  VITE_REVENUECAT_CURRENT_OFFERING_ID?: string;
  VITE_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID?: string;
  VITE_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID?: string;
}

export interface ProductionConfigIssue {
  key: keyof ProductionConfigEnv;
  message: string;
}

function normalizedValue(value: string | undefined) {
  return value?.trim() ?? '';
}

function isPlaceholder(value: string) {
  return /^(change[-_ ]?me|example|pending|todo|test)$/i.test(value);
}

function isLocalDevelopmentHostname(value: string) {
  const hostname = value.toLowerCase().replace(/^\[|\]$/g, '');
  const ipv4Parts = hostname.split('.').map(Number);
  const isIpv6 = hostname.includes(':');
  const isIpv4 =
    ipv4Parts.length === 4 &&
    ipv4Parts.every(
      (part) => Number.isInteger(part) && part >= 0 && part <= 255
    );

  if (isIpv4) {
    const [first = 0, second = 0] = ipv4Parts;

    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  return (
    hostname === 'localhost' ||
    hostname === '::1' ||
    (isIpv6 && hostname.startsWith('fc')) ||
    (isIpv6 && hostname.startsWith('fd')) ||
    (isIpv6 && /^fe[89ab]/.test(hostname)) ||
    hostname.endsWith('.local')
  );
}

function isNonPublicHostname(value: string) {
  const hostname = value.toLowerCase().replace(/^\[|\]$/g, '');

  return (
    isLocalDevelopmentHostname(hostname) ||
    hostname.endsWith('.example') ||
    hostname.endsWith('.invalid') ||
    hostname.endsWith('.test') ||
    /(^|\.)example\.(com|net|org)$/.test(hostname)
  );
}

function requireReleaseValue(
  env: ProductionConfigEnv,
  key:
    | 'VITE_REVENUECAT_ANDROID_API_KEY'
    | 'VITE_REVENUECAT_ENTITLEMENT_ID'
    | 'VITE_REVENUECAT_CURRENT_OFFERING_ID'
    | 'VITE_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID'
    | 'VITE_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID',
  label: string,
  issues: ProductionConfigIssue[]
) {
  const value = normalizedValue(env[key]);

  if (!value || isPlaceholder(value)) {
    issues.push({
      key,
      message: `${label} must be set to its reviewed production value.`,
    });
  }
}

function validateApiBaseUrl(
  value: string | undefined,
  issues: ProductionConfigIssue[],
  requirePublicHttps: boolean
) {
  const baseUrl = normalizedValue(value);

  if (!baseUrl) {
    issues.push({
      key: 'VITE_API_BASE_URL',
      message: requirePublicHttps
        ? 'The production backend URL is required.'
        : 'The backend URL is required.',
    });
    return;
  }

  try {
    const url = new URL(baseUrl);

    const hasSupportedProtocol =
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && isLocalDevelopmentHostname(url.hostname));
    const violatesReleasePolicy =
      requirePublicHttps &&
      (url.protocol !== 'https:' || isNonPublicHostname(url.hostname));

    if (
      !hasSupportedProtocol ||
      violatesReleasePolicy ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error('Unsafe production URL');
    }
  } catch {
    issues.push({
      key: 'VITE_API_BASE_URL',
      message: requirePublicHttps
        ? 'The production backend URL must be a public HTTPS URL without credentials, a query, or a fragment.'
        : 'The backend URL must use HTTP or HTTPS without credentials, a query, or a fragment.',
    });
  }
}

export function validateRequiredApiConfig(
  env: ProductionConfigEnv,
  requirePublicHttps = false
): ProductionConfigIssue[] {
  const issues: ProductionConfigIssue[] = [];

  validateApiBaseUrl(env.VITE_API_BASE_URL, issues, requirePublicHttps);

  return issues;
}

export function validateProductionConfig(
  env: ProductionConfigEnv
): ProductionConfigIssue[] {
  const issues: ProductionConfigIssue[] = [];

  issues.push(...validateRequiredApiConfig(env, true));

  requireReleaseValue(
    env,
    'VITE_REVENUECAT_ANDROID_API_KEY',
    'The RevenueCat Android public SDK key',
    issues
  );
  requireReleaseValue(
    env,
    'VITE_REVENUECAT_ENTITLEMENT_ID',
    'The RevenueCat entitlement identifier',
    issues
  );
  requireReleaseValue(
    env,
    'VITE_REVENUECAT_CURRENT_OFFERING_ID',
    'The RevenueCat current offering identifier',
    issues
  );
  requireReleaseValue(
    env,
    'VITE_REVENUECAT_ANDROID_MONTHLY_PRODUCT_ID',
    'The Google Play monthly product identifier',
    issues
  );
  requireReleaseValue(
    env,
    'VITE_REVENUECAT_ANDROID_YEARLY_PRODUCT_ID',
    'The Google Play yearly product identifier',
    issues
  );

  return issues;
}

function assertConfigIssues(issues: ProductionConfigIssue[], label: string) {
  if (!issues.length) {
    return;
  }

  const details = issues
    .map((issue) => `- ${issue.key}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid OurWeek ${label} configuration:\n${details}`);
}

export function assertValidRequiredApiConfig(env: ProductionConfigEnv) {
  assertConfigIssues(validateRequiredApiConfig(env), 'backend');
}

export function assertValidProductionConfig(env: ProductionConfigEnv) {
  assertConfigIssues(validateProductionConfig(env), 'production');
}
