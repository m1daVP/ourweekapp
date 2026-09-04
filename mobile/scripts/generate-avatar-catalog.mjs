import { readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const assetRoot = join(process.cwd(), 'src', 'assets', 'avatars');
const outputPath = join(process.cwd(), 'src', 'features', 'participants', 'avatar-catalog.json');
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const groupEntries = await readdir(assetRoot, { withFileTypes: true });
const groups = [];
const avatarIds = new Set();

for (const entry of groupEntries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!identifierPattern.test(entry.name)) throw new Error(`Avatar group "${entry.name}" must use lowercase kebab-case.`);
  const groupPath = join(assetRoot, entry.name);
  const files = (await readdir(groupPath, { withFileTypes: true })).filter((file) => file.isFile() && file.name.endsWith('.webp')).sort((a, b) => a.name.localeCompare(b.name));
  if (files.length === 0) throw new Error(`Avatar group "${entry.name}" must contain at least 1 WebP file.`);
  const avatars = files.map((file) => {
    const id = file.name.slice(0, -'.webp'.length);
    if (!identifierPattern.test(id)) throw new Error(`Avatar filename "${file.name}" must use lowercase kebab-case.`);
    if (avatarIds.has(id)) throw new Error(`Avatar ID "${id}" must be unique across all groups.`);
    avatarIds.add(id);
    return { id, path: `/src/${relative(join(process.cwd(), 'src'), join(groupPath, file.name)).split(sep).join('/')}` };
  });
  groups.push({ id: entry.name, avatars });
}

if (groups.length === 0) throw new Error('Avatar catalog must contain at least 1 group.');
await writeFile(outputPath, `${JSON.stringify({ groups }, null, 2)}\n`);
console.log(`Generated ${outputPath} with ${avatarIds.size} avatars.`);
