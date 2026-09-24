// Deletes all *.map files under dist/ so sourcemaps never ship in the APK,
// even if the Sentry upload (which normally deletes them) was skipped.
import { rm, readdir } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

let deleted = 0;

async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return; // no dist/ -> nothing to strip
    throw err;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
    } else if (entry.isFile() && entry.name.endsWith('.map')) {
      await rm(path);
      deleted++;
    }
  }
}

try {
  await walk(distDir);
  console.log(`strip-sourcemaps: deleted ${deleted} .map file(s) under dist/`);
} catch (err) {
  console.error('strip-sourcemaps: failed:', err);
  process.exit(1);
}
