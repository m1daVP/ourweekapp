/* global AbortSignal, URL, console, fetch, process, setTimeout */

const INTERVAL_MS = 40_000;
const REQUEST_TIMEOUT_MS = 10_000;
const apiBaseUrl = process.env.VITE_API_BASE_URL?.trim();

if (!apiBaseUrl) {
  console.error('VITE_API_BASE_URL must be set.');
  process.exit(1);
}

let healthUrl;

try {
  const baseUrl = new URL(apiBaseUrl);

  if (!['http:', 'https:'].includes(baseUrl.protocol)) {
    throw new Error('Unsupported protocol');
  }

  baseUrl.search = '';
  baseUrl.hash = '';
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/+$/, '')}/health`;
  healthUrl = baseUrl;
} catch {
  console.error('VITE_API_BASE_URL must be a valid HTTP(S) URL.');
  process.exit(1);
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');

  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

async function ping() {
  try {
    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Health check returned ${response.status}`);
    }

    console.log(`[${timestamp()}] Success`);
  } catch {
    console.error(`[${timestamp()}] Fail`);
  } finally {
    setTimeout(ping, INTERVAL_MS);
  }
}

function blueUnderlinedText(text) {
  return `\x1b[36m\x1b[4m${text}\x1b[0m`;
}

void ping();
console.log(`[${timestamp()}] Ping started for ${blueUnderlinedText(healthUrl)}`);
