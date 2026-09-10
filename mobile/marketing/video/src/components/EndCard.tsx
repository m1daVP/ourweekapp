import {AbsoluteFill} from 'remotion';

export const EndCard = ({categories, text}: {categories: string[]; text: string}) => (
  <AbsoluteFill style={{alignItems: 'center', backgroundColor: '#456349', color: '#faf9f5', fontFamily: 'Georgia, serif', justifyContent: 'center', padding: 90, textAlign: 'center'}}>
    <div style={{fontSize: 88, fontWeight: 700, letterSpacing: -3}}>OurWeek</div>
    <div style={{fontFamily: 'Arial, sans-serif', fontSize: 34, marginTop: 28}}>{text}</div>
    {categories.length > 0 ? <div style={{fontFamily: 'Arial, sans-serif', fontSize: 21, lineHeight: 1.45, marginTop: 52}}>{categories.join('  ·  ')}</div> : null}
  </AbsoluteFill>
);
