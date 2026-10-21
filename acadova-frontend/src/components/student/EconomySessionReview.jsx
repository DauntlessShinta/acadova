import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/confirmAccess';
export default function EconomySessionReview({ session }) {
  const {user}=useAuth(),confirm=useConfirm();
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
  const free=session.economyVersion==='free-v1';const id=session._id||session.id;
  useEffect(()=>{if(!free&&user.role==='student')return;let active=true;api.get(`/api/growth/${free?'session-status':'legacy-reviews'}/${id}`).then(r=>{if(active){setData(r.data);setError('');}}).catch(failure=>{if(active)setError(failure.message);});return()=>{active=false;};},[id,free,retry,user.role]);
  const submit=async()=>{
    if(busy||!free&&data?.caseWritesAllowed!==true)return;
    const result=await confirm(free?'Describe your concern about this completed tutoring contribution. It will block EXP finalization for independent staff review.':'You are agreeing to close this historical obligation without a credit transfer. Your old balances, transactions and session facts remain preserved. Decline by closing this dialog; nothing will be forfeited automatically.',{title:free?'Report contribution':'Consent to no-transfer closure',label:free?'Submit concern':'I agree to this closure',...(free?{input:true,minLength:10,maxLength:500}:{})});
    if(!result)return;setBusy(true);
    try{await api.post(free?`/api/sessions/${id}/exp-report`:`/api/growth/legacy-reviews/${id}/consent`,free?{reason:result}:{agree:true,version:data.review.version});setRetry(n=>n+1);}catch(failure){setError(failure.message);}finally{setBusy(false);}
  };
  if(!free&&user.role==='student')return <section className="card" style={{padding:20}}><h2>Historical session - read only</h2><p>This older session and any unresolved claims are preserved. Contact staff for help with its review.</p><p>All new tutoring is free. This history does not affect your access to new tutoring.</p></section>;
  const actor=String(user._id||user.id),learner=String(session.learner?._id||session.learner?.id||session.learner);
  const agreed=data?.review?.[actor===learner?'learnerConsentAt':'tutorConsentAt'];
  return <section className="card" style={{padding:20}}><h2>{free?'Contribution review window':'Historical obligation review'}</h2>{error&&<p role="alert">{error} <button className="btn btn-secondary" onClick={()=>setRetry(n=>n+1)}>Retry review status</button></p>}{!data&&!error?<p role="status">Loading review status...</p>:free?<><p>Qualifying tutoring EXP stays pending for at least 48 hours. Confirmations and recorded duration are self-reported evidence, not provider attendance verification.</p>{data?.reportStatus?<p>Report status: {data.reportStatus}.</p>:data?.canReport?<button className="btn btn-secondary" disabled={busy} onClick={submit}>Report contribution concern</button>:<p>The 48-hour participant reporting window is closed.</p>}<Link className="btn btn-ghost" to="/growth">My Growth</Link></>:<><p>This historical case is retained under a settlement and disposition freeze. Its claims and records remain unchanged pending separately authorized review.</p><p>Historical session amount: {session.creditAmount} Credits. This is preserved history, not a new charge.</p>{data?.review?<><p>Staff proposal: {data.review.reason}</p><p>{data.review.state==='closed'?'Both participants explicitly closed this obligation without a transfer.':agreed?'Your consent is recorded. The other participant must also agree.':'Both participants must explicitly agree; you may leave this unresolved for staff review.'}</p>{data.caseWritesAllowed===true&&data.review.state==='proposed'&&!agreed&&<button className="btn btn-secondary" disabled={busy} onClick={submit}>Review and consent to closure</button>}</>:<p>No resolution proposal is recorded. Contact authorized staff for review.</p>}</>}</section>;
}
