import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Database, Network, ShieldCheck, Users, UserRound, Layers, LockKeyhole, MoreHorizontal } from 'lucide-react';
import { moduleProgress } from '../../utils/academicPresentation';
import sessionService from '../../services/sessionService';
const icons = [Database, Network, ShieldCheck, Users];
export function AcadiMark() {
  const gradient = useId();
  return <svg viewBox="0 0 100 92" className="acadi-mark" aria-hidden="true"><defs><linearGradient id={gradient} x2=".8" y2="1"><stop stopColor="#f4fbff"/><stop offset="1" stopColor="#92bcff"/></linearGradient></defs><ellipse cx="50" cy="85" rx="24" ry="4" fill="#95bcff" opacity=".25"/><path d="M49 9v-5" stroke="#427ffc" strokeWidth="4" strokeLinecap="round"/><circle cx="49" cy="4" r="3" fill="#61a9ff"/><rect x="12" y="36" width="10" height="24" rx="5" fill="#85b4fa"/><rect x="78" y="36" width="10" height="24" rx="5" fill="#85b4fa"/><rect x="20" y="15" width="60" height="60" rx="24" fill={`url(#${gradient})`} stroke="#fff" strokeWidth="3"/><rect x="28" y="29" width="44" height="32" rx="15" fill="#123e99"/><path d="M36 43q4-6 8 0m12 0q4-6 8 0m-21 8q7 7 14 0" fill="none" stroke="#b7e6ff" strokeWidth="3" strokeLinecap="round"/><path d="M38 76l-4 5m28-5 4 5" stroke="#5795ee" strokeWidth="7" strokeLinecap="round"/></svg>;
}
export function UpcomingSessions() {
  const [rows, setRows] = useState(null); const [error, setError] = useState(''); const [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; sessionService.getMySessions().then(response => { if (active) { setRows(response.data.filter(row => ['scheduled','accepted','in_progress'].includes(row.status) && new Date(row.scheduledAt) >= new Date()).sort((a,b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))); setError(''); } }).catch(failure => { if (active) setError(failure.message); }); return () => { active = false; }; }, [retry]);
  return <section className="card ac-panel ac-upcoming-sessions"><div className="ac-section-title"><h2>Upcoming Sessions</h2><Link to="/sessions">View All <ArrowRight size={14} aria-hidden="true"/></Link></div>{error ? <div role="alert"><p>{error}</p><button className="btn btn-secondary" onClick={() => setRetry(n => n + 1)}>Retry sessions</button></div> : rows === null ? <p role="status">Loading your sessions...</p> : rows.length ? <ul>{rows.slice(0,3).map(row => <li key={row._id || row.id}><span className="ac-session-dot" aria-hidden="true"/><div><Link to={`/sessions/${row._id || row.id}`}>{row.subject}</Link><p>{new Date(row.scheduledAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</p></div></li>)}</ul> : <div className="ac-plan-empty"><Users size={29} aria-hidden="true"/><h3>No upcoming sessions</h3><p>Your scheduled peer tutoring sessions will appear here.</p><Link className="btn btn-secondary" to="/study-together">Explore Study Together</Link></div>}</section>;
}
export function StudyHero({ eyebrow, title, children, actions, compact = false, headingRef, className = '' }) {
  return <header className={`ac-hero${compact ? ' ac-hero-compact' : ''} ${className}`}><div className="ac-hero-copy"><div className="ac-hero-eyebrow">{eyebrow}</div><h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>{title}</h1>{children && <p>{children}</p>}{actions && <div className="academic-actions">{actions}</div>}</div><div className="ac-hero-art" aria-hidden="true"><div className="ac-art-orbit"/><div className="ac-art-paper"><BookOpen size={52}/><span/><span/></div><span className="ac-art-caption">Your space.<br/>Your next chapter.</span></div></header>;
}
export function ProgressBar({ percent, label }) {
  return <div className="ac-progress" role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }}/></div>;
}
export function MetricCard({ icon: Icon, label, value, hint, tone = 0, progress }) {
  return <article className={`ac-metric ac-tone-${tone}`}><span className="ac-icon-tile"><Icon size={25} aria-hidden="true"/></span><div><h2>{label}</h2><strong>{value}</strong><p>{hint}</p>{progress !== undefined && <ProgressBar percent={progress} label={label + ' percentage'}/>}</div></article>;
}
export function SubjectCard({ subject, index, compact, onEdit, disabled }) {
  const Icon = icons[index % icons.length]; const { total, complete, percent } = moduleProgress(subject);
  return <article className={`card academic-subject ac-tone-${index % 4}${compact ? ' ac-subject-compact' : ''}`}><div className="ac-subject-heading"><span className="ac-icon-tile"><Icon size={27} aria-hidden="true"/></span><div><h3><Link to={`/subjects/${subject.id}`}>{subject.name}</Link></h3>{!compact && subject.instructor && <p><UserRound size={14} aria-hidden="true"/>{subject.instructor}</p>}</div><span className="ac-course-code">{subject.courseCode || 'Personal'}</span></div>
    <div className="ac-subject-meta">{compact && subject.instructor && <p><UserRound size={14} aria-hidden="true"/>{subject.instructor}</p>}{subject.section && <p><Layers size={14} aria-hidden="true"/>{subject.section}</p>}<p><LockKeyhole size={14} aria-hidden="true"/>Private learning workspace{subject.archived ? ' · Archived' : ''}</p></div>
    <div className="ac-subject-bottom"><div className="ac-subject-progress"><div><span>Module completion</span><strong>{percent}%</strong></div><ProgressBar percent={percent} label={`${subject.name}: ${complete} of ${total} modules self-reported complete`}/><small>{complete} of {total} modules marked complete</small></div>{!compact && <div className="ac-subject-buttons"><Link to={`/subjects/${subject.id}`} className="btn btn-secondary">Open Workspace <ArrowRight size={15} aria-hidden="true"/></Link>{onEdit && <button className="btn btn-ghost" disabled={disabled} onClick={() => onEdit(subject)}><MoreHorizontal size={18} aria-hidden="true"/><span className="sr-only">Edit subject</span></button>}</div>}</div>
    {compact && <Link to={`/subjects/${subject.id}`} className="ac-card-open" aria-label={`Open ${subject.name}`}><ArrowRight size={17} aria-hidden="true"/></Link>}
  </article>;
}
export function WorkspaceSkeleton({ label = 'Loading your workspace…' }) {
  return <div className="ac-skeleton" role="status" aria-live="polite"><p>{label}</p><div className="ac-skeleton-hero"/><div className="ac-skeleton-grid">{[0,1,2,3].map(n => <div key={n}/>)}</div></div>;
}
