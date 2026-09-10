import type { CaptionCue } from '../content/schema';

const timestamp = (frame: number, fps: number): string => {
  const milliseconds = Math.round((frame / fps) * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const remainder = milliseconds % 1000;
  return (
    [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, '0'))
      .join(':') + `,${String(remainder).padStart(3, '0')}`
  );
};

export const toSrt = (cues: CaptionCue[], fps: number): string => {
  const ordered = [...cues].sort(
    (left, right) => left.startFrame - right.startFrame
  );
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index - 1].endFrame > ordered[index].startFrame)
      throw new Error('Caption cues must not overlap');
  }
  return (
    ordered
      .map(
        (cue, index) =>
          `${index + 1}\n${timestamp(cue.startFrame, fps)} --> ${timestamp(cue.endFrame, fps)}\n${cue.text}`
      )
      .join('\n\n') + '\n'
  );
};
