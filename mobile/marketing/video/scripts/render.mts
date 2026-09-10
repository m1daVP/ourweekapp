import {access, mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {shipatonBrief} from '../src/content/shipaton.js';
import {tiktokBriefs} from '../src/content/tiktok.js';
import type {VideoBrief} from '../src/content/schema.js';
import {toSrt} from '../src/lib/srt.js';

type RenderTarget = {brief: VideoBrief; compositionId: string; filename: string};

const targets: RenderTarget[] = [
  {brief: shipatonBrief, compositionId: 'ShipatonDemo', filename: 'ourweek-shipaton-2026.mp4'},
  {brief: tiktokBriefs[0], compositionId: tiktokBriefs[0].id, filename: 'ourweek-tiktok-sunday-conversation.mp4'},
  {brief: tiktokBriefs[1], compositionId: tiktokBriefs[1].id, filename: 'ourweek-tiktok-weekly-ritual.mp4'},
  {brief: tiktokBriefs[2], compositionId: tiktokBriefs[2].id, filename: 'ourweek-tiktok-nothing-disappears.mp4'},
];

const run = (command: string, args: string[], cwd: string) => new Promise<void>((resolveRun, reject) => {
  const child = spawn(command, args, {cwd, shell: process.platform === 'win32', stdio: 'inherit'});
  child.once('error', reject);
  child.once('exit', (code) => code === 0 ? resolveRun() : reject(new Error(`${command} exited with ${code}`)));
});

const ensureAssets = async (brief: VideoBrief, root: string) => {
  const files = [
    ...brief.clips.map((clip) => resolve(root, 'public', clip.source)),
    ...brief.clips.map((clip) => resolve(root, 'public', 'audio', `${brief.id}-${clip.id}.wav`)),
  ];
  for (const file of files) {
    try { await access(file); } catch { throw new Error(`Required render asset is missing: ${file}`); }
  }
};

const main = async () => {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const out = resolve(root, 'out');
  await mkdir(out, {recursive: true});
  for (const target of targets) {
    await ensureAssets(target.brief, root);
    await writeFile(resolve(out, target.filename.replace(/\.mp4$/, '.srt')), toSrt(target.brief.clips.flatMap((clip) => clip.captions), target.brief.fps));
    await run('npx', ['remotion', 'render', 'src/index.ts', target.compositionId, resolve(out, target.filename), '--codec=h264', '--crf=18'], root);
  }
};

void main();
