import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import service from '../../services/studyService';
import { GrowthSummary } from '../../pages/GrowthPage';
export default function RecentStudySets({ subjectIds }) {
  const [rows,setRows]=useState(null); const [error,setError]=useState(''); const [retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;service.mine().then(response=>{if(active){setRows(response.data);setError('');}}).catch(failure=>{if(active)setError(failure.message);});return()=>{active=false;};},[retry]);
  useEffect(()=>{const changed=event=>{if(/^\/api\/(?:study-sets|ai-study\/sets)(?:\/|$)/.test(event.detail?.endpoint || ''))setRetry(value=>value+1);};window.addEventListener('acadova:data-changed',changed);return()=>window.removeEventListener('acadova:data-changed',changed);},[]);
  const shown=(rows || []).filter(row=>!row.subjectId || subjectIds.includes(String(row.subjectId))).slice(0,3);
  return <section className="card ac-recent-sets"><div className="academic-header"><h2>Recent Study Sets</h2><Link to="/study-sets">View library</Link></div><p className="form-hint">Your current term and unassigned sets</p>{error ? <><p role="alert">Unable to load recent sets.</p><button className="btn btn-secondary" onClick={()=>setRetry(value=>value+1)}>Retry recent sets</button></> : rows === null ? <p role="status">Loading your sets…</p> : !shown.length ? <p>No saved study sets here yet. Create a set or review an AI preview before saving.</p> : <ul>{shown.map(row=><li key={row.id}><Link to={row.origin === 'ai' ? `/learning/ai-study/${row.id}` : `/study-sets/${row.id}`}>{row.title}</Link></li>)}</ul>}<GrowthSummary/></section>;
}
