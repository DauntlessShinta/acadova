import { useEffect, useRef, useState } from 'react';
import academic from '../../services/academicService';
import service from '../../services/collaborationService';
import Modal from '../common/Modal';
import { useConfirm } from '../../context/confirmAccess';
import { useUnsavedChanges } from '../../utils/useUnsavedChanges';
import { circleSchedule, deviceTimezone, localFields } from '../../utils/scheduling';
import { meetingBookmark } from '../../utils/meetingProviders';
import MeetingProviders from './MeetingProviders';

const durations = [30, 60, 90, 120];
const steps = ['Topic', 'Schedule', 'Meeting', 'Review'];
export default function CircleEditor({ circle, close, saved }) {
  const [draft, setDraft] = useState(() => {
    const timezone = circle?.timezone || deviceTimezone();
    return { title:circle?.title || '', description:circle?.description || '', tags:circle?.tags?.join(', ') || '', ...(circle ? localFields(circle.startsAt, timezone) : { date:'', time:'' }), durationMinutes:circle ? (Date.parse(circle.endsAt)-Date.parse(circle.startsAt))/60000 : 90, timezone, capacity:circle?.capacity || 12, meetingUrl:circle?.meetingUrl || '', subjectId:circle?.subjectId || '' };
  });
  const [original] = useState(() => JSON.stringify(draft));
  const dirty = original !== JSON.stringify(draft);
  useUnsavedChanges(dirty);
  const [clock, setClock] = useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const [step, setStep] = useState(0), [custom, setCustom] = useState(!durations.includes(draft.durationMinutes));
  const [changeLegacy, setChangeLegacy] = useState(false);
  const legacy = circle && ((Date.parse(circle.endsAt)-Date.parse(circle.startsAt))/60000 > 180 || (Date.parse(circle.endsAt)-Date.parse(circle.startsAt))/60000 < 30);
  const [provider, setProvider] = useState(() => meetingBookmark(circle?.meetingUrl)?.id || 'meet');
  const [subjects, setSubjects] = useState([]), [subjectError, setSubjectError] = useState(''), [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [fields, setFields] = useState({});
  const pending = useRef(false), errorNode = useRef(null), stepHeading = useRef(null), form = useRef(null);
  const confirm = useConfirm();
  useEffect(() => { let active=true; academic.state().then(r => { if(active){setSubjects(r.data.subjects);setSubjectError('');} }).catch(() => {if(active)setSubjectError('Subjects could not be loaded. Retry or continue without an association.');});return()=>{active=false;}; },[retry]);
  useEffect(() => { stepHeading.current?.focus(); },[step]);
  const update = (key, value) => { setDraft(d=>({...d,[key]:value}));setFields(f=>({...f,[key==='durationMinutes'?'duration':key]:''}));setError(''); };
  const showError = (failure, review = false) => {
    const field = failure.field;
    setError(failure.status>=500 ? 'We could not save your circle. Your details are still here; please try again.' : failure.message || 'We could not save your circle. Your details are still here; please try again.');
    setFields(field ? { [field]:failure.message } : {});
    requestAnimationFrame(()=>{const input=field && document.getElementById(field==='duration'?(custom?'circle-durationMinutes':'circle-duration'):'circle-'+field);(review ? errorNode.current : input || errorNode.current)?.focus();});
  };
  const requestClose = async () => { if(pending.current)return;if(dirty && !await confirm('Discard this unsaved circle draft?',{title:'Close circle editor?',label:'Discard draft'}))return;close(); };
  const today = localFields(clock, draft.timezone), nextMinute=localFields(clock+60000,draft.timezone), lastDay = localFields(clock+180*86400000, draft.timezone).date;
  let schedule;try{schedule=circleSchedule(draft,{existing:circle,validateFuture:false});}catch{/* Empty/incomplete form has no schedule preview. */}
  const fieldError = name => fields[name] && <span className="form-error" id={'circle-error-'+name}>{fields[name]}</span>;
  const field = (name,label,type='text',extra={}) => <label htmlFor={'circle-'+name}>{label}<input id={'circle-'+name} className="form-input" type={type} value={draft[name]} onChange={e=>update(name,e.target.value)} aria-invalid={Boolean(fields[name])} aria-describedby={fields[name]?'circle-error-'+name:undefined} {...extra}/>{fieldError(name)}</label>;
  const validate = part => {
    if (part === 0) {
      if (!draft.title.trim() || draft.title.trim().length>120) throw Object.assign(new Error('Enter a circle title of 1 to 120 characters.'),{field:'title'});
      const tags=draft.tags.split(',').map(t=>t.trim()).filter(Boolean);
      if(tags.length>5 || tags.some(t=>t.length>40))throw Object.assign(new Error('Use up to five topic tags, each no longer than 40 characters.'),{field:'tags'});
    }
    if(part === 1)return circleSchedule(draft,{existing:circle});
    if(part === 2){if(!Number.isInteger(Number(draft.capacity)) || Number(draft.capacity)<1 || Number(draft.capacity)>50)throw Object.assign(new Error('Choose 1 to 50 attendees, excluding you.'),{field:'capacity'});if(!meetingBookmark(draft.meetingUrl))throw Object.assign(new Error('Paste a supported Google Meet, Zoom or Teams HTTPS invitation link. Use a plain bookmark with only its meeting passcode.'),{field:'meetingUrl'});}
  };
  return <Modal isOpen title={circle?'Edit study circle':'Host a study circle'} className="circle-editor circle-editor-stepped" maxWidth="620px" onClose={requestClose}>
    <form ref={form} className="circle-form" data-unsaved={dirty} noValidate aria-busy={busy} onSubmit={async e=>{
      e.preventDefault();if(pending.current)return;
      try{
        if(step<3){validate(step);setFields({});setError('');setStep(s=>s+1);return;}
        validate(0);const current=validate(1);validate(2);
        const body={title:draft.title.trim(),description:draft.description,tags:draft.tags.split(',').map(t=>t.trim()).filter(Boolean),capacity:Number(draft.capacity),meetingUrl:meetingBookmark(draft.meetingUrl).href,subjectId:draft.subjectId || null,timezone:current.timezone,startsAt:current.startsAt,endsAt:current.endsAt};
        pending.current=true;setBusy(true);setError('');
        if(circle)await service.action(circle.id,'edit',{...body,version:circle.version});else await service.create(body);
        await saved();close();
      }catch(failure){showError(failure,step===3);}finally{pending.current=false;setBusy(false);}
    }}>
      <ol className="circle-progress" aria-label="Circle setup">{steps.map((label,index)=><li key={label} aria-current={step===index?'step':undefined}><span>{index+1}</span>{label}</li>)}</ol>
      <div className="circle-step-body"><fieldset disabled={busy}><legend className="sr-only">Circle details</legend><h2 ref={stepHeading} tabIndex={-1}>{step+1}. {['Basic details','Choose a schedule','Capacity and meeting','Review and confirm'][step]}</h2>
      {step===0 && <>
        {field('title','Circle title','text',{maxLength:120,required:true})}
        <label htmlFor="circle-subject">My subject (optional, private)<select id="circle-subject" className="form-select" value={draft.subjectId} onChange={e=>update('subjectId',e.target.value)}><option value="">No subject association</option>{circle?.subjectId && !subjects.some(s=>s.id===circle.subjectId) && <option value={circle.subjectId}>Previously associated subject</option>}{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        {subjectError && <p role="status">{subjectError} <button type="button" className="text-action" onClick={()=>setRetry(n=>n+1)}>Retry subjects</button></p>}
        {field('tags','Topic tags (optional, up to 5)','text',{maxLength:204})}
        <label htmlFor="circle-description">Description (optional)<textarea id="circle-description" className="form-textarea" maxLength={600} rows={2} value={draft.description} onChange={e=>update('description',e.target.value)}/></label>
      </>}
      {step===1 && <>
        {legacy && !changeLegacy ? <div className="circle-legacy-schedule"><p>This existing {Math.round(draft.durationMinutes)}-minute schedule is preserved. New or changed schedules must be 30 minutes to 3 hours.</p><p>{schedule?.startLabel} - {schedule?.endLabel} ({draft.timezone})</p><button className="btn btn-secondary" type="button" onClick={()=>{setChangeLegacy(true);setCustom(false);update('durationMinutes',90);}}>Change schedule</button></div> : <>
        {field('date','Date','date',{min:today.date,max:lastDay,required:true})}
        <div className="circle-schedule-fields">{field('time','Start time','time',{min:draft.date===today.date?(nextMinute.date===today.date?nextMinute.time:'23:59'):undefined,required:true,step:60})}
        <label htmlFor="circle-duration">Duration<select id="circle-duration" className="form-select" aria-invalid={Boolean(fields.duration)} aria-describedby={fields.duration?'circle-error-duration':undefined} value={custom?'custom':draft.durationMinutes} onChange={e=>{const value=e.target.value;setCustom(value==='custom');if(value!=='custom')update('durationMinutes',Number(value));}}>{durations.map(n=><option key={n} value={n}>{n} minutes</option>)}<option value="custom">Custom (30-180 minutes)</option></select>{custom && <input id="circle-durationMinutes" className="form-input" aria-label="Custom duration in minutes" type="number" min={30} max={180} step={1} value={draft.durationMinutes} onChange={e=>update('durationMinutes',e.target.value)} aria-invalid={Boolean(fields.duration)} aria-describedby={fields.duration?'circle-error-duration':undefined}/>} {fieldError('duration')}</label></div>
        <label htmlFor="circle-timezone">Timezone<select id="circle-timezone" className="form-select" value={draft.timezone} onChange={e=>update('timezone',e.target.value)}>{[...new Set([draft.timezone,deviceTimezone(),...(Intl.supportedValuesOf?.('timeZone') || [])])].map(zone=><option key={zone}>{zone}</option>)}</select>{fieldError('timezone')}</label>
        <p className="form-hint">Only future starts, within 180 days. Duration is elapsed time; the finish adjusts for clock changes.</p>
        {schedule && <p className="circle-schedule-preview" role="status">Ends {schedule.endLabel} ({draft.timezone})</p>}
        </>}
      </>}
      {step===2 && <>
        {field('capacity','Attendee capacity (excludes you)','number',{min:1,max:50,step:1,required:true})}
        <MeetingProviders selected={provider} onSelect={setProvider}/>
        {field('meetingUrl','Meeting invitation link','url',{maxLength:500,placeholder:'Paste the invitation link here',required:true})}
        <p className="form-hint">Only the host and eligible enrolled students can retrieve the saved bookmark.</p>
      </>}
      {step===3 && <section className="circle-review"><h3>{draft.title}</h3><dl><dt>Topics</dt><dd>{draft.tags || 'None entered'}</dd><dt>Starts</dt><dd>{schedule && <time dateTime={schedule.startsAt}>{schedule.startLabel}</time>}</dd><dt>Finishes</dt><dd>{schedule && <time dateTime={schedule.endsAt}>{schedule.endLabel}</time>}</dd><dt>Timezone</dt><dd>{draft.timezone}</dd><dt>Duration</dt><dd>{draft.durationMinutes} minutes</dd><dt>Capacity</dt><dd>{draft.capacity} attendees, excluding you</dd><dt>Meeting</dt><dd>{meetingBookmark(draft.meetingUrl)?.label || 'Check the meeting link'}</dd><dt>Private subject</dt><dd>{subjects.find(s=>s.id===draft.subjectId)?.name || (draft.subjectId?'Previously associated subject':'None')}</dd></dl><p className="form-hint">Free Study Circle. No credits or attendance verification.</p></section>}
      </fieldset></div>
      {error && <div className="circle-error-summary" ref={errorNode} tabIndex={-1} role="alert"><p>{error}</p>{step===3 && <button type="button" className="text-action" onClick={()=>{setStep(fields.meetingUrl||fields.capacity?2:fields.title||fields.tags?0:1);}}>Review these details</button>}</div>}
      <div className="circle-form-actions">{step>0 && <button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>{setStep(s=>s-1);setError('');setFields({});}}>{step===3?'Back to edit':'Back'}</button>}<button type="button" className="btn btn-ghost" disabled={busy} onClick={requestClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy?'Saving circle...':step===3?'Confirm & save circle':step===2?'Review circle':'Next'}</button></div>
    </form>
  </Modal>;
}
