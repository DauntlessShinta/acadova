import React from 'react';
import { formatSessionDateTime } from '../../utils/sessionPresentation';

const actionLabels = {
  'session.dispute_resolved': 'Dispute resolved',
  'session.completion_review_resolved': 'Completion review resolved',
  'session.review_clarification_requested': 'Clarification requested',
};

export default function SessionReviewRecord({ record }) {
  if (!record) return null;
  return <div className="session-review-messages">
    <h3>Latest session messages (up to 100)</h3>
    {record.messages.map(message => <p key={message._id}><strong>{message.sender?.name || 'Participant'}:</strong> {message.body} <span className="form-hint">{formatSessionDateTime(message.createdAt)}</span></p>)}
    {!record.messages.length && <p>No recorded messages.</p>}
    <h3>Recorded credit ledger</h3>
    {record.payments.map(payment => <p key={payment._id}>{payment.type}: {payment.amount} credits | {formatSessionDateTime(payment.createdAt)}</p>)}
    {!record.payments.length && <p>No Session credit transaction.</p>}
    <h3>Case audit history</h3>
    <p className="form-hint">Latest {record.auditLimit || 20} case actions. Roles are recorded at the time of each action. Historical actions are not backfilled.</p>
    {record.auditEntries?.map(entry => <div key={entry._id}>
      <p><strong>{actionLabels[entry.action] || entry.action}</strong> · {formatSessionDateTime(entry.createdAt)}</p>
      <p><strong>Actor:</strong> {entry.actor?.name || 'Former staff account'} · {entry.actorRole}</p>
      {entry.metadata?.resolution && <p><strong>Outcome:</strong> {entry.metadata.resolution === 'confirm_session' ? 'Session valid — settlement approved' : entry.metadata.resolution === 'cancel_session' ? 'Session invalid — no transfer' : entry.metadata.resolution}</p>}
      {entry.metadata?.reason && <p><strong>Recorded reason:</strong> {entry.metadata.reason}</p>}
      <details><summary>Record references</summary>
        <p>Audit: {entry._id}</p><p>Actor: {entry.actor?._id || 'Unavailable'}</p>
        <p>Target: {entry.targetType} · {entry.targetId}</p>
      </details>
    </div>)}
    {record.auditEntries?.length === 0 && <p>No audit entries recorded for this case. This does not establish that a historical decision was audited.</p>}
    {!record.auditEntries && <p role="status">Audit history is unavailable from this response. Refresh the case to try again.</p>}
  </div>;
}
