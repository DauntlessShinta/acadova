const key = 'acadova_pending_staff_mfa';
export function saveStaffChallenge(data) { sessionStorage.setItem(key, JSON.stringify(data)); }
export function clearStaffChallenge() { sessionStorage.removeItem(key); }
export function readStaffChallenge() {
  try {
    const data = JSON.parse(sessionStorage.getItem(key));
    return /^[a-f0-9]{64}$/.test(data?.challenge) && Number.isFinite(Date.parse(data.expiresAt)) ? data : null;
  } catch { return null; }
}
