import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const openApiJsonPath = path.join(projectRoot, 'docs', 'openapi.json');

const generationEnv = {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  PUBLIC_API_BASE_URL: 'http://127.0.0.1:3000',
  CORS_ORIGINS: '',
  CORS_ALLOWED_ORIGINS: '',
  LOG_LEVEL: 'silent',
  SENTRY_DSN: '',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_SERVICE_ROLE_KEY: 'openapi-generation-service-role-key',
  ACCESS_TOKEN_SECRET: 'a'.repeat(32),
  REFRESH_TOKEN_SECRET: 'b'.repeat(32),
  PASSWORD_RESET_TOKEN_SECRET: 'c'.repeat(32),
  TOKEN_ENCRYPTION_KEY: 'd'.repeat(32),
  ACCESS_TOKEN_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_DAYS: '30',
  ARGON2_MEMORY_COST: '65536',
  ARGON2_TIME_COST: '3',
  ARGON2_PARALLELISM: '1',
  AI_PROVIDER: '',
  AI_API_KEY: '',
  AI_MODEL: '',
  OPENAI_API_KEY: '',
  REVENUECAT_PROJECT_ID: '',
  REVENUECAT_API_KEY: '',
  REVENUECAT_ENTITLEMENT_ID: '',
  REVENUECAT_WEBHOOK_SHARED_SECRET: '',
  GOOGLE_PLAY_PACKAGE_NAME: '',
  GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64: '',
  GOOGLE_SIGN_IN_CLIENT_IDS: '',
  GOOGLE_OAUTH_CLIENT_ID: '',
  GOOGLE_OAUTH_CLIENT_SECRET: '',
  GOOGLE_OAUTH_REDIRECT_URL: '',
  GOOGLE_OAUTH_REDIRECT_URI: '',
  SMTP_HOST: '',
  SMTP_PORT: '',
  SMTP_USER: '',
  SMTP_PASSWORD: '',
  EMAIL_FROM: '',
};

for (const [key, value] of Object.entries(generationEnv)) {
  process.env[key] = value;
}

function stableStringify(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function buildOpenApiJson() {
  const { buildApp } = await import('../src/app.js');
  const app = await buildApp({ logger: false });

  try {
    await app.ready();

    return stableStringify(app.swagger());
  } finally {
    await app.close();
  }
}

const checkOnly = process.argv.includes('--check');
const openApiJson = await buildOpenApiJson();

if (checkOnly) {
  const currentOpenApiJson = await readFile(openApiJsonPath, 'utf8');

  if (currentOpenApiJson !== openApiJson) {
    throw new Error(
      'OpenAPI contract drift detected. Run `npm run openapi:generate` and commit docs/openapi.json.',
    );
  }
} else {
  await mkdir(path.dirname(openApiJsonPath), { recursive: true });
  await writeFile(openApiJsonPath, openApiJson);
}
