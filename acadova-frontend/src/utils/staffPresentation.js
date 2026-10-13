export const readableTime = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Time unavailable';
export const initials = name => (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
export const eventLabel = action => (action || 'recorded event').replace('.', ' / ').replaceAll('_', ' ');

export function ledgerPresentation(row) {
  const labels = { session_payment: 'Tutoring transfer', assessment_reward: 'Assessment reward',
    initial_grant: 'Starting credit grant', learning_unlock: 'Learning unlock', admin_adjustment: 'Admin balance correction' };
  const direction = row.type === 'session_payment' ? 'transfer'
    : row.type === 'learning_unlock' ? 'debit'
      : ['assessment_reward', 'initial_grant'].includes(row.type) ? 'credit'
        : row.type === 'admin_adjustment' && ['credit', 'debit'].includes(row.adjustmentDirection) ? row.adjustmentDirection : 'recorded';
  const sign = direction === 'credit' ? '+' : direction === 'debit' ? '−' : '';
  const participant = direction === 'transfer' ? [row.fromUserName, row.toUserName].filter(Boolean).join(' → ')
    : row.toUserName || row.fromUserName || row.adjustmentTargetName || '';
  return { title: participant || labels[row.type] || 'Recorded credit event', description: labels[row.type] || 'Recorded credit event',
    direction, amount: ['string', 'number'].includes(typeof row.amount) && String(row.amount).trim() && Number.isFinite(Number(row.amount)) && Number(row.amount) >= 0 ? `${sign}${Number(row.amount).toLocaleString()}` : 'Unavailable' };
}

export function decisionStatus(row) {
  if (row.action === 'study.publication_decided') return row.metadata?.newStatus || 'Recorded';
  if (row.action?.endsWith('report_closed')) return 'Closed';
  if (row.action?.includes('dispute_resolved') || row.action?.includes('completion_review_resolved')) return 'Resolved';
  if (row.action?.endsWith('rejected')) return 'Rejected';
  if (row.action?.endsWith('approved') || row.action?.endsWith('published')) return 'Published';
  if (row.action === 'review.moderated') return row.metadata?.hidden === true ? 'Hidden' : row.metadata?.hidden === false ? 'Restored' : 'Recorded';
  if (row.action?.endsWith('archived')) return 'Archived';
  return 'Recorded';
}

export function dailyModeration(trend, { from, to }) {
  const rows = []; const decisions = new Map((trend?.decisions || []).map(row => [row._id, row]));
  const reports = new Map((trend?.reports || []).map(row => [row._id, row.reports]));
  for (let day = new Date(from + 'T00:00:00Z'); day <= new Date(to + 'T00:00:00Z') && rows.length < 366; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10); const row = decisions.get(date) || {};
    rows.push({ date, reviews: row.reviews || 0, reports: reports.get(date) || 0, sessions: row.sessions || 0 });
  }
  return rows;
}

export function groupTrend(rows, max = 30) {
  const size = Math.max(1, Math.ceil(rows.length / max)); const groups = [];
  for (let index = 0; index < rows.length; index += size) {
    const chunk = rows.slice(index, index + size); const keys = Object.keys(chunk[0]).filter(key => key !== 'date');
    groups.push({ date: chunk[0].date, through: chunk.at(-1).date,
      ...Object.fromEntries(keys.map(key => [key, chunk.reduce((sum, row) => sum + row[key], 0)])) });
  }
  return groups;
}
