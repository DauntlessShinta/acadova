// Presentation only. The existing authenticated server remains authoritative.
export function circleActionState(row, now = Date.now()) {
  const future = new Date(row.startsAt).getTime() > now;
  const ended = new Date(row.endsAt).getTime() <= now;
  const scheduled = row.status === 'scheduled';
  const remaining = Math.max(0, row.capacity - row.enrolled);
  return {
    remaining,
    canJoin:scheduled && future && !row.isHost && !row.joined && !row.hostUnavailable && remaining > 0,
    canLeave:scheduled && row.joined && !row.isHost,
    canEdit:scheduled && future && row.isHost && !row.hostUnavailable,
    full:scheduled && remaining === 0 && !row.isHost && !row.joined,
    label:row.status === 'cancelled' ? 'Cancelled' : row.status === 'completed' ? 'Closed by host' : ended ? 'Ended / awaiting closure' : !future ? 'In scheduled time' : row.isHost ? 'You are hosting' : row.joined ? 'Joined' : 'Upcoming / Free Study Circle',
  };
}
export function myCircleRows(rows, kind, now = Date.now()) {
  return rows.filter(row => kind === 'joined' ? row.joined : kind === 'hosted' ? row.isHost : kind === 'past' ? row.status !== 'scheduled' || new Date(row.endsAt).getTime() <= now : true);
}
