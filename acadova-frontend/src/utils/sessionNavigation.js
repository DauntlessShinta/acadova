const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

// A narrow internal destination allowlist; never accept arbitrary return URLs.
export function safeSessionReturnPath(value) {
  if (typeof value !== 'string' || value.length > 300 || /[\\\s]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://acadova.invalid');
    if (!value.startsWith('/sessions/') || url.origin !== 'https://acadova.invalid'
      || !/^\/sessions\/[a-f0-9]{24}$/i.test(url.pathname)) return null;
    if (!['', '#session-messages', '#session-proposal', '#session-completion'].includes(url.hash)) return null;
    const keys = [...url.searchParams.keys()];
    if (keys.length && (keys.length !== 2 || new Set(keys).size !== 2
      || !keys.includes('target') || !keys.includes('proposalId')
      || url.searchParams.get('target') !== 'proposal' || !UUID.test(url.searchParams.get('proposalId') || '')
      || url.hash !== '#session-proposal')) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}
export const sessionReturnFromSearch = (search) => safeSessionReturnPath(new URLSearchParams(search).get('returnTo'));
export function proposalTarget(search, hash) {
  const params = new URLSearchParams(search);
  if (hash !== '#session-proposal' && params.get('target') !== 'proposal') return null;
  const id = params.get('proposalId');
  return id && UUID.test(id) ? id : 'missing';
}
export function proposalTargetMessage(session, targetId) {
  if (!targetId) return '';
  if (targetId === session?.rescheduleProposalId) {
    return session.proposalStatus === 'expired' ? 'This proposal expired. The confirmed schedule remains in place.' : '';
  }
  const event = session?.rescheduleHistory?.findLast((item) => item.proposalId === targetId);
  const explanations = { replaced: 'This proposal was replaced. Review the latest proposal separately.',
    withdrawn: 'This proposal was withdrawn. The confirmed schedule remains in place.',
    expired: 'This proposal expired. The confirmed schedule remains in place.',
    declined: 'This proposal was declined. The confirmed schedule remains in place.',
    accepted: 'This proposal was accepted. The confirmed schedule below reflects that decision.',
    check_in_locked: 'This proposal closed when a participant checked in. The confirmed schedule is locked.' };
  return explanations[event?.outcome] || 'This proposal is no longer available. Review the current schedule and latest proposal separately.';
}
