import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shipatonBrief } from '../src/content/shipaton.js';
import { tiktokBriefs } from '../src/content/tiktok.js';
import type { TimedClip, VideoBrief } from '../src/content/schema.js';

export const buildNarrationRequest = (input: string) => ({
  model: 'gpt-4o-mini-tts',
  voice: 'marin',
  input,
  instructions:
    'Warm, calm, grounded English presentation voice. Conversational and clear, never theatrical. Use a measured pace and natural pauses.',
  response_format: 'wav',
});

const generateClipNarration = async (
  brief: VideoBrief,
  clip: TimedClip,
  apiKey: string,
  projectRoot: string
): Promise<void> => {
  const input = clip.narration;
  if (input.length > 4096)
    throw new Error(`${brief.id} narration exceeds 4096 characters`);
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildNarrationRequest(input)),
  });
  if (!response.ok)
    throw new Error(`Narration generation failed with HTTP ${response.status}`);
  const destination = resolve(
    projectRoot,
    'public',
    'audio',
    `${brief.id}-${clip.id}.wav`
  );
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
};

const main = async () => {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;
  if (!apiKey)
    throw new Error(
      'OPENAI_API_KEY or AI_API_KEY is required to generate narration'
    );
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  for (const brief of [shipatonBrief, ...tiktokBriefs]) {
    for (const clip of brief.clips)
      await generateClipNarration(brief, clip, apiKey, root);
  }
};

if (process.argv[1]?.endsWith('generate-narration.mts')) void main();
