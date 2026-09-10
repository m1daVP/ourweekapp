import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const sourceDirectory = path.join(
  projectRoot,
  'src',
  'modules',
  'exports',
  'assets',
);
const destinationDirectory = path.join(
  projectRoot,
  'dist',
  'modules',
  'exports',
  'assets',
);

await mkdir(destinationDirectory, { recursive: true });
await cp(sourceDirectory, destinationDirectory, { force: true, recursive: true });
