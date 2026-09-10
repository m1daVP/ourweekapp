import {videoBriefSchema, type VideoBrief} from './schema';

const at = (seconds: number) => seconds * 30;

const verticalBrief = (id: string, duration: number, hookText: string, narration: string): VideoBrief =>
  videoBriefSchema.parse({
    id,
    fps: 30,
    width: 1080,
    height: 1920,
    hook: {startFrame: 0, endFrame: at(2), text: hookText},
    clips: [{
      id: 'story',
      source: `assets/captures/${id}.mp4`,
      startFrame: 0,
      endFrame: at(duration - 2),
      narration,
      captions: [{startFrame: 0, endFrame: at(duration - 2), text: narration}],
    }],
    endCard: {startFrame: at(duration - 2), endFrame: at(duration), text: 'OurWeek'},
    categories: [],
  });

export const tiktokBriefs = [
  verticalBrief('ourweek-tiktok-sunday-conversation', 25, 'We kept having the same conversation every Sunday.', 'A short OurWeek check-in helped us make one agreement and leave with a calmer next step.'),
  verticalBrief('ourweek-tiktok-weekly-ritual', 23, 'A weekly check-in that actually sticks.', 'Start with a prompt, name the topic, choose who will take care of it, and finish with a shared recap.'),
  verticalBrief('ourweek-tiktok-nothing-disappears', 26, 'Don’t let the important things disappear after the conversation.', 'OurWeek keeps unfinished tasks and agreements ready for next week, when you can revisit them together.'),
] as const;
