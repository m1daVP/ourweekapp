import { Composition } from 'remotion';
import { shipatonBrief } from './content/shipaton';
import { tiktokBriefs } from './content/tiktok';
import { getBriefDurationFrames } from './lib/timing';
import { VideoBriefComposition } from './compositions/VideoBriefComposition';

export const Root = () => (
  <>
    <Composition
      id="ShipatonDemo"
      component={VideoBriefComposition}
      defaultProps={{ brief: shipatonBrief }}
      width={shipatonBrief.width}
      height={shipatonBrief.height}
      fps={shipatonBrief.fps}
      durationInFrames={getBriefDurationFrames(shipatonBrief)}
    />
    {tiktokBriefs.map((brief) => (
      <Composition
        key={brief.id}
        id={brief.id}
        component={VideoBriefComposition}
        defaultProps={{ brief }}
        width={brief.width}
        height={brief.height}
        fps={brief.fps}
        durationInFrames={getBriefDurationFrames(brief)}
      />
    ))}
  </>
);
