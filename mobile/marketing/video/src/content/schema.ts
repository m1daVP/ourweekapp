import { z } from 'zod';

export const captionCueSchema = z
  .object({
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().positive(),
    text: z.string().min(1),
  })
  .refine(
    (cue) => cue.endFrame > cue.startFrame,
    'Caption endFrame must be after startFrame'
  );

export const timedClipSchema = z
  .object({
    id: z.string().min(1),
    source: z.string().min(1),
    startFrame: z.number().int().nonnegative(),
    endFrame: z.number().int().positive(),
    narration: z.string().min(1),
    captions: z.array(captionCueSchema).min(1),
  })
  .refine(
    (clip) => clip.endFrame > clip.startFrame,
    'Clip endFrame must be after startFrame'
  );

export const videoBriefSchema = z
  .object({
    id: z.string().min(1),
    fps: z.literal(30),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    hook: captionCueSchema,
    clips: z.array(timedClipSchema).min(1),
    endCard: captionCueSchema,
    categories: z.array(z.string()),
  })
  .superRefine((brief, context) => {
    const duration = Math.max(
      brief.endCard.endFrame,
      ...brief.clips.map((clip) => clip.endFrame)
    );
    for (const clip of brief.clips) {
      if (clip.endFrame > duration) {
        context.addIssue({
          code: 'custom',
          message: `Clip ${clip.id} exceeds video duration`,
        });
      }
    }
  });

export type CaptionCue = z.infer<typeof captionCueSchema>;
export type TimedClip = z.infer<typeof timedClipSchema>;
export type VideoBrief = z.infer<typeof videoBriefSchema>;
