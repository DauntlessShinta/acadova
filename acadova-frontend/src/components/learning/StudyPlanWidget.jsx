import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import service from '../../services/academicService';
import { toSessionInstant } from '../../utils/sessionPresentation';
import { CalendarDays, Check, Pencil, Trash2, Lightbulb, ArrowRight, Plus } from 'lucide-react';
import { AcadiMark } from './AcademicUi';
import Modal from '../common/Modal';
import Alert from '../common/Alert';
import { useConfirm } from '../../context/confirmAccess';
const localDate = value => {
  if (!value) return ''; const date = new Date(value); const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
function PlanEditor({ item, subjectId, subjects, close, saved }) {
  const [title, setTitle] = useState(item?.title || ''); const [kind, setKind] = useState(item?.kind || 'task');
  const [subject, setSubject] = useState(item?.subjectId || subjectId || subjects[0]?.id || ''); const [moduleId, setModuleId] = useState(item?.moduleId || '');
  const [modules, setModules] = useState([]); const [due, setDue] = useState(localDate(item?.dueAt)); const [notes, setNotes] = useState(item?.notes || '');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const pending = useRef(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => { let active = true; if (subject) service.subject(subject).then(response => { if (active) setModules(response.data.modules); }).catch(failure => { if (active) setError(failure.message); }); return () => { active = false; }; }, [subject]);
  return <Modal isOpen title={item ? 'Edit study plan entry' : 'Add study plan entry'} onClose={() => { if (!pending.current) close(); }}><form className="academic-form" onSubmit={async event => {
    event.preventDefault(); if (pending.current) return; setError(''); pending.current = true; setBusy(true);
    try {
      const body = { subjectId: subject, moduleId: moduleId || null, kind, title, notes, dueAt: due ? toSessionInstant(due) : null, timezone };
      if (item) await service.editPlan(item.id, { ...body, version: item.version }); else await service.createPlan(body);
      await saved(); close();
    } catch (failure) { setError(failure.message); } finally { pending.current = false; setBusy(false); }
  }}>
    <label className="form-label" htmlFor="plan-subject">Subject<select id="plan-subject" className="form-select" value={subject} required disabled={busy || Boolean(item) || Boolean(subjectId)} onChange={event => { setSubject(event.target.value); setModuleId(''); }}>{subjects.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    <label className="form-label" htmlFor="plan-module">Module (optional)<select id="plan-module" className="form-select" value={moduleId} disabled={busy} onChange={event => setModuleId(event.target.value)}><option value="">Subject-wide</option>{modules.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}</select></label>
    <label className="form-label" htmlFor="plan-kind">Entry type<select id="plan-kind" className="form-select" value={kind} disabled={busy} onChange={event => setKind(event.target.value)}><option value="task">Study task</option><option value="exam">Exam</option><option value="goal">Study goal</option></select></label>
    <label className="form-label" htmlFor="plan-title">Title<input id="plan-title" className="form-input" value={title} maxLength={120} required disabled={busy} onChange={event => setTitle(event.target.value)} /></label>
    <label className="form-label" htmlFor="plan-date">Date and time (optional, {timezone})<input id="plan-date" className="form-input" type="datetime-local" value={due} disabled={busy} onChange={event => setDue(event.target.value)} /></label>
    <p className="form-hint">This is a date you enter yourself. Leave it empty for an undated goal or task. Dates are stored as UTC instants and displayed in your device timezone.</p>
    <label className="form-label" htmlFor="plan-notes">Private notes (optional)<textarea id="plan-notes" className="form-input" value={notes} rows={3} maxLength={1000} disabled={busy} onChange={event => setNotes(event.target.value)} /></label>
    {error && <Alert type="danger" message={error} />}<div className="academic-actions"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save plan entry'}</button><button className="btn btn-secondary" disabled={busy} type="button" onClick={close}>Cancel</button></div>
  </form></Modal>;
}
export default function StudyPlanWidget({ subjectId, layout = 'sidebar' }) {
  const location = useLocation();
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [editor, setEditor] = useState(null);
  const pending = useRef(false); const active = useRef(true); const generation = useRef(0); const confirm = useConfirm();
  const load = useCallback(async () => { const request = ++generation.current; try { const response = await service.plans(subjectId); if (active.current && request === generation.current) { setData(response.data); setError(''); } } catch (failure) { if (active.current && request === generation.current) setError(failure.message); } }, [subjectId]);
  const end = useCallback(() => { active.current = false; }, []);
  useEffect(() => { let mounted = true; active.current = true; Promise.resolve().then(() => { if (mounted) load(); }); return () => { mounted = false; end(); }; }, [load, end]);
  useEffect(() => {
    const changed = event => { const endpoint = event.detail?.endpoint || ''; if (!pending.current && (/^\/api\/academic\/(?:modules|subjects)/.test(endpoint) || /\/(?:practice|submit)$/.test(endpoint))) load(); };
    window.addEventListener('acadova:data-changed', changed); return () => window.removeEventListener('acadova:data-changed', changed);
  }, [load]);
  const ready = Boolean(data);
  useEffect(() => {
    if (subjectId || !ready || location.hash !== '#study-planning') return;
    const frame = requestAnimationFrame(() => {
      const panel = document.getElementById('study-planning');
      panel?.scrollIntoView({ block: 'start', behavior: 'instant' });
      panel?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.hash, ready, subjectId]);
  const run = async action => { if (pending.current) return; pending.current = true; setBusy(true); setError(''); try { await action(); await load(); } catch (failure) { if (active.current) setError(failure.message); } finally { pending.current = false; if (active.current) setBusy(false); } };
  return <div className={`study-plan-widget ac-planning-${layout}`} id="study-planning" role="region" tabIndex={-1} aria-label="Private study planning">
    <section className="card ac-plan-card"><div className="academic-header"><div><h2><CalendarDays size={19} aria-hidden="true"/> {layout === 'dashboard' ? 'Up Next / Study Plan' : 'Upcoming Study Plan'}</h2><p className="form-hint">Private | Dates you entered</p></div>{data?.subjects?.length > 0 && <button className="btn btn-secondary ac-icon-button" disabled={busy} onClick={() => setEditor({})}><Plus size={18} aria-hidden="true"/><span className="sr-only">Add exam / goal / task</span></button>}</div>
    {error && <><Alert type="danger" message={error}/><button className="btn btn-secondary" onClick={load}>Retry study plan</button></>}{!data && !error && <p role="status">Loading study plan...</p>}
    {data && <>{!data.items.length && <div className="ac-plan-empty"><CalendarDays size={26} aria-hidden="true"/><p>No study plans yet. Add a subject, then enter your own exam, goal, or study task.</p></div>}<ul className="study-plan-list">{data.items.map(item => <li key={item.id}><div><Link to={`/subjects/${item.subjectId}`}><strong>{item.title}</strong></Link><p>{item.kind} | {item.completed ? 'Marked complete' : 'Pending'}<br/>{item.dueAt ? new Date(item.dueAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'No date entered'}</p>{item.notes && <details><summary>Private notes</summary><p className="academic-note">{item.notes}</p></details>}</div><div className="academic-actions"><button className="btn btn-secondary ac-icon-button" disabled={busy} onClick={() => run(() => service.editPlan(item.id,{completed:!item.completed,version:item.version}))}><Check size={16} aria-hidden="true"/><span className="sr-only">{item.completed ? 'Reopen' : 'Mark complete'}</span></button><button className="btn btn-ghost ac-icon-button" disabled={busy} onClick={() => setEditor(item)}><Pencil size={15} aria-hidden="true"/><span className="sr-only">Edit / reschedule</span></button><button className="btn btn-ghost ac-icon-button" disabled={busy} onClick={async () => { if(await confirm('Delete this private study plan entry?',{title:'Delete plan entry',label:'Delete'}))run(() => service.removePlan(item.id,item.version)); }}><Trash2 size={15} aria-hidden="true"/><span className="sr-only">Delete plan entry</span></button></div></li>)}</ul></>}
    </section>
    <section className="card ac-nudges-card"><header><div><h2>Acadi Suggestions</h2><p className="form-hint">Rule-based | Private to you</p></div><AcadiMark/></header>{data ? <><label className="academic-source-choice"><input type="checkbox" checked={data.nudgesEnabled} disabled={busy} onChange={event => run(() => service.planPreferences(event.target.checked))}/> Show rule-based study suggestions</label>{data.nudgesEnabled && !data.nudges.length && <p>No current suggestions.</p>}<ul className="study-plan-list">{data.nudges.map(nudge => <li key={nudge.key}><Lightbulb size={21} aria-hidden="true"/><div><Link to={nudge.studySetId ? nudge.origin === 'ai' ? `/learning/ai-study/${nudge.studySetId}` : `/study-sets/${nudge.studySetId}` : `/subjects/${nudge.subjectId}${nudge.moduleId ? '#module-'+nudge.moduleId : ''}`}>{nudge.title}</Link>{nudge.dueAt && <p>{new Date(nudge.dueAt).toLocaleString()}</p>}</div><button className="btn btn-ghost ac-icon-button" disabled={busy} onClick={() => run(() => service.dismissNudge(nudge.key,subjectId))}><ArrowRight size={16} aria-hidden="true"/><span className="sr-only">Dismiss suggestion</span></button></li>)}</ul><details className="ac-nudge-policy"><summary>How suggestions work</summary><p className="form-hint">Uses your entered dates, recorded module review status, and recent practice scores. No automatic emails or model calls. These are reminders, not mastery assessments.</p></details></> : <p>Suggestions appear after your private plan loads.</p>}</section>
    {editor && <PlanEditor item={editor.id ? editor : null} subjectId={subjectId} subjects={data.subjects} close={() => setEditor(null)} saved={load}/>}
  </div>;

}
