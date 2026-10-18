import { useConfirm } from '../../context/confirmAccess';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import moderationService from '../../services/moderationService';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatSessionDateTime } from '../../utils/sessionPresentation';
import { SessionEvidence } from '../../components/student/SessionCompletionPanel';
import { completionCopy } from '../../utils/completionPresentation';
import { useToast } from '../../context/toastAccess';
import SessionReviewRecord from '../../components/staff/SessionReviewRecord';

const participantName = (value) => value?.name || 'Student account';

export const ModeratorDisputesPage = () => {
  const { pathname, search } = useLocation();
  const staffLabel = pathname.startsWith('/admin') ? 'Administration' : 'Moderator';
  const confirm = useConfirm();
  const toast = useToast();
  const [noteErrors, setNoteErrors] = useState({});
  const [viewStatus, setViewStatus] = useState(() => new URLSearchParams(window.location.search).get('status') === 'resolved' ? 'resolved' : 'open');
  const [sessions, setSessions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState(null);
  const [notes, setNotes] = useState({});
  const [caseErrors, setCaseErrors] = useState({});
  const [fullEvidence, setFullEvidence] = useState({});
  const [evidenceLoading, setEvidenceLoading] = useState(null);
  const selectedSession = new URLSearchParams(search).get('session');
  const focusedCase = useRef('');
  const mutationPending = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFullEvidence({});
    try {
      const response = viewStatus === 'resolved'
        ? await moderationService.getResolvedSessions() : await moderationService.getDisputedSessions();
      const rows = response.data || [];
      if (/^[a-f0-9]{24}$/i.test(selectedSession || '') && !rows.some((row) => row._id === selectedSession)) {
        const linked = await moderationService.getSessionEvidence(selectedSession);
        rows.unshift({ ...linked.data.session, reviewIndicators: linked.data.payments.length ? ['prior_credit_transaction'] : [] });
        setFullEvidence((current) => ({ ...current, [selectedSession]: linked.data }));
      }
      setSessions(rows);
      setCaseErrors({});
      setError('');
    } catch (err) {
      setError(err.message || 'Disputed sessions could not be loaded.');
      setSessions(null);
    } finally {
      setLoading(false);
    }
  }, [viewStatus, selectedSession]);
  useEffect(() => { Promise.resolve().then(load); }, [load]);
  useLayoutEffect(() => {
    if (loading || !selectedSession || focusedCase.current === `${selectedSession}:${viewStatus}`) return;
    const target = document.getElementById(`staff-review-${selectedSession}`);
    if (!target) return;
    focusedCase.current = `${selectedSession}:${viewStatus}`;
    target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }, [loading, selectedSession, viewStatus, sessions]);

  const resolve = async (session, resolution) => {
    if (mutationPending.current) return;
    const resolutionNote = (notes[session._id] || '').trim();
    if (resolutionNote.length < 10) {
      setNoteErrors((current) => ({ ...current, [session._id]: 'Enter a resolution note of at least 10 characters.' }));
      document.getElementById(`resolution-note-${session._id}`)?.focus();
      return;
    }
    setNoteErrors((current) => ({ ...current, [session._id]: '' }));
    const expectedVersion = session.reviewVersion || 0;
    const action = resolution === 'confirm_session' ? 'confirm this session and transfer credits' : 'reject this session without transferring credits';
    const title = session.disputedBy ? 'Resolve dispute' : 'Resolve completion review';
    if (!await confirm(`Resolve this review and ${action}? Your note stays with the Session resolution evidence. The audit log records the action and outcome.`, { title, label: title })) return;
    if (mutationPending.current) return;
    mutationPending.current = true;
    setWorkingId(session._id);
    setError('');
    setCaseErrors((current) => ({ ...current, [session._id]: '' }));
    try {
      const response = await moderationService.resolveSession(session._id, resolution, resolutionNote, expectedVersion);
      toast('success', response.message);
      setSessions((current) => current.filter((item) => item._id !== session._id));
    } catch (err) {
      setCaseErrors((current) => ({ ...current, [session._id]: err.message || 'Review could not be resolved. Refresh to review current evidence.' }));
      toast('error', err.message || 'Dispute could not be resolved. Refresh and review the latest state.');
    } finally {
      mutationPending.current = false;
      setWorkingId(null);
    }
  };

  const loadEvidence = async (session) => {
    if (mutationPending.current || evidenceLoading) return;
    setEvidenceLoading(session._id);
    try {
      const result = await moderationService.getSessionEvidence(session._id);
      setFullEvidence((current) => ({ ...current, [session._id]: result.data }));
      setSessions((current) => current.map((row) => row._id === session._id ? { ...row, ...result.data.session } : row));
      setError('');
    } catch (failure) { setError(failure.message || 'Review evidence could not be loaded.'); }
    finally { setEvidenceLoading(null); }
  };
  const clarify = async (session) => {
    if (mutationPending.current) return;
    const reason = (notes[session._id] || '').trim();
    if (reason.length < 10) { setNoteErrors((current) => ({ ...current, [session._id]: 'Enter a clarification reason of at least 10 characters.' })); document.getElementById(`resolution-note-${session._id}`)?.focus(); return; }
    const expectedVersion = session.reviewVersion || 0;
    if (!await confirm('Send this reason as a clarification request to both participants? The review remains open and no credits change.', { title: 'Request clarification', label: 'Request clarification', destructive: false })) return;
    if (mutationPending.current) return;
    mutationPending.current = true; setWorkingId(session._id);
    try {
      const result = await moderationService.requestClarification(session._id, reason, expectedVersion);
      setSessions((current) => current.map((row) => row._id === session._id ? { ...row, ...result.data } : row));
      toast('success', result.message);
    } catch (failure) { setError(failure.message || 'Clarification could not be requested. Refresh and try again.'); }
    finally { mutationPending.current = false; setWorkingId(null); }
  };

  return (
    <div className="staff-page">
      <header className="staff-page-header"><div><span className="staff-eyebrow">{staffLabel} / Sessions</span><h1>Session disputes and completion reviews</h1><p>Review self-reported attendance, confirmations, messages and submitted work. Silence alone never approves completion.</p></div></header>
      <Alert type="danger" message={error} />
      <div className="card staff-filter-bar"><label className="staff-filter-select">View <select className="form-select" value={viewStatus}
        onChange={(event) => setViewStatus(event.target.value)}><option value="open">Open exceptions</option><option value="resolved">Resolved cases</option></select></label>
      <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading || Boolean(workingId)}>Refresh disputes</button></div>
      {loading ? <LoadingSpinner text="Loading disputes..." size={30} /> : sessions === null ? <p className="staff-data-note">Cases could not be loaded. Try Refresh.</p> : sessions.length === 0 ? <p className="staff-data-note">{viewStatus === 'open' ? 'No session exceptions need review.' : 'No resolved cases yet.'}</p> : (
        <div className="session-dispute-list">
          {sessions.map((session) => (
            <article key={session._id} id={`staff-review-${session._id}`} tabIndex={selectedSession === session._id ? -1 : undefined} className={`card session-dispute-card${selectedSession === session._id ? " session-proposal-emphasis" : ""}`}>
              <h2>{session.subject}</h2>
              <p><strong>Learner:</strong> {participantName(session.learner)} · <strong>Tutor:</strong> {participantName(session.tutor)}</p>
              <p><strong>Agreed time:</strong> {formatSessionDateTime(session.scheduledAt) || 'Not recorded'}</p>
              {['resolved', 'completed'].includes(session.status) || (viewStatus === 'resolved' && !session.status) ? <><p role="status">This review is already closed. No further decision or payment can be submitted here.</p><p><strong>Outcome:</strong> {session.status === 'completed' ? 'Closed by participant confirmations' : session.resolution === 'confirm_session' ? 'Session valid' : 'Session invalid'}</p>
                <p><strong>Decision:</strong> {session.resolutionNote || 'No note recorded'}</p>
                <p><strong>Credits:</strong> {session.creditsSettledAt ? 'Transferred' : 'Not transferred'}</p>
                <p><strong>Resolved:</strong> {formatSessionDateTime(session.resolvedAt || session.reviewReferral?.closedAt) || 'Time unavailable'}</p>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadEvidence(session)} disabled={Boolean(evidenceLoading)}>{evidenceLoading === session._id ? 'Loading case record...' : 'View case record and audit'}</button>
                {fullEvidence[session._id] && <SessionEvidence session={fullEvidence[session._id].session} />}
                <SessionReviewRecord record={fullEvidence[session._id]} />
              </> : <>
              <h3>Review evidence</h3>
              <p role="status">{completionCopy(session)}</p>
              {session.validationDeadlineAt && <p><strong>Response deadline:</strong> {formatSessionDateTime(session.validationDeadlineAt)}</p>}
              {session.reviewReferral && <><p><strong>Referral source:</strong> {session.reviewReferral.source === 'system_overdue' ? 'System overdue referral; no participant dispute' : 'Tutor review request'}</p>
                <p><strong>Referred:</strong> {formatSessionDateTime(session.reviewReferral.createdAt)} | <strong>Staff response target:</strong> {formatSessionDateTime(session.reviewReferral.targetAt)}</p>
                <p>{session.completionReview?.staffTargetOverdue ? 'Staff response target passed. This remains an open exception.' : 'The target guides staff response; it does not guarantee payment or adjudication.'}</p>
                <p><strong>Referral reason:</strong> {session.reviewReferral.reason}</p></>}
              <SessionEvidence session={session} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadEvidence(session)} disabled={Boolean(workingId) || Boolean(evidenceLoading)}>{evidenceLoading === session._id ? 'Loading case record...' : 'View messages and ledger'}</button>
              <SessionReviewRecord record={fullEvidence[session._id]} />
              <p><strong>Check-ins:</strong> Learner {formatSessionDateTime(session.learnerCheckedInAt) || 'none'}; Tutor {formatSessionDateTime(session.tutorCheckedInAt) || 'none'}</p>
              <p><strong>Session started:</strong> {formatSessionDateTime(session.startedAt) || 'No'} · <strong>Finished:</strong> {formatSessionDateTime(session.awaitingValidationAt) || 'No'}</p>
              <p><strong>Confirmations:</strong> Learner {formatSessionDateTime(session.learnerConfirmedAt) || 'none'}; Tutor {formatSessionDateTime(session.tutorConfirmedAt) || 'none'}</p>
              {session.noShowAt && <p><strong>No-show evidence:</strong> {session.noShowAbsent === 'both' ? 'Neither checked in' : `${session.noShowAbsent} absent`} · recorded {formatSessionDateTime(session.noShowAt)}</p>}
              {session.disputedBy && <p><strong>Disputed by:</strong> {participantName(session.disputedBy)} · {formatSessionDateTime(session.disputedAt)}</p>}
              {session.disputeReason && <p><strong>Dispute reason:</strong> {session.disputeReason}</p>}
              <p><strong>Meeting:</strong> {session.meetingMethod === 'online' ? session.meetingLink ? 'Online link recorded' : 'No online link recorded' : session.meetingMethod === 'in-person' ? session.location || 'Location not recorded' : 'Method not recorded'}</p>
              <p><strong>Credits:</strong> {session.creditsSettledAt ? 'Transferred' : 'Not transferred while review is unresolved'}</p>
              {session.reviewIndicators?.includes('prior_credit_transaction') && <Alert type="danger" message="Review required: a credit transaction already exists for this disputed session. Resolution is blocked until investigated." />}
              {session.reviewIndicators?.includes('no_show_reported') && <p className="staff-data-note">Review indicator: a no-show was reported. Compare it with the check-in timestamps.</p>}
              <label className="form-label" htmlFor={`resolution-template-${session._id}`}>Optional reason template</label>
              <select id={`resolution-template-${session._id}`} className="form-select" defaultValue=""
                onChange={(event) => setNotes((current) => ({ ...current, [session._id]: event.target.value }))}>
                <option value="">Write my own reason</option>
                <option value="Session verified from available attendance and confirmation evidence.">Session verified from evidence</option>
                <option value="Insufficient evidence that the tutoring session was completed.">Insufficient completion evidence</option>
                <option value="No-show outcome supported by recorded check-in evidence.">Confirmed no-show evidence</option>
              </select>
              <label className="form-label" htmlFor={`resolution-note-${session._id}`}>Resolution note</label>
              <textarea id={`resolution-note-${session._id}`} className="form-textarea" aria-invalid={Boolean(noteErrors[session._id])} aria-describedby={noteErrors[session._id] ? `resolution-error-${session._id}` : undefined} minLength={10} maxLength={500} rows={3} value={notes[session._id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [session._id]: event.target.value }))} disabled={Boolean(workingId)} />
              {noteErrors[session._id] && <span id={`resolution-error-${session._id}`} className="form-error">{noteErrors[session._id]}</span>}
              <Alert type="danger" message={caseErrors[session._id]} />
              <div className="session-dispute-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => clarify(session)} disabled={Boolean(workingId) || session.reviewClarifications?.length >= 5}>Request clarification</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => resolve(session, 'confirm_session')} disabled={Boolean(workingId) || session.reviewIndicators?.includes('prior_credit_transaction')}>Confirm session and settle credits</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => resolve(session, 'cancel_session')} disabled={Boolean(workingId) || session.reviewIndicators?.includes('prior_credit_transaction')}>Mark session invalid</button>
              </div>
              </>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModeratorDisputesPage;
