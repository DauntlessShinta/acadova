export function resourceSource(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.hostname.replace(/^www\./, '') : '';
  } catch { return ''; }
}

export function learningAccessLabel(item) {
  if (item.unlocked) return 'Unlocked';
  if (item.locked) return Number.isFinite(item.creditCost) ? `${item.creditCost} credits` : 'Locked';
  return item.creditCost === 0 ? 'Free' : '';
}
