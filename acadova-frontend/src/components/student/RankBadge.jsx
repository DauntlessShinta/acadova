import { useId } from 'react';
// Original Acadova compass/book insignia, composed as code-native SVG.
export default function RankBadge({ level=1, small=false }) {
  const id=useId();
  const palettes=[['#e4f1ff','#246bfd'],['#d6f8ef','#087b67'],['#ece2ff','#7545bb'],['#ffedd1','#ab630b'],['#d6f2fb','#116f96'],['#fbe0eb','#a13d68']];
  const [light,dark]=palettes[Math.min(5,Math.max(0,level-1))];
  return <svg className={`ac-rank-badge${small?' is-small':''}`} viewBox="0 0 100 110" role="img" aria-label={`Acadova level ${level} rank insignia`}><defs><linearGradient id={id} x2="1" y2="1"><stop stopColor={light}/><stop offset="1" stopColor={dark}/></linearGradient></defs><path d="M50 5 88 27v48l-38 29-38-29V27Z" fill={`url(#${id})`} stroke={dark} strokeWidth="3"/><path d="m50 16 28 17v36L50 91 22 69V33Z" fill="#fff" fillOpacity=".9"/><path d="M50 36v31m-16-25 16-6 16 6v25l-16-6-16 6Z" fill="none" stroke={dark} strokeWidth="3" strokeLinejoin="round"/>{Array.from({length:Math.min(6,level)},(_,i)=><circle key={i} cx={35+i*6} cy="80" r="1.8" fill={dark}/>)}</svg>;
}
