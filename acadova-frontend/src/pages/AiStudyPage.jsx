import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { FileText, LockKeyhole, Sparkles, Upload } from 'lucide-react';
import service from '../services/aiStudyService';
import academicService from '../services/academicService';
import LearningNavigation from '../components/learning/LearningNavigation';
import AiStudyPractice from '../components/learning/AiStudyPractice';
import StrictStudyPreview from '../components/learning/StrictStudyPreview';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Modal from '../components/common/Modal';
import { failureRecovery, isGenerationPage } from '../utils/aiGenerationFeedback';
import { useConfirm } from '../context/confirmAccess';
import { useUnsavedChanges } from '../utils/useUnsavedChanges';
import { useAiGeneration } from '../context/aiGenerationAccess';
import './aiStudy.css';

export default function AiStudyPage() {
  const { id } = useParams(); const [params] = useSearchParams(); const mine = params.get('view') === 'mine';
  const navigate = useNavigate(); const confirm = useConfirm(); const location=useLocation(); const generation=useAiGeneration(); const restoredJob=useRef(null);
  const generationBusy=['uploading','processing','saving'].includes(generation.job?.phase);
  const routeKey = `${id || ''}:${mine}:${params.toString()}`;
  const subjectId = params.get('subjectId'); const moduleId = params.get('moduleId');
  const [selectedResourceId, setSelectedResourceId] = useState(params.get('resourceId') || ''); const [sourceMeta, setSourceMeta] = useState(null);
  const [mode, setMode] = useState('strict_source'); const [count, setCount] = useState(5); const [editedContent, setEditedContent] = useState(null);
  const [context, setContext] = useState(null);
  const [loadedRoute, setLoadedRoute] = useState('');
  const [status, setStatus] = useState(null); const [rows, setRows] = useState([]); const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [working, setWorking] = useState(false); const [reload, setReload] = useState(0);
  const [file, setFile] = useState(null); const [type, setType] = useState(params.get('format') || 'both'); const [consent, setConsent] = useState(false);
  const [fileError, setFileError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [preview, setPreview] = useState(null); const [title, setTitle] = useState(''); const [rename, setRename] = useState(false);
  const requestKey = useRef(null); const pending = useRef(false); const revision = useRef(0); const previewHeading = useRef(null);
  useUnsavedChanges(Boolean(preview) || rename && title !== item?.title);
  useEffect(() => {
    let active = true; const version = ++revision.current;
    Promise.resolve().then(async () => {
      if (!active) return; restoredJob.current=null; setLoading(true); setError(''); setItem(null); setRename(false); setContext(null); setType(params.get('format') || 'both'); setSelectedResourceId(params.get('resourceId') || ''); setPreview(null); setEditedContent(null); setConsent(false); requestKey.current = null;
      try {
        if (id) { const response = await service.get(id); if (active) { setItem(response.data); setTitle(response.data.title); setRename(params.get('rename') === '1'); setPreview(null); } }
        else if (mine) { const response = await service.mine(); if (active) setRows(response.data); }
        else {
          const response = await service.status(); if (active) setStatus(response.data);
          if (subjectId) {
            const workspace = (await academicService.subject(subjectId)).data;
            const module = moduleId ? workspace.modules.find(row => row.id === moduleId) : null;
            if (moduleId && !module) throw new Error('This module is unavailable in this subject. Open it again from My Subjects.');
            if (active) setContext({ subject: workspace.subject, module, resources: workspace.resources.filter(row => ['pdf', 'pptx'].includes(row.kind) && (!moduleId || !row.moduleId || row.moduleId === moduleId)) });
          } else if (moduleId) throw new Error('Open module generation from its subject workspace.');
        }
      } catch (failure) { if (active) setError(failure.message); }
      finally { if (active) { setLoadedRoute(routeKey); setLoading(false); } }
    }); return () => { active = false; revision.current = version + 1; };
  }, [id, mine, reload, routeKey, params, subjectId, moduleId]);
  useEffect(() => {
    let active = true;
    Promise.resolve().then(async () => {
      if (!active) return; setSourceMeta(null);
      if (!selectedResourceId || id || mine) return;
      try { const source = (await service.source(selectedResourceId)).data; if (subjectId && source.subjectId !== subjectId || moduleId && source.moduleId && source.moduleId !== moduleId) throw new Error('Source belongs to another subject/module. Select a matching source.'); if (active) setSourceMeta(source); }
      catch (failure) { if (active) setError(failure.message); }
    }); return () => { active = false; };
  }, [selectedResourceId, subjectId, moduleId, id, mine]);
  useEffect(() => { if (preview && !document.querySelector('[role="dialog"]')) previewHeading.current?.focus(); }, [preview]);
  useEffect(()=>{
    const job=generation.job;
    if(id||mine||loading||loadedRoute!==routeKey||!['ready','save_failed'].includes(job?.phase)||!job?.result?.previewId||job.resumePath!==location.pathname+location.search||restoredJob.current===job.key)return;
    restoredJob.current=job.key;setPreview(job.result);setTitle(job.result.title);setEditedContent(null);setPreviewError(job.inlineError?job.error:'');
  },[generation.job,loadedRoute,loading,routeKey,id,mine,location.pathname,location.search]);

  const run = async action => {
    if (pending.current) return; pending.current = true; setWorking(true); setError(''); const version = revision.current;
    try { await action(version); }
    catch (failure) { if (version === revision.current) { if (failure.aiInputFailure) setFileError(failure.message); else if(failure.aiPreviewFailure) setPreviewError(failure.message); else if (!failure.aiJobFailure) setError(failure.message || 'This study action failed. Retry later.'); } }
    finally { pending.current = false; setWorking(false); }
  };
  const changeFile = selected => {
    setFileError(''); setError(''); setPreview(null); requestKey.current = null;
    if (!selected) { setFile(null); return; }
    if (!/\.(pdf|pptx)$/i.test(selected.name) || selected.size === 0 || selected.size > (status?.maxBytes || 5242880)) { setFile(null); setFileError('Choose a nonempty PDF or PPTX, up to 5 MB.'); return; }
    setFile(selected); setConsent(false); setSelectedResourceId(''); setEditedContent(null);
  };
  const generate = event => { event?.preventDefault(); if ((!file && !sourceMeta) || selectedResourceId && !sourceMeta || !consent || !status?.enabled || (subjectId || moduleId) && !context) return;
    setFileError('');
    requestKey.current ||= crypto.randomUUID();
    run(async version => {
      try {
        const data = await generation.start({file:selectedResourceId?null:file,source:selectedResourceId?sourceMeta:null,type,key:requestKey.current,mode,count,syntheticOnly:status?.syntheticOnly!==false,resumePath:location.pathname+location.search});
        if (version !== revision.current) return;
        if (data.savedSet) { navigate(`/learning/ai-study/${data.savedSet.id}`); return; }
        setPreview(data); setTitle(data.title); setEditedContent(null);
      } finally {
        const latest = await service.status().catch(() => null); if (latest && version === revision.current) setStatus(latest.data);
      }
    });
  };
  const save = event => { event?.preventDefault(); if (!title.trim() || !preview) return; run(async version => {
    setPreviewError('');
    if ((subjectId || moduleId) && !context) throw new Error('Reload the subject association before saving.');
    const jobKey=generation.saving(preview.previewId);
    try {
      const data = (await service.save(preview.previewId, title, { ...(context ? { subjectId: context.subject.id, moduleId: context.module?.id || null } : {}), ...(editedContent ? { content: editedContent } : {}) })).data;
      generation.saved(data.id,jobKey);
      if (version === revision.current) { setPreview(null); navigate(`/learning/ai-study/${data.id}`); }
    } catch(failure) { generation.saveFailed(failure,jobKey);throw failure; }
  }); };
  const remove = async (selected = item) => {
    if (!await confirm('Delete this private AI study set and its practice history?', { title: 'Delete AI study set', label: 'Delete set' })) return;
    run(async version => { await service.remove(selected.id, selected.version); if (version === revision.current) { if (mine) setRows(current => current.filter(row => row.id !== selected.id)); else navigate('/learning/ai-study?view=mine'); } });
  };
  const renameSet = event => { event.preventDefault(); run(async version => { const data = (await service.rename(id, title, item.version)).data; if (version === revision.current) { setItem(data); setRename(false); } }); };
  const activeItem = id ? item : preview;
  const failedJob = isGenerationPage(generation.job, location) && !generation.job?.inlineError && ['failed','save_failed'].includes(generation.job?.phase) ? generation.job : null;
  const closeFailure = () => generation.acknowledgeFailure(failedJob?.failureId);
  return <div className="ai-study-page">
    <Modal isOpen={Boolean(failedJob && !failedJob.failureDismissed)} title={failedJob?.phase === 'save_failed' ? "Couldn't save your study set" : "Couldn't generate your study set"} onClose={closeFailure} className="ai-failure-dialog">
      <p className="ai-filename"><strong>{failedJob?.title}</strong></p><p>{failedJob?.error}</p>
      <p>{failedJob?.phase === 'save_failed' ? 'Your preview is retained. Check your edits and source evidence before saving again.' : 'No study set was saved.'}</p><p>{failureRecovery(failedJob?.errorCode)}</p>
      {!file && !sourceMeta && failedJob?.phase !== 'save_failed' && <p>Reselect a document to try again. Unsaved file bytes are not retained after leaving this page.</p>}
      <div className="ai-actions"><button className="btn btn-primary" disabled={working || failedJob?.phase !== 'save_failed' && (!file && !sourceMeta || !consent)} onClick={() => { closeFailure(); requestKey.current = null; if (failedJob?.phase === 'save_failed') save(); else generate(); }}>Try Again</button><button className="btn btn-secondary" disabled={working} onClick={() => { closeFailure(); setSelectedResourceId(''); document.getElementById('ai-document')?.click(); }}>Choose Another File</button><button className="btn btn-ghost" onClick={closeFailure}>Close</button></div>
    </Modal>
    <header className="learning-page-header"><div><span className="student-eyebrow">Private learning practice</span><h1>{id ? item?.title || 'AI study set' : mine ? 'My AI Study Sets' : 'AI Study Tools'}</h1><p>Turn authorized learning material into flashcards and practice questions. Review every answer against your source.</p></div><span className="ai-private-label"><LockKeyhole size={16} aria-hidden="true" /> Private · Zero credits</span></header><p className="form-hint">Sharing is unavailable for AI-generated sets, including strict-source quotations and source pins. They stay private until source permission and a safe publication contract are implemented.</p>
    <LearningNavigation disabled={working&&!generationBusy} />
    {context && <section className="card"><p>Saving to <strong>{context.subject.name}{context.module ? ` / ${context.module.title}` : ''}</strong>. Your source and module links are preserved.</p><Link to={`/subjects/${context.subject.id}`}>Return to subject workspace</Link></section>}
    {item?.subjectId && <Link to={`/subjects/${item.subjectId}`}>Return to linked subject</Link>}
    <nav className="ai-subnav" aria-label="AI study views"><Link to="/learning/ai-study" aria-current={!id && !mine ? 'page' : undefined}>Create</Link><Link to="/learning/ai-study?view=mine" aria-current={mine ? 'page' : undefined}>My Study Sets</Link></nav><p className="form-hint">AI-generated practice · <Link to="/study-sets">Browse other study sets</Link></p>
    {error && <div><Alert type="danger" message={error} />{!working && <button className="btn btn-secondary" onClick={() => setReload(value => value + 1)}>Retry loading</button>}</div>}
    {loading || loadedRoute !== routeKey ? <LoadingSpinner text="Loading private study tools..." /> : mine ? <>
      <p className="form-hint">Only you can open these sets. Generation can be disabled while your saved material stays available.</p>
      {!rows.length && !error && <section className="card ai-empty"><FileText size={32} aria-hidden="true" /><h2>No saved AI study sets yet</h2><p>Generate material, review the preview, then save a private set to study later.</p><Link className="btn btn-primary" to="/learning/ai-study">Generate your first set</Link></section>}
      <div className="study-set-grid">{rows.map(row => <article className="card ai-saved-card" key={row.id}><span className="ai-private-label">AI-generated · Private</span><h2>{row.title}</h2><p>{row.ai.sourceName}</p><p>{row.flashcards.length} cards · {row.questions.length} questions</p><p className="form-hint">Created {new Date(row.createdAt).toLocaleDateString()}</p><div className="ai-actions"><Link className="btn btn-secondary" to={`/learning/ai-study/${row.id}`}>Open / Practice</Link><Link className="btn btn-secondary" to={`/learning/ai-study/${row.id}?rename=1`}>Rename</Link><button className="btn btn-secondary" disabled={working} onClick={() => remove(row)}>Delete</button></div></article>)}</div>
    </> : <>
      {!id && <div className="ai-create-grid"><form className="card ai-upload-form" onSubmit={generate} aria-busy={working}>
        <h2><Sparkles size={22} aria-hidden="true" /> Create practice material</h2>
        <fieldset disabled={working||generationBusy}><legend className="ai-step-label">1. Choose authorized learning material</legend>
          {context?.resources?.length > 0 && <label className="form-label" htmlFor="ai-stored-source">Use an owned stored source<select id="ai-stored-source" className="form-select" value={selectedResourceId} onChange={event => { setSelectedResourceId(event.target.value); setFile(null); setConsent(false); setPreview(null); setEditedContent(null); requestKey.current = null; if (event.target.value) setMode('strict_source'); }}><option value="">Upload another authorized document</option>{context.resources.map(row => <option key={row.id} value={row.id}>{row.title} · {row.kind.toUpperCase()}</option>)}</select></label>}
          {sourceMeta && <p className="ai-filename">Stored source: <strong>{sourceMeta.name}</strong> · Private. Confirm permission before sending this file to Gemini.</p>}
          <label className="form-label" htmlFor="ai-source-mode">Generation mode<select id="ai-source-mode" className="form-select" value={selectedResourceId ? 'strict_source' : mode} disabled={Boolean(selectedResourceId)} onChange={event => { setMode(event.target.value); setPreview(null); requestKey.current = null; }}><option value="strict_source">Strict Source - exact quotation completion</option><option value="standard">Standard - source-based practice</option></select></label>
          <p className="form-hint">Strict Source uses extracted text only. Answers and evidence must match source wording; unsupported items are refused. This is not a guarantee of conceptual accuracy.</p>
          <div className="ai-dropzone" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!working) { if (event.dataTransfer.files.length !== 1) setFileError('Upload one document at a time.'); else changeFile(event.dataTransfer.files[0]); } }}>
            <Upload size={28} aria-hidden="true" /><label htmlFor="ai-document">Drop a PDF or PPTX here, or choose a file</label><input id="ai-document" type="file" accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={event => changeFile(event.target.files[0])} aria-describedby={`ai-upload-guidance${fileError ? ' ai-file-error' : ''}`} aria-invalid={Boolean(fileError) || undefined} />
          </div><p id="ai-upload-guidance" className="form-hint">Up to {Math.round((status?.maxBytes || 5242880) / 1048576)} MB · {status?.maxPages || 20} PDF pages / {status?.maxSlides || 30} slides. Text-based documents only.</p>
          {fileError && <p id="ai-file-error" className="ai-input-error" role="alert">{fileError}</p>}{file && <p className="ai-filename">Selected: <strong>{file.name}</strong> ({Math.ceil(file.size / 1024)} KB)</p>}
          <label className="form-label" htmlFor="ai-generation-type">2. Choose your study format</label><select id="ai-generation-type" className="form-select" value={type} onChange={event => { setType(event.target.value); setCount(value => Math.min(value, event.target.value === 'flashcards' ? 10 : 5)); requestKey.current = null; setPreview(null); }}><option value="both">Flashcards + Practice Quiz</option><option value="flashcards">Flashcards</option><option value="quiz">Practice Quiz</option></select>
          <label className="form-label" htmlFor="ai-item-count">Requested items per selected format<input id="ai-item-count" type="number" className="form-input" min={1} max={type === 'flashcards' ? status?.maxCards || 10 : status?.maxQuestions || 5} value={count} onChange={event => { setCount(Number(event.target.value)); setPreview(null); requestKey.current = null; }} required /></label>
          <p className="form-hint">Up to {status?.maxCards || 10} flashcards and {status?.maxQuestions || 5} questions, based on the material available.</p>
          <label className="ai-consent"><input id="ai-synthetic-consent" type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>{status?.syntheticOnly!==false ? 'This document is synthetic, non-sensitive QA material.' : 'I have permission to submit this learning material. It contains no personal, confidential or restricted student information.'} I consent to Google Gemini processing its contents to generate private study material.</span></label>
          <button className="btn btn-primary" disabled={(!file && !sourceMeta) || Boolean(selectedResourceId && !sourceMeta) || !consent || !status?.enabled || working || Boolean((subjectId || moduleId) && !context)}>{working ? 'Generating study material...' : 'Generate study material'}</button>
          {generationBusy && <p>You can browse Acadova while this request runs. Keep this tab open to retain the unsaved preview.</p>}
        </fieldset>
        {status && <p className="form-hint">{status.message} {status.enabled && `${status.remaining} of ${status.dailyLimit} generation requests remaining today. Quota resets at 00:00 UTC.`}</p>}
        {failedJob?.failureDismissed && <button className="btn btn-ghost" type="button" onClick={generation.showFailure}>View last failure details</button>}
      </form><aside className="card ai-privacy" aria-labelledby="ai-privacy-heading"><span className="ai-private-label"><LockKeyhole size={18} aria-hidden="true" /> Private source-based practice</span><h2 id="ai-privacy-heading">Share only what you are allowed to share</h2><p>With your consent, the selected document contents are sent to Google Gemini. Strict Source sends extracted text only; standard mode may send PDF bytes. Unpaid API content and responses may be used to improve Google products and may be reviewed by people. Free-tier processing does not have paid-service data-use protections.</p><p>New AI uploads are processed in memory. A selected academic resource remains in your private resource storage. Strict previews keep bounded extracted text privately for revalidation until their 30-minute expiry. Saved sets retain only study content, source quotations and minimal provenance. Provider processing and retention follow Google’s terms; deleting a set does not promise deletion from provider systems.</p><p>Use learning materials you own or have permission to submit. Exclude names, grades, personal details, confidential content and institutional material without authorization.</p><p>PPTX uses slide text only. Images, diagrams, charts, and notes are omitted. AI answers can be wrong; check every item.</p><a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Read Google Gemini API terms</a></aside></div>}
      {activeItem && <section className="ai-study-content">
        {previewError && <p className="ai-input-error" role="alert">{previewError}</p>}<header className="ai-content-header"><span className="ai-private-label">AI-generated · Subject to errors</span><h2 ref={previewHeading} tabIndex={-1}>{id ? 'Study your saved material' : 'Review your generated preview'}</h2><p>{activeItem.ai.sourceName} · {activeItem.ai.sourceUnits} {activeItem.ai.sourceFormat === 'pptx' ? 'slides' : 'pages'}</p><p className="form-hint">{activeItem.ai.limitation}</p>{activeItem.ai.generationMode === 'strict_source' && <><p>{editedContent ? 'Edited · awaiting source revalidation' : 'Source text matched · quotation-completion practice'}</p><p className="form-hint">{activeItem.ai.validationNote}</p><p role="status">{activeItem.ai.coverage}</p>{activeItem.ai.rejectionReasons?.length > 0 && <details><summary>Why fewer items were produced</summary><ul>{activeItem.ai.rejectionReasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul></details>}</>}</header>
        {!id ? <form className="card ai-actions ai-save-form" onSubmit={save}><div><label htmlFor="ai-set-title" className="form-label">Study set title</label><input id="ai-set-title" className="form-input" value={title} maxLength={120} onChange={event => setTitle(event.target.value)} disabled={working} required /><p className="form-hint">Review cards and answers below before saving. Preview expires in 30 minutes.</p></div><button className="btn btn-primary" disabled={working || !title.trim()}>Save to My Study Sets</button></form> : <div className="card">
          {rename ? <form className="ai-actions ai-save-form" onSubmit={renameSet}><div><label htmlFor="ai-rename-title" className="form-label">New title</label><input id="ai-rename-title" className="form-input" value={title} maxLength={120} disabled={working} onChange={event => setTitle(event.target.value)} required /></div><button className="btn btn-primary" disabled={working || !title.trim()}>Save title</button><button className="btn btn-secondary" type="button" disabled={working} onClick={() => { setTitle(item.title); setRename(false); }}>Cancel rename</button></form> : <div className="ai-actions"><button className="btn btn-secondary" disabled={working} onClick={() => setRename(true)}>Rename set</button><button className="btn btn-secondary" disabled={working} onClick={() => remove()}>Delete set</button></div>}
          <p className="form-hint">Private practice history keeps your latest 20 quiz results. {item.practiceHistory?.length > 0 && `Latest score: ${item.practiceHistory.at(-1).score}%.`}</p>
        </div>}
        {!id ? <><StrictStudyPreview strict={preview.ai.generationMode === 'strict_source'} content={editedContent || { flashcards: preview.flashcards, questions: preview.questions }} onChange={setEditedContent} disabled={working} edited={Boolean(editedContent)} format={preview.ai.sourceFormat} /><button className="btn btn-secondary" disabled={working} onClick={() => { generation.discard(preview.previewId); setPreview(null); setEditedContent(null); requestKey.current = null; }}>Discard preview</button></> : <AiStudyPractice key={id || preview.previewId} item={activeItem} onComplete={id ? async answers => {
          const data = (await service.practice(id, answers)).data; setItem(current => current && ({ ...current, practiceHistory: data.practiceHistory })); return data;
        } : undefined} />}
      </section>}
    </>}
  </div>;
}
