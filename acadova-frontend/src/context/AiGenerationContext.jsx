import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AiGenerationContext, useAiGeneration } from './aiGenerationAccess';
import service from '../services/aiStudyService';
import { isGenerationPage, isInlineAiError } from '../utils/aiGenerationFeedback';

const busyPhases = new Set(['uploading','processing','saving']);
const stages = { extracting:'Extracting content', preparing:'Preparing source material', generating:'Generating practice', validating:'Validating source evidence', ready:'Preview ready', saved:'Saved to My Study Sets', failed:'Generation failed', processing:'Processing request' };
export function AiGenerationProvider({ children }) {
  const { user } = useAuth(); const [job,setJob]=useState(null); const active=useRef(null); const request=useRef(null); const savePending=useRef(null);
  const owner=String(user?._id || user?.id || '');
  const credential=localStorage.getItem('acadova_token');
  useEffect(()=>()=>{active.current=null;savePending.current=null;request.current?.abort();},[owner,credential,user?.role]);
  const start=useCallback(async options=>{
    const token=localStorage.getItem('acadova_token');
    if(!owner||user?.role!=='student'||!token)throw new Error('Sign in as a Student before generating.');
    if(active.current||savePending.current)throw new Error('A study request is already running. Open its status panel.');
    const marker={owner,token};active.current=marker;const controller=new AbortController();request.current=controller;
    const current=()=>active.current===marker&&localStorage.getItem('acadova_token')===token;
    const update=values=>{if(current())setJob(previous=>({...previous,...values}));};
    setJob({owner,token,key:options.key,mode:options.source?'strict_source':options.mode,title:options.file?.name || options.source?.name || 'Study material',resumePath:options.resumePath,phase:options.file?'uploading':'processing',stage:'processing',progress:null,result:null,error:''});
    let polling=false;
    const poll=async()=>{if(polling||!current())return;polling=true;try{const response=await service.progress(options.key,{signal:controller.signal});update({phase:'processing',stage:response.data.stage,stageUnavailable:false});}catch(error){if(error.status!==404&&error.name!=='AbortError')update({stageUnavailable:true});}finally{polling=false;}};
    const timer=setInterval(poll,2000);
    try{
      const transport={syntheticOnly:options.syntheticOnly,signal:controller.signal,onUploadProgress:event=>update({progress:event,phase:event.lengthComputable&&event.loaded>=event.total?'processing':'uploading'})};
      const response=await (options.source ? service.generateResource(options.source,options.type,options.key,options.count,transport) : service.generate(options.file,options.type,options.key,options.mode,options.count,transport));
      if(!current())throw new DOMException('Account changed.','AbortError');
      update({phase:response.data.savedSet?'saved':'ready',stage:'ready',result:response.data,error:''});
      return response.data;
    }catch(error){
      const inline=isInlineAiError(error); const access=[401,403].includes(error.status);
      if(error.name!=='AbortError') { error.aiJobFailure=!inline&&!access; error.aiInputFailure=inline;
        update({phase:inline||access?'invalid':'failed',error:error.message,errorCode:error.code||error.data?.code,failureId:crypto.randomUUID(),failureDismissed:false}); }
      throw error;
    }
    finally{clearInterval(timer);if(active.current===marker){active.current=null;request.current=null;}}
  },[owner,user?.role]);
  const ownedJob=user?.role==='student'&&job?.owner===owner&&job?.token===localStorage.getItem('acadova_token')?job:null;
  const saving=previewId=>{const key=ownedJob?.result?.previewId===previewId?ownedJob.key:null;if(key){savePending.current=key;setJob(previous=>previous?.key===key?({...previous,phase:'saving',error:''}):previous);}return key;};
  const saved=(id,key)=>{if(key){if(savePending.current===key)savePending.current=null;setJob(previous=>previous?.key===key?({...previous,phase:'saved',result:{savedSet:{id}},error:''}):previous);}};
  const saveFailed=(error,key)=>{if(key){const inline=isInlineAiError(error);const access=[401,403].includes(error.status);error.aiJobFailure=!inline&&!access;error.aiPreviewFailure=inline;if(savePending.current===key)savePending.current=null;setJob(previous=>previous?.key===key?({...previous,phase:access?'invalid':'save_failed',error:error.message,errorCode:error.code||error.data?.code,inlineError:inline,failureId:crypto.randomUUID(),failureDismissed:inline}):previous);}};
  const acknowledgeFailure=id=>setJob(previous=>previous?.failureId===id?({...previous,failureDismissed:true}):previous);
  const showFailure=()=>setJob(previous=>previous?({...previous,failureDismissed:false}):previous);
  const clear=()=>{if(!active.current&&!savePending.current)setJob(null);};
  const discard=previewId=>{if(!active.current&&!savePending.current)setJob(previous=>previous?.result?.previewId===previewId?null:previous);};
  return <AiGenerationContext.Provider value={{job:ownedJob,start,saving,saved,saveFailed,clear,discard,acknowledgeFailure,showFailure}}>{children}</AiGenerationContext.Provider>;
}
export function AiGenerationTray() {
  const generation=useAiGeneration();const location=useLocation();const [expandedFor,setExpandedFor]=useState(null);const job=generation?.job;
  const failed=job?.phase==='failed'||job?.phase==='save_failed';
  const minimized=expandedFor!==job?.key;
  if(!job||job.phase==='invalid'||failed&&isGenerationPage(job,location))return null;
  const measurable=job.progress?.lengthComputable&&job.progress.total>0;
  const percent=measurable?Math.min(100,Math.floor(job.progress.loaded/job.progress.total*100)):null;
  const label=job.phase==='uploading'?'Uploading':job.phase==='saving'?'Saving results':job.phase==='ready'?'Preview ready — review before saving':job.phase==='saved'?'Saved to My Study Sets':job.phase==='save_failed'?'Save failed — preview retained':job.phase==='failed'?'Generation failed':(job.stage==='validating'&&job.mode!=='strict_source'?'Validating generated output':stages[job.stage])||'Processing request';
  return <aside className={`ai-generation-tray${minimized?' is-minimized':''}`} aria-label="AI generation status"><div className="ai-tray-heading"><div><strong title={job.title}>{job.title}</strong><p role="status" aria-live="polite">{label}{job.phase==='uploading'&&measurable?` · ${percent}%`:''}</p></div>{failed&&<Link className="btn btn-ghost" to={job.resumePath} onClick={generation.showFailure}>Details</Link>}{minimized&&!failed&&<Link className="btn btn-ghost" to={job.result?.savedSet?`/learning/ai-study/${job.result.savedSet.id}`:job.resumePath}>{job.phase==='ready'?'Review':'Open'}</Link>}<button className="btn btn-ghost" aria-label={minimized?'Expand generation status':'Minimize generation status'} aria-expanded={!minimized} onClick={()=>setExpandedFor(minimized?job.key:null)}>{minimized?'+':'−'}</button></div>{!minimized&&<>{job.phase==='uploading'&&<div>{measurable?<progress max={job.progress.total} value={job.progress.loaded} aria-label="Bytes uploaded"/>:<p>Sending document…</p>}</div>}{job.phase==='processing'&&<progress aria-label={label}/>}<p className="form-hint">{busyPhases.has(job.phase)?'You can browse Acadova. Keep this tab open; reloading may lose your unsaved preview.':job.phase==='ready'?'Review the private preview before its expiry.':''}{job.stageUnavailable?' Live stage unavailable; the original request is still tracked.':''}</p><div className="ai-actions"><Link className="btn btn-secondary" to={job.result?.savedSet?`/learning/ai-study/${job.result.savedSet.id}`:job.resumePath} onClick={failed?generation.showFailure:undefined}>{job.phase==='saved'?'Open saved set':job.phase==='ready'||job.phase==='save_failed'?'Review preview':failed?'View failure details':'Open study tools'}</Link>{['saved','failed'].includes(job.phase)&&<button className="btn btn-ghost" onClick={generation.clear}>Dismiss status</button>}</div></>}</aside>;
}
