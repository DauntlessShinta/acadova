export function peerReputation(peer) {
  if (!Number.isInteger(peer?.ratingCount) || peer.ratingCount < 0) return { label: 'Ratings unavailable', rated: false };
  if (!peer.ratingCount) return { label: 'No ratings yet', rated: false };
  if (!Number.isFinite(peer.rating) || peer.rating < 1 || peer.rating > 5) return { label: 'Ratings unavailable', rated: false };
  return { rated: true, label: `${peer.rating.toFixed(1)} out of 5 · ${peer.ratingCount} ${peer.ratingCount === 1 ? 'review' : 'reviews'}` };
}
