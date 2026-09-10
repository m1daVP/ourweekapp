import {useCurrentFrame} from 'remotion';
import type {CaptionCue} from '../content/schema';

export const Captions = ({cues}: {cues: CaptionCue[]}) => {
  const frame = useCurrentFrame();
  const cue = cues.find((item) => frame >= item.startFrame && frame < item.endFrame);
  if (!cue) return null;
  return <div style={{position: 'absolute', left: '8%', right: '8%', bottom: '7%', textAlign: 'center'}}><span style={{backgroundColor: 'rgba(250,249,245,0.94)', borderRadius: 26, color: '#1a1c1a', display: 'inline-block', fontFamily: 'Arial, sans-serif', fontSize: 42, fontWeight: 700, lineHeight: 1.2, padding: '18px 26px'}}>{cue.text}</span></div>;
};
