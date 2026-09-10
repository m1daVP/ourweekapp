import {AbsoluteFill, OffthreadVideo, staticFile} from 'remotion';

export const PhoneCapture = ({source}: {source: string}) => (
  <AbsoluteFill style={{alignItems: 'center', backgroundColor: '#faf9f5', justifyContent: 'center', overflow: 'hidden'}}>
    <div style={{background: '#1a1c1a', borderRadius: 52, boxShadow: '0 24px 80px rgba(26,28,26,0.24)', height: '91%', overflow: 'hidden', padding: 10}}>
      <OffthreadVideo muted src={staticFile(source)} style={{borderRadius: 43, height: '100%', objectFit: 'contain'}} />
    </div>
  </AbsoluteFill>
);
