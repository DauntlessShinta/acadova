import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGrowth } from '../../utils/useGrowth';
import RankBadge from './RankBadge';
import './growthExperience.css';

export default function HeaderGrowth({ compact = false }) {
  const { user } = useAuth();
  const enabled = user?.role === 'student' && user?.experience?.expActive === true;
  const { data, error } = useGrowth(enabled);
  const id = useId();
  const [dismissed,setDismissed] = useState(false);
  if (!enabled || data?.active === false) return null;
  const valid = data?.rank && Number.isSafeInteger(data.totalExp);
  const detail = error ? 'Growth status unavailable. Open My Growth to retry.' : valid
    ? `Level ${data.rank.level}, ${data.rank.title}. ${data.totalExp} EXP. ${data.rank.next ? `${data.rank.needed} EXP required for the next level.` : 'Highest current level reached.'} EXP is recognition, not a grade or currency.`
    : 'Loading your private growth status.';
  return <span className={`ac-header-growth${compact?' is-compact':''}`}>
    <Link to="/growth" aria-label={valid&&!error?`My Growth - Level ${data.rank.level}`:'My Growth'} aria-describedby={id} onFocus={()=>setDismissed(false)} onMouseEnter={()=>setDismissed(false)} onKeyDown={event=>{if(event.key==='Escape')setDismissed(true);}}>
      {valid&&!error ? <><RankBadge level={data.rank.level} small/><span className="ac-header-growth-copy"><strong>{compact?`L${data.rank.level}`:`Lv. ${data.rank.level} · ${data.rank.title}`}</strong><progress value={data.rank.progress} max={1} aria-label="EXP progress"/>{!compact&&<small>{data.rank.next?`${data.rank.needed} EXP to next level`:'Highest current level'}</small>}</span></> : <span className="ac-header-growth-copy"><strong>Growth</strong><small>{error?'Retry':'Loading'}</small></span>}
    </Link><span id={id} role="tooltip" hidden={dismissed} className="ac-header-growth-details">{detail}</span>
  </span>;
}
