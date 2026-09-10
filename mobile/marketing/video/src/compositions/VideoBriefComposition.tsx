import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import type { VideoBrief } from '../content/schema';
import { Captions } from '../components/Captions';
import { EndCard } from '../components/EndCard';
import { PhoneCapture } from '../components/PhoneCapture';

export const VideoBriefComposition = ({ brief }: { brief: VideoBrief }) => (
  <AbsoluteFill style={{ backgroundColor: '#faf9f5' }}>
    {brief.clips.map((clip) => (
      <Sequence
        key={clip.id}
        from={clip.startFrame}
        durationInFrames={clip.endFrame - clip.startFrame}
      >
        <PhoneCapture source={clip.source} />
        <Audio
          src={staticFile(`audio/${brief.id}-${clip.id}.wav`)}
          volume={0.9}
        />
      </Sequence>
    ))}
    <Captions cues={brief.clips.flatMap((clip) => clip.captions)} />
    <Sequence
      from={brief.endCard.startFrame}
      durationInFrames={brief.endCard.endFrame - brief.endCard.startFrame}
    >
      <EndCard categories={brief.categories} text={brief.endCard.text} />
    </Sequence>
  </AbsoluteFill>
);
