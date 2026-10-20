import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { localAcadiReply, localStudyContext } from '../../utils/acadiLocal';

const greeting=()=>[{role:'assistant',message:'I am your local study guide. I can help you find learning pages or suggest a simple study session. This local mode does not call Gemini. Check Gemini study chat for its separate availability.',facts:[],links:[]}];
export default function AcadiLocalGuide({ onNavigate }) {
  const {freeLearning}=useAuth();
  const [messages,setMessages]=useState(greeting), [input,setInput]=useState(''), [context,setContext]=useState(null), [status,setStatus]=useState('off');
  const request=useRef(null), pending=useRef(false), epoch=useRef(0), history=useRef(null);
  useEffect(()=>()=>{epoch.current++;request.current?.abort();},[]);
  useEffect(()=>{history.current?.scrollTo({top:history.current.scrollHeight,behavior:'instant'});},[messages]);
  const clear=()=>{epoch.current++;request.current?.abort();pending.current=false;setContext(null);setStatus('off');setMessages(greeting());setInput('');};
  const load=async()=>{
    if(pending.current)return;pending.current=true;
    request.current?.abort();const ticket=++epoch.current, abort=new AbortController();request.current=abort;setStatus('loading');
    try {const [state,plans]=await Promise.all([api.get('/api/academic/state',{signal:abort.signal}),api.get('/api/academic/plans',{signal:abort.signal})]);if(ticket!==epoch.current)return;setContext(localStudyContext(state.data,plans.data));setStatus('ready');}
    catch {if(ticket===epoch.current){abort.abort();setContext(null);setStatus('error');}}finally{if(ticket===epoch.current)pending.current=false;}
  };
  const send=value=>{const clean=value.trim().slice(0,320);if(!clean)return;setMessages(rows=>[...rows,{role:'user',message:clean}, {role:'assistant',...localAcadiReply(clean,context,Date.now(),{freeLearning})}].slice(-12));setInput('');};
  return <section className="acadi-local-guide" aria-label="Local study guide">
    <div className="acadi-context-status"><ShieldCheck size={17} aria-hidden="true"/><span>{status==='ready'?'Saved context: local only':'No external AI processing'}</span><button type="button" className="btn btn-ghost" onClick={clear}><Trash2 size={15} aria-hidden="true"/>Clear chat &amp; context</button></div>
    <details className="acadi-context-permission"><summary>Privacy and optional saved context</summary><p>Only on opt-in, this retrieves your authorized workspace. Local suggestions keep subject/module names and status, plus entered plan titles and dates; notes, grades and source documents are not used. Nothing goes to an AI provider. Close, clear or switch accounts to discard. This is not external-processing consent.</p>{status==='ready'?<button type="button" className="btn btn-secondary" onClick={clear}>Stop using saved context</button>:<button type="button" className="btn btn-secondary" disabled={status==='loading'} onClick={load}>{status==='loading'?'Loading saved context...':status==='error'?'Retry local context':'Use my saved context locally'}</button>}</details>
    {status==='loading' && <p role="status">Loading your saved workspace and entered plans...</p>}{status==='error' && <p className="form-error" role="alert">Saved context could not be loaded. Check your connection and retry, or continue with navigation help.</p>}
    <div ref={history} className="acadi-conversation" role="log" aria-label="Local conversation" aria-live="polite" aria-relevant="additions text">{messages.map((row,index)=><article key={index} className={`acadi-message is-${row.role}`}><strong>{row.role==='user'?'You':'Acadi / Local guidance'}</strong><p>{row.message}</p>{row.suggestion && <div className="acadi-suggestion"><strong>Suggestion</strong><p>{row.suggestion}</p></div>}{row.facts?.length>0 && <div className="acadi-facts"><strong>Saved facts used</strong><ul>{row.facts.map((fact,i)=><li key={i}><span>{fact.label}: </span><Link to={fact.to} onClick={onNavigate}>{fact.value}</Link></li>)}</ul></div>}{row.links?.length>0 && <div className="acadi-response-links">{row.links.map(link=><Link key={link.to} to={link.to} onClick={onNavigate}>{link.label}</Link>)}</div>}</article>)}</div>
    <div className="acadi-prompt-choices" aria-label="Suggested local prompts">{['What should I study tonight?','When is my next exam?','Find my study sets','Help with Study Together'].map(prompt=><button type="button" key={prompt} onClick={()=>send(prompt)}>{prompt}</button>)}</div>
    <form className="acadi-composer" onSubmit={event=>{event.preventDefault();send(input);}}><label className="sr-only" htmlFor="acadi-message">Ask for local navigation or study-plan guidance</label><textarea id="acadi-message" rows={2} maxLength={320} value={input} placeholder="Ask for local study guidance..." onChange={event=>setInput(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send(input);}}}/><button type="submit" aria-label="Send local message" disabled={!input.trim()}><Send size={19} aria-hidden="true"/></button></form>
    <p className="acadi-retention-note">Fixed local rules / up to 12 messages / cleared when closed. No school dates, scores or mastery are inferred.</p>
  </section>;
}
