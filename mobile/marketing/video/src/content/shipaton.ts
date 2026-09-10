import {videoBriefSchema, type VideoBrief} from './schema';

const at = (seconds: number) => seconds * 30;

const clip = (id: string, source: string, start: number, end: number, narration: string): VideoBrief['clips'][number] => ({
  id,
  source,
  startFrame: at(start),
  endFrame: at(end),
  narration,
  captions: [{startFrame: at(start), endFrame: at(end), text: narration}],
});

export const shipatonBrief = videoBriefSchema.parse({
  id: 'ourweek-shipaton-2026',
  fps: 30,
  width: 1920,
  height: 1080,
  hook: {startFrame: 0, endFrame: at(2), text: 'A calmer way to begin the week.'},
  clips: [
    clip('home', 'assets/captures/01-home.mp4', 0, 10, 'Busy households do not need another task app. They need a calmer place to begin the week.'),
    clip('check-in', 'assets/captures/02-check-in.mp4', 10, 35, 'OurWeek guides a short weekly check-in: choose who is here, begin with a thoughtful prompt, and name what matters.'),
    clip('recap', 'assets/captures/03-recap.mp4', 35, 65, 'Turn the conversation into a shared agreement, a clear next step, and a recap everyone can return to.'),
    clip('history', 'assets/captures/04-history.mp4', 65, 85, 'When a meeting ends, its shared task and recap stay together, ready for the week ahead.'),
    clip('premium', 'assets/captures/05-premium.mp4', 85, 100, 'Premium unlocks AI summaries, focused templates, calendar sync, and exports through our RevenueCat upgrade flow.'),
    clip('reminder', 'assets/captures/06-reminder.mp4', 100, 110, 'A local reminder brings the ritual back next week.'),
  ],
  endCard: {startFrame: at(110), endFrame: at(115), text: 'OurWeek — built for calmer households.'},
  categories: ['Grand Prize', 'RevenueCat Design Award', 'HAMM Award', 'RevenueCat Peace Prize', '#BuildInPublic Award'],
});
