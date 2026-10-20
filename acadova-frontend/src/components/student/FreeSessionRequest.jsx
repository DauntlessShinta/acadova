import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../common/Modal';
import { useConfirm } from '../../context/confirmAccess';
import { useUnsavedChanges } from '../../utils/useUnsavedChanges';
import { deviceTimezone, minimumLocalDateTime, scheduleLabel } from '../../utils/scheduling';
import { toSessionInstant } from '../../utils/sessionPresentation';
import { sessionRequestTimeError } from '../../utils/sessionRequestTime';
import service from '../../services/sessionService';
import { AvailabilityGuidance } from './WeeklyAvailability';

export default function FreeSessionRequest({ tutor, close }) {
  const [draft,setDraft]=useState({subject:tutor.skillsToTeach?.[0]||'',scheduledAt:'',requestMessage:''});
  const [step,setStep]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(null);
  const [clock,setClock]=useState(Date.now);
  const pending=useRef(false),heading=useRef(null),alert=useRef(null);
  const confirm=useConfirm();
  const dirty=!saved&&Boolean(draft.scheduledAt||draft.requestMessage);
  useUnsavedChanges(dirty);
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),30000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{heading.current?.focus();},[step]);
  const update=(key,value)=>{setDraft(current=>({...current,[key]:value}));setError('');};
  const requestClose=async()=>{if(pending.current)return;if(dirty&&!await confirm('Discard this unsent request?',{title:'Close request?',label:'Discard request'}))return;close();};
  const validate=part=>{
    if(part===0&&(!tutor.skillsToTeach?.includes(draft.subject)||draft.requestMessage.trim().length>500))throw new Error('Choose a subject this tutor offers and keep your message within 500 characters.');
    if(part===1){const error=sessionRequestTimeError(draft.scheduledAt);if(error)throw new Error(error);}
  };
  let review;try{review=scheduleLabel(toSessionInstant(draft.scheduledAt),deviceTimezone());}catch{/* Incomplete schedule. */}
  return <Modal isOpen onClose={requestClose} title={`Request Session with ${tutor.name}`} className="free-session-dialog" maxWidth="620px">
    {saved?<section className="session-request-success" role="status"><h2>Request sent</h2><p>Status: {saved.status==='pending'?'Pending tutor response':saved.status}. Your suggested time is not a confirmed booking.</p><Link className="btn btn-primary" to="/sessions">My Sessions</Link><Link className="btn btn-secondary" to={`/sessions/${saved._id||saved.id}`}>View request</Link></section>:<form data-unsaved={dirty} noValidate aria-busy={busy} onSubmit={async event=>{
      event.preventDefault();if(pending.current)return;
      try{
        validate(0);if(step>0)validate(1);
        if(step<2){setStep(value=>value+1);return;}
        pending.current=true;setBusy(true);setError('');
        const result=await service.createSession({tutorId:tutor._id||tutor.id,...draft,meetingMethod:'online',requestMessage:draft.requestMessage.trim()});
        setSaved(result.data);
      }catch(failure){setError(failure.message||'Your request could not be sent. Your details are retained.');requestAnimationFrame(()=>alert.current?.focus());}
      finally{pending.current=false;setBusy(false);}
    }}>
      <ol className="circle-progress" aria-label="Session request steps">{['Topic','Schedule','Review'].map((label,index)=><li key={label} aria-current={step===index?'step':undefined}><span>{index+1}</span>{label}</li>)}</ol>
      <div className="free-session-step"><h2 tabIndex={-1} ref={heading}>{['Choose your topic','Suggest a schedule','Review and send'][step]}</h2>
        {step===0&&<><label htmlFor="free-subject">Subject / topic<select id="free-subject" className="form-select" value={draft.subject} disabled={busy} onChange={event=>update('subject',event.target.value)}>{tutor.skillsToTeach?.map(skill=><option key={skill}>{skill}</option>)}</select></label><label htmlFor="free-message">What do you need help with? (optional)<textarea id="free-message" className="form-textarea" rows={3} maxLength={500} value={draft.requestMessage} onChange={event=>update('requestMessage',event.target.value)}/></label><p className="form-hint">Teaching subjects are self-declared. Tutoring is free.</p></>}
        {step===1&&<><label htmlFor="free-schedule">Preferred date and start time<input id="free-schedule" className="form-input" type="datetime-local" value={draft.scheduledAt} min={minimumLocalDateTime(clock)} onChange={event=>update('scheduledAt',event.target.value)}/></label><p className="form-hint">Your timezone: {deviceTimezone()}. This is a request; the tutor must accept or propose a different time.</p><AvailabilityGuidance availability={tutor.weeklyAvailability}/></>}
        {step===2&&<dl className="free-session-review"><dt>Tutor</dt><dd>{tutor.name}</dd><dt>Topic</dt><dd>{draft.subject}</dd><dt>Suggested schedule</dt><dd><time dateTime={toSessionInstant(draft.scheduledAt)}>{review}</time> ({deviceTimezone()})</dd><dt>Your message</dt><dd>{draft.requestMessage||'No message entered.'}</dd><dt>Cost</dt><dd>Free peer tutoring. No balance, payment or EXP required.</dd></dl>}
        {error&&<p className="form-error" role="alert" ref={alert} tabIndex={-1}>{error}</p>}
      </div><div className="circle-form-actions">{step>0&&<button className="btn btn-secondary" type="button" disabled={busy} onClick={()=>{setStep(value=>value-1);setError('');}}>Back</button>}<button className="btn btn-ghost" type="button" disabled={busy} onClick={requestClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy?'Sending...':step===2?'Send request':'Next'}</button></div>
    </form>}
  </Modal>;
}
