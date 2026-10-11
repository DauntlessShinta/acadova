import React, { useState } from 'react';
import { completionCopy, entityId, evidenceErrors, safeEvidenceLink } from '../../utils/completionPresentation';
import { formatSessionDateTime } from '../../utils/sessionPresentation';

export function SessionEvidence({ session }) {
  return <div className="session-private-evidence">
    <p className="form-hint">Private to session participants and authorized review staff. Links open externally; Acadova does not fetch them or verify attendance.</p>
    {(session.completionEvidence || []).map((item) => <article key={item.id} className="session-evidence-entry">
      <h4>{entityId(item.submittedBy) === entityId(session.tutor) ? 'Tutor' : 'Learner'} evidence</h4>
      <p className="form-hint">Submitted {formatSessionDateTime(item.submittedAt)}</p>
      <p className="session-evidence-text"><strong>Session summary:</strong> {item.summary}</p>
      <p className="session-evidence-text"><strong>Completed work:</strong> {item.completedWork}</p>
      <ul>{(item.links || []).filter(safeEvidenceLink).map((link) => <li key={link}><a href={link} target="_blank" rel="noopener noreferrer">{link}<span className="sr-only"> (opens externally)</span></a></li>)}</ul>
    </article>)}
    {(session.reviewClarifications || []).map((item) => <p key={item.id} className="session-evidence-text"><strong>Staff clarification requested {formatSessionDateTime(item.requestedAt)}:</strong> {item.reason}</p>)}
    {!session.completionEvidence?.length && <p>No work evidence submitted yet.</p>}
  </div>;
}
export default function SessionCompletionPanel({ session, user, disabled, onEvidence, onReview }) {
  const [summary, setSummary] = useState(''); const [completedWork, setWork] = useState('');
  const [linksText, setLinks] = useState(''); const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({}); const [error, setError] = useState('');
  const mine = (session.completionEvidence || []).filter((item) => entityId(item.submittedBy) === entityId(user));
  const maySubmit = ['in_progress', 'awaiting_validation', 'disputed', 'no_show'].includes(session.status) && mine.length < 5;
  const save = async (event) => {
    event.preventDefault(); if (disabled) return;
    const links = linksText.split(/\r?\n/).map((link) => link.trim()).filter(Boolean);
    const next = evidenceErrors({ summary, completedWork, links }); setErrors(next); setError('');
    if (Object.keys(next).length) { document.getElementById(`evidence-${Object.keys(next)[0]}`)?.focus(); return; }
    try { if (await onEvidence({ summary: summary.trim(), completedWork: completedWork.trim(), links })) { setSummary(''); setWork(''); setLinks(''); } }
    catch (failure) { setError(failure.message || 'Evidence could not be saved. Your draft is retained.'); }
  };
  const request = async (event) => {
    event.preventDefault(); if (disabled) return;
    if (reason.trim().length < 10) { setError('Write a review reason of at least 10 characters.'); document.getElementById('completion-review-reason')?.focus(); return; }
    try { if (await onReview(reason.trim())) setReason(''); }
    catch (failure) { setError(failure.message || 'Review could not be requested. Refresh and try again.'); }
  };
  return <div className="session-completion-panel">
    <h3>Completion and private evidence</h3><p role="status">{completionCopy(session)}</p>
    {session.validationDeadlineAt && <p><strong>Response deadline:</strong> {formatSessionDateTime(session.validationDeadlineAt)}.{session.status === 'awaiting_validation' ? ' Confirm honestly or dispute the session.' : ''}</p>}
    {session.reviewReferral && <><p><strong>Referral:</strong> {session.reviewReferral.source === 'system_overdue' ? 'System overdue referral' : 'Tutor-requested review'} · {formatSessionDateTime(session.reviewReferral.createdAt)}</p>
      {session.reviewReferral.closedAt ? <p><strong>Review closed:</strong> {formatSessionDateTime(session.reviewReferral.closedAt)}. {session.reviewReferral.closure === 'participant_completion' ? 'Both participants confirmed completion.' : 'Staff recorded a decision.'}</p>
        : <p><strong>Staff response target:</strong> {formatSessionDateTime(session.reviewReferral.targetAt)}{session.completionReview?.staffTargetOverdue ? ' — target passed; awaiting a staff decision.' : ''}</p>}</>}
    {session.resolutionNote && <p><strong>Recorded staff reason:</strong> {session.resolutionNote}</p>}
    <SessionEvidence session={session} />
    {error && <p role="alert" className="form-error">{error}</p>}
    {maySubmit && <form onSubmit={save} noValidate>
      <p className="form-hint">Up to five submissions per participant. Text and up to five HTTPS links per submission; no file uploads. {5 - mine.length} submissions remain.</p>
      {[['summary', 'Session summary', summary, setSummary, 1000], ['completedWork', 'Completed work', completedWork, setWork, 2000], ['links', 'Evidence links (one HTTPS URL per line, optional)', linksText, setLinks, 2504]].map(([name, label, value, change, max]) => <div className="form-group" key={name}>
        <label htmlFor={`evidence-${name}`} className="form-label">{label}</label>
        <textarea id={`evidence-${name}`} className="form-textarea" value={value} onChange={(event) => change(event.target.value)} maxLength={max} disabled={disabled} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `evidence-error-${name}` : 'evidence-help'} rows={3} />
        {errors[name] && <p className="form-error" id={`evidence-error-${name}`}>{errors[name]}</p>}
      </div>)}
      <p id="evidence-help" className="form-hint">Include the learning activity and work you actually completed. Never include passwords or account tokens.</p>
      <button type="submit" className="btn btn-secondary btn-sm" disabled={disabled}>Save private evidence</button>
    </form>}
    {entityId(user) === entityId(session.tutor) && session.completionReview?.canTutorRequestReview && <form onSubmit={request}>
      <label className="form-label" htmlFor="completion-review-reason">Why is completion review needed?</label>
      <textarea id="completion-review-reason" className="form-textarea" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={500} disabled={disabled} aria-describedby="completion-review-help" rows={3} />
      <p id="completion-review-help" className="form-hint">Submit your evidence first. This creates one review case; it does not dispute the session or approve credits.</p>
      <button type="submit" className="btn btn-secondary btn-sm" disabled={disabled || !mine.length}>Request completion review</button>
    </form>}
  </div>;
}
