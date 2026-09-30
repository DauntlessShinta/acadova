import React, { useEffect, useState } from 'react';
import moderationService from '../../services/moderationService';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatSessionDateTime } from '../../utils/sessionPresentation';

const participantName = (value) => value?.name || 'Student account';

export const ModeratorDisputesPage = () => {
  const [sessions, setSessions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [workingId, setWorkingId] = useState(null);
  const [notes, setNotes] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const response = await moderationService.getDisputedSessions();
      setSessions(response.data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Disputed sessions could not be loaded.');
      setSessions(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { Promise.resolve().then(load); }, []);

  const resolve = async (session, resolution) => {
    const resolutionNote = (notes[session._id] || '').trim();
    if (resolutionNote.length < 10) {
      setError('Enter a resolution note of at least 10 characters.');
      return;
    }
    const action = resolution === 'confirm_session' ? 'confirm this session and transfer credits' : 'reject this session without transferring credits';
    if (!window.confirm(`Resolve this dispute and ${action}?`)) return;
    setWorkingId(session._id);
    setError('');
    try {
      const response = await moderationService.resolveSession(session._id, resolution, resolutionNote);
      setSuccess(response.message);
      setSessions((current) => current.filter((item) => item._id !== session._id));
    } catch (err) {
      setError(err.message || 'Dispute could not be resolved. Refresh and review the latest state.');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="staff-page">
      <header className="staff-page-header"><div><span className="staff-eyebrow">Moderator / Sessions</span><h1>Session disputes</h1><p>Review attendance and confirmation evidence before resolving an exception.</p></div></header>
      <Alert type="danger" message={error} />
      <Alert type="success" message={success} />
      <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={Boolean(workingId)}>Refresh disputes</button>
      {loading ? <LoadingSpinner text="Loading disputes..." size={30} /> : sessions === null ? <p className="staff-data-note">Disputes could not be loaded. Try Refresh disputes.</p> : sessions.length === 0 ? <p className="staff-data-note">No disputed sessions need review.</p> : (
        <div className="session-dispute-list">
          {sessions.map((session) => (
            <article key={session._id} className="card session-dispute-card">
              <h2>{session.subject}</h2>
              <p><strong>Learner:</strong> {participantName(session.learner)} · <strong>Tutor:</strong> {participantName(session.tutor)}</p>
              <p><strong>Agreed time:</strong> {formatSessionDateTime(session.scheduledAt) || 'Not recorded'}</p>
              <p><strong>Check-ins:</strong> Learner {formatSessionDateTime(session.learnerCheckedInAt) || 'none'}; Tutor {formatSessionDateTime(session.tutorCheckedInAt) || 'none'}</p>
              <p><strong>Session started:</strong> {formatSessionDateTime(session.startedAt) || 'No'} · <strong>Finished:</strong> {formatSessionDateTime(session.awaitingValidationAt) || 'No'}</p>
              <p><strong>Confirmations:</strong> Learner {formatSessionDateTime(session.learnerConfirmedAt) || 'none'}; Tutor {formatSessionDateTime(session.tutorConfirmedAt) || 'none'}</p>
              {session.noShowAt && <p><strong>No-show evidence:</strong> {session.noShowAbsent === 'both' ? 'Neither checked in' : `${session.noShowAbsent} absent`} · recorded {formatSessionDateTime(session.noShowAt)}</p>}
              <p><strong>Disputed by:</strong> {participantName(session.disputedBy)} · {formatSessionDateTime(session.disputedAt)}</p>
              <p><strong>Reason:</strong> {session.disputeReason}</p>
              {session.reviewIndicators?.includes('prior_credit_transaction') && <Alert type="danger" message="Review required: a credit transaction already exists for this disputed session. Resolution is blocked until investigated." />}
              {session.reviewIndicators?.includes('no_show_reported') && <p className="staff-data-note">Review indicator: a no-show was reported. Compare it with the check-in timestamps.</p>}
              <label className="form-label" htmlFor={`resolution-note-${session._id}`}>Resolution note</label>
              <textarea id={`resolution-note-${session._id}`} className="form-textarea" minLength={10} maxLength={500} rows={3} value={notes[session._id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [session._id]: event.target.value }))} disabled={Boolean(workingId)} />
              <div className="session-dispute-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => resolve(session, 'confirm_session')} disabled={Boolean(workingId)}>Confirm session and settle credits</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => resolve(session, 'cancel_session')} disabled={Boolean(workingId)}>Mark session invalid</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModeratorDisputesPage;
