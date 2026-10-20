import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import service from '../../services/studyService';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/confirmAccess';
import { useToast } from '../../context/toastAccess';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Alert from '../../components/common/Alert';
import { studyStateLabel } from '../../utils/studyQuiz';
import { useSearchDraft } from '../../utils/useSearchDraft';

export default function ModeratorStudySetsPage() {
  const { user } = useAuth(); const { pathname } = useLocation(); const [params, setParams] = useSearchParams(); const selected = params.get('set'); const listView = params.get('view'); const area = pathname.startsWith('/admin') ? 'admin' : 'moderator';
  const confirm = useConfirm(); const toast = useToast(); const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [working, setWorking] = useState(false); const [retry, setRetry] = useState(0); const pending = useRef(false); const version = useRef(0);
  const searchDraft = useSearchDraft(params, setParams); const search = searchDraft.value; const setSearch = searchDraft.change; const caseFilter = ['pending', 'reports'].includes(params.get('case')) ? params.get('case') : 'all';
  const setCaseFilter = value => { const next = new URLSearchParams(params); if (value === 'all') next.delete('case'); else next.set('case', value); setParams(next); };
  const visibleRows = selected ? rows : rows.filter(row => (caseFilter === 'all' || (caseFilter === 'reports' ? row.reports.length > 0 : row.state === 'pending'))
    && (!search.trim() || [row.title, row.subject, row.authorName].some(value => value?.toLowerCase().includes(search.trim().toLowerCase()))));
  useEffect(() => { const current = ++version.current;
    Promise.resolve().then(() => { if (current !== version.current) return []; setLoading(true); setError(''); return selected ? service.staffGet(selected).then(response => [response.data]) : service.staffList(listView).then(response => response.data || []); })
      .then(data => { if (current === version.current) setRows(data); }).catch(failure => { if (current === version.current) { setRows([]); setError(failure.message); } }).finally(() => { if (current === version.current) setLoading(false); }); return () => { version.current = current + 1; };
  }, [selected, listView, retry]);
  useLayoutEffect(() => { if (!loading && selected) document.getElementById('study-case-' + selected)?.focus(); }, [loading, selected]);
  const mutate = async (row, outcome, report) => {
    if (pending.current) return;
    const snapshot = row.version; const cycle = report?.cycle; const view = version.current;
    const reason = await confirm(report ? 'Record why this report is closed. Publication will stay unchanged.' : `${outcome === 'approve' || outcome === 'restore' ? 'Make this exact revision publicly available for free practice' : outcome === 'remove' ? 'Remove public access and close its active reports' : 'Reject this publication submission'}? Record your review reason. Study decisions never change credits.`,
      { title: report ? 'Close study report' : 'Study publication decision', input: true, minLength: 10, maxLength: 500, label: report ? 'Close report with reason' : 'Record study decision', destructive: !['approve', 'restore'].includes(outcome) });
    if (!reason || view !== version.current || pending.current) return; pending.current = true; setWorking(true); setError('');
    try { if (report) await service.closeReport(report.id, reason, cycle); else await service.decide(row.id, { outcome, reason, version: snapshot }); if (view === version.current) { toast('success', 'Study review recorded. No credit changes.'); setRetry(value => value + 1); } }
    catch (failure) { if (view === version.current) setError(failure.message); }
    finally { pending.current = false; setWorking(false); }
  };
  return <div className="study-page study-review-page"><header className="staff-page-header"><div><h1>Study-set Reviews</h1><p>Review publication requests and reports. Record a reason for every decision.</p></div></header>
    <nav className="study-review-tabs" aria-label="Study review lists"><Link className="btn btn-secondary" aria-current={listView !== 'removed' ? 'page' : undefined} to={`/${area}/study-sets`}>Open Reviews</Link><Link className="btn btn-secondary" aria-current={listView === 'removed' ? 'page' : undefined} to={`/${area}/study-sets?view=removed`}>Removed Study Sets</Link></nav>
    {error && <Alert type="danger" message={error} />}
    <div className="card staff-filter-bar study-review-toolbar">
      {!selected && <><label>Search loaded study reviews<input className="form-input" type="search" maxLength={80} placeholder="Title, subject or author" value={search} onChange={event => setSearch(event.target.value)} /></label><label>Case type<select className="form-select" value={caseFilter} onChange={event => setCaseFilter(event.target.value)}><option value="all">All loaded cases</option><option value="pending">Awaiting publication</option><option value="reports">Has open reports</option></select></label><button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); const next = new URLSearchParams(params); next.delete('q'); next.delete('case'); setParams(next); }}>Clear filters</button><p className="form-hint" role="status">{visibleRows.length} of {rows.length} loaded cases (up to 100).</p></>}
      <button type="button" className="btn btn-secondary btn-sm" disabled={working || loading} onClick={() => setRetry(value => value + 1)}>Refresh</button>
    </div>
    <section className="study-review-results" aria-label="Study review results">{loading ? <LoadingSpinner text="Loading study reviews..." /> : !visibleRows.length && !error ? <div className="card"><h2>{rows.length ? 'No study sets match these filters' : 'No study sets in this review list'}</h2><p>Open Reviews includes publication requests and reports. Removed Study Sets includes restoration decisions.</p></div> : visibleRows.map(row => <article className="card study-card" id={'study-case-' + row.id} tabIndex={-1} key={row.id}>
      <h2>{row.title || 'Untitled set'}</h2><p>{studyStateLabel(row.state)} | By {row.authorName} | {row.subject} | Revision {row.revision}, version {row.version}</p>
      {row.deletedAt && <p>This set was deleted. Content decisions are disabled; remaining reports may be closed with a reason.</p>}
      <p>{row.description}</p>{row.contentUnavailable && <p>The reported revision changed. Current private content is hidden; you can close the historical report with a reason.</p>}{row.decision?.reason && <p><strong>Previous recorded decision:</strong> {row.decision.reason}</p>}
      {row.flashcards?.map((card, i) => <section className="study-question" key={"card-" + i}><h3>{card.front}</h3><p>{card.back}</p></section>)}<details><summary>Review all questions and answers ({row.questions.length})</summary>{row.questions.map((question, index) => <section className="study-question" key={index}><h3>{index + 1}. {question.prompt}</h3><ol>{question.options.map((option, i) => <li key={i}>{option}{i === question.correctIndex ? ' (correct answer)' : ''}</li>)}</ol>{question.explanation && <p>{question.explanation}</p>}</section>)}</details>
      {!row.deletedAt && <div className="study-actions">{row.state === 'pending' && <><button className="btn btn-primary" disabled={working || row.authorId === (user?._id || user?.id)} onClick={() => mutate(row, 'approve')}>Approve study publication</button><button className="btn btn-secondary" disabled={working} onClick={() => mutate(row, 'reject')}>Reject study publication</button></>}{(row.state === 'published' || row.state === 'private' && !row.contentUnavailable && row.reports.length > 0) && <button className="btn btn-secondary" disabled={working} onClick={() => mutate(row, 'remove')}>{row.state === 'private' ? 'Remove unlisted study set' : 'Remove published study set'}</button>}{row.state === 'removed' && !row.unlistedRemoved && <button className="btn btn-secondary" disabled={working || row.authorId === (user?._id || user?.id)} onClick={() => mutate(row, 'restore')}>Restore reviewed study revision</button>}</div>}
      <h3>Open study reports ({row.reports.length})</h3>{row.reports.map(report => <section className="study-question" key={report.id}><p>Reported by {report.reporterName} | Revision {report.revision}</p><p>{report.reason}</p><button className="btn btn-secondary" disabled={working} onClick={() => mutate(row, null, report)}>Close report without removal</button></section>)}
      {!row.reports.length && <p>No active reports. A closed report does not change publication.</p>}
    </article>)}</section>
  </div>;
}
