import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
export function GrowthSummary() {
  const [data,setData]=useState(null); const [error,setError]=useState(''); const [retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;api.get('/api/growth').then(response=>{if(active){setData(response.data);setError('');}}).catch(failure=>{if(active)setError(failure.message);});return()=>{active=false;};},[retry]);
  return <div className="ac-growth-summary"><Link to="/growth">Growth</Link>{error ? <><span role="status">Growth status unavailable.</span><button className="btn btn-ghost" onClick={()=>setRetry(value=>value+1)}>Retry growth</button></> : !data ? <span role="status">Loading recognition status…</span> : <span>{data.active && Number.isSafeInteger(data.totalExp) ? `${data.totalExp} EXP` : 'EXP recognition is not active yet'}</span>}</div>;
}
export default function GrowthPage() {
  return <section className="container-narrow"><header><h1>Your Growth</h1><p>Private academic recognition, separate from credits.</p></header><div className="card"><GrowthSummary/><h2>EXP foundations</h2><p>EXP is not activated. No credits are converted, spent or transferred as EXP. Your existing credit balance and transaction history remain unchanged.</p><h2>What may qualify after activation</h2><ul><li>Your first valid completion of an official assessment milestone.</li><li>A peer-tutoring contribution supported by the existing mutual check-in and confirmation workflow.</li></ul><p>Uploads, generated quizzes, flashcard flips and self-created practice do not earn EXP. Proposed tutoring safeguards limit repeated pairs and daily or weekly awards. There is no public leaderboard.</p><Link className="btn btn-secondary" to="/credits">Credits &amp; transaction history</Link></div></section>;
}
