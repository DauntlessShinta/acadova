import { useConfirm } from '../../context/confirmAccess';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import moderationService from '../../services/moderationService';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatSessionDateTime } from '../../utils/sessionPresentation';
import { useToast } from '../../context/toastAccess';

const participantName = (value) => value?.name || 'Student account';

export const ModeratorDisputesPage = () => {
  const confirm = useConfirm();
  const toast = useToast();
  const [noteErrors, setNoteErrors] = useState({});
  const [viewStatus, setViewStatus] = useState(() => new URLSearchParams(window.location.search).get('status') === 'resolved' ? 'resolved' : 'open');
  const [sessions, setSessions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState(null);
  const [notes, setNotes] = useState({});
  const mutationPending = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = viewStatus === 'resolved'
        ? await moderationService.getResolvedSessions() : await moderationService.getDisputedSessions();
      setSessions(response.data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Disputed sessions could not be loaded.');
      setSessions(null);
    } finally {
      setLoading(false);
    }
  }, [viewStatus]);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const resolve = async (session, resolution) => {
    if (mutationPending.current) return;
    const resolutionNote = (notes[session._id] || '').trim();
    if (resolutionNote.length < 10) {
      setNoteErrors((current) => ({ ...current, [session._id]: 'Enter a resolution note of at least 10 characters.' }));
      document.getElementById(`resolution-note-${session._id}`)?.focus();
      return;
    }
    setNoteErrors((current) => ({ ...current, [session._id]: '' }));
    const action = resolution === 'confirm_session' ? 'confirm this session and transfer credits' : 'reject this session without transferring credits';
    if (!await confirm(`Resolve this dispute and ${action}? Your note stays with the Session resolution evidence. The audit log records the action and outcome.`, { title: 'Resolve dispute', label: 'Resolve dispute' })) return;
    if (mutationPending.current) return;
    mutationPending.current = true;
    setWorkingId(session._id);
    setError('');
    try {
      const response = await moderationService.resolveSession(session._id, resolution, resolutionNote);
      toast('success', response.message);
      setSessions((current) => current.filter((item) => item._id !== session._id));
    } catch (err) {
      toast('error', err.message || 'Dispute could not be resolved. Refresh and review the latest state.');
    } finally {
      mutationPending.current = false;
      setWorkingId(null);
    }
  };

  return (
    <div className="staff-page">
      <header className="staff-page-header"><div><span className="staff-eyebrow">Moderator / Sessions</span><h1>Session disputes</h1><p>Review attendance and confirmation evidence before resolving an exception.</p></div></header>
      <Alert type="danger" message={error} />
      <label className="staff-filter-select">View <select className="form-select" value={viewStatus}
        onChange={(event) => setViewStatus(event.target.value)}><option value="open">Open disputes</option><option value="resolved">Resolved cases</option></select></label>
      <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={Boolean(workingId)}>Refresh disputes</button>
      {loading ? <LoadingSpinner text="Loading disputes..." size={30} /> : sessions === null ? <p className="staff-data-note">Cases could not be loaded. Try Refresh.</p> : sessions.length === 0 ? <p className="staff-data-note">{viewStatus === 'open' ? 'No disputed sessions need review.' : 'No resolved cases yet.'}</p> : (
        <div className="session-dispute-list">
          {sessions.map((session) => (
            <article key={session._id} className="card session-dispute-card">
              <h2>{session.subject}</h2>
              <p><strong>Learner:</strong> {participantName(session.learner)} · <strong>Tutor:</strong> {participantName(session.tutor)}</p>
              <p><strong>Agreed time:</strong> {formatSessionDateTime(session.scheduledAt) || 'Not recorded'}</p>
              {viewStatus === 'resolved' ? <><p><strong>Outcome:</strong> {session.resolution === 'confirm_session' ? 'Session valid' : 'Session invalid'}</p>
                <p><strong>Decision:</strong> {session.resolutionNote || 'No note recorded'}</p>
                <p><strong>Credits:</strong> {session.creditsSettledAt ? 'Transferred' : 'Not transferred'}</p>
                <p><strong>Resolved:</strong> {formatSessionDateTime(session.resolvedAt) || 'Time unavailable'}</p></> : <>
              <h3>Verification evidence</h3>
              <p><strong>Check-ins:</strong> Learner {formatSessionDateTime(session.learnerCheckedInAt) || 'none'}; Tutor {formatSessionDateTime(session.tutorCheckedInAt) || 'none'}</p>
              <p><strong>Session started:</strong> {formatSessionDateTime(session.startedAt) || 'No'} · <strong>Finished:</strong> {formatSessionDateTime(session.awaitingValidationAt) || 'No'}</p>
              <p><strong>Confirmations:</strong> Learner {formatSessionDateTime(session.learnerConfirmedAt) || 'none'}; Tutor {formatSessionDateTime(session.tutorConfirmedAt) || 'none'}</p>
              {session.noShowAt && <p><strong>No-show evidence:</strong> {session.noShowAbsent === 'both' ? 'Neither checked in' : `${session.noShowAbsent} absent`} · recorded {formatSessionDateTime(session.noShowAt)}</p>}
              <p><strong>Disputed by:</strong> {participantName(session.disputedBy)} · {formatSessionDateTime(session.disputedAt)}</p>
              <p><strong>Reason:</strong> {session.disputeReason}</p>
              <p><strong>Meeting:</strong> {session.meetingMethod === 'online' ? session.meetingLink ? 'Online link recorded' : 'No online link recorded' : session.meetingMethod === 'in-person' ? session.location || 'Location not recorded' : 'Method not recorded'}</p>
              <p><strong>Credits:</strong> {session.creditsSettledAt ? 'Transferred' : 'Not transferred while disputed'}</p>
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
              <div className="session-dispute-actions">
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
