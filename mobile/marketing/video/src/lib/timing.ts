import type { VideoBrief } from '../content/schema';

export const secondsToFrames = (seconds: number, fps: number): number =>
  Math.round(seconds * fps);

export const getBriefDurationFrames = (brief: VideoBrief): number =>
  Math.max(brief.endCard.endFrame, ...brief.clips.map((clip) => clip.endFrame));
