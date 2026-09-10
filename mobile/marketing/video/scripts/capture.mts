import { mkdir, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

type CaptureTarget = { file: string; url: string };

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const loadTargets = (): CaptureTarget[] => {
  const raw = required('VIDEO_CAPTURE_TARGETS_JSON');
  const value: unknown = JSON.parse(raw);
  if (
    !Array.isArray(value) ||
    value.some(
      (target) =>
        !target ||
        typeof target !== 'object' ||
        typeof (target as CaptureTarget).file !== 'string' ||
        typeof (target as CaptureTarget).url !== 'string'
    )
  ) {
    throw new Error(
      'VIDEO_CAPTURE_TARGETS_JSON must be a JSON array of {file, url} objects'
    );
  }
  return value as CaptureTarget[];
};

const main = async () => {
  const baseUrl = required('VIDEO_BASE_URL');
  const email = required('VIDEO_DEMO_EMAIL');
  const password = required('VIDEO_DEMO_PASSWORD');
  const targets = loadTargets();
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const captures = resolve(root, 'public', 'assets', 'captures');
  const authState = resolve(captures, '.auth-state.json');
  await mkdir(captures, { recursive: true });

  const browser = await chromium.launch();
  try {
    console.log('Signing in to the local demo account…');
    const loginContext = await browser.newContext({
      viewport: { width: 432, height: 768 },
      deviceScaleFactor: 2,
    });
    const loginPage = await loginContext.newPage();
    await loginPage.goto(new URL('/sign-in', baseUrl).toString(), {
      waitUntil: 'domcontentloaded',
    });
    await loginPage
      .locator('input[type="email"]')
      .waitFor({ state: 'visible', timeout: 10_000 });
    await loginPage.locator('input[type="email"]').fill(email);
    await loginPage.locator('input[type="password"]').fill(password);
    await loginPage.locator('button[type="submit"]').click();
    try {
      await loginPage.waitForURL((url) => !url.pathname.endsWith('/sign-in'), {
        timeout: 10_000,
        waitUntil: 'commit',
      });
    } catch {
      throw new Error(
        `Demo sign-in did not complete: ${(await loginPage.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 500)}`
      );
    }
    await loginContext.storageState({ path: authState });
    await loginContext.close();
    console.log('Authenticated demo state saved.');

    for (const target of targets) {
      console.log(`Recording ${target.file}…`);
      const context = await browser.newContext({
        storageState: authState,
        viewport: { width: 432, height: 768 },
        deviceScaleFactor: 2,
        recordVideo: { dir: captures, size: { width: 1080, height: 1920 } },
      });
      const page = await context.newPage();
      await page.goto(new URL(target.url, baseUrl).toString(), {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForTimeout(1000);
      const recording = page.video();
      await page.waitForTimeout(2000);
      await context.close();
      if (!recording)
        throw new Error(`No recording was created for ${target.file}`);
      const recordedPath = await recording.path();
      const destination = resolve(captures, target.file);
      if (recordedPath !== destination) await rename(recordedPath, destination);
      console.log(`Saved ${target.file}.`);
    }
  } finally {
    await browser.close();
  }
};

void main();
