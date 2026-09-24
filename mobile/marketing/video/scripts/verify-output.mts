import { access, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export type VideoMetadata = {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  codec: string;
};
export type VideoRules = {
  width: number;
  height: number;
  minSeconds: number;
  maxSeconds: number;
};

export const validateVideoMetadata = (
  metadata: VideoMetadata,
  rules: VideoRules
): string[] => {
  const errors: string[] = [];
  if (metadata.width !== rules.width || metadata.height !== rules.height)
    errors.push(`dimensions must be ${rules.width}x${rules.height}`);
  if (metadata.fps !== 30) errors.push('fps must be 30');
  if (metadata.codec !== 'h264') errors.push('codec must be h264');
  if (metadata.durationSeconds < rules.minSeconds)
    errors.push(`duration must be >= ${rules.minSeconds} seconds`);
  if (metadata.durationSeconds > rules.maxSeconds)
    errors.push(`duration must be <= ${rules.maxSeconds} seconds`);
  return errors;
};

const execFileAsync = promisify(execFile);
const probe = async (file: string): Promise<VideoMetadata> => {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration:stream=codec_name,width,height,r_frame_rate',
    '-of',
    'json',
    file,
  ]);
  const result = JSON.parse(stdout) as {
    format: { duration: string };
    streams: Array<{
      codec_name?: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
    }>;
  };
  const video = result.streams.find((stream) => stream.width && stream.height);
  if (
    !video?.r_frame_rate ||
    !video.codec_name ||
    !video.width ||
    !video.height
  )
    throw new Error(`Unable to read video metadata: ${file}`);
  const [numerator, denominator] = video.r_frame_rate.split('/').map(Number);
  return {
    width: video.width,
    height: video.height,
    fps: Math.round(numerator / denominator),
    durationSeconds: Number(result.format.duration),
    codec: video.codec_name,
  };
};

const main = async () => {
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const outputs = [
    [
      'ourweek-shipaton-2026.mp4',
      { width: 1920, height: 1080, minSeconds: 1, maxSeconds: 115 },
    ],
    [
      'ourweek-tiktok-sunday-conversation.mp4',
      { width: 1080, height: 1920, minSeconds: 20, maxSeconds: 30 },
    ],
    [
      'ourweek-tiktok-weekly-ritual.mp4',
      { width: 1080, height: 1920, minSeconds: 20, maxSeconds: 30 },
    ],
    [
      'ourweek-tiktok-nothing-disappears.mp4',
      { width: 1080, height: 1920, minSeconds: 20, maxSeconds: 30 },
    ],
  ] as const;
  const report = [];
  for (const [name, rules] of outputs) {
    const file = resolve(root, 'out', name);
    const srt = file.replace(/\.mp4$/, '.srt');
    await access(srt);
    if ((await stat(file)).size === 0)
      throw new Error(`Output is empty: ${file}`);
    const metadata = await probe(file);
    const errors = validateVideoMetadata(metadata, rules);
    report.push({ name, metadata, errors });
    if (errors.length) throw new Error(`${name}: ${errors.join(', ')}`);
  }
  await writeFile(
    resolve(root, 'out', 'verification-report.json'),
    JSON.stringify(report, null, 2)
  );
};

if (process.argv[1]?.endsWith('verify-output.mts')) void main();
