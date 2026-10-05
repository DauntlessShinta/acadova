export const soundPreferenceKey = (userId) => `acadova:sound:${userId}`;
export function readSoundPreference(userId) {
  try { return localStorage.getItem(soundPreferenceKey(userId)) === 'on'; } catch { return false; }
}
export function saveSoundPreference(userId, enabled) {
  try { localStorage.setItem(soundPreferenceKey(userId), enabled ? 'on' : 'off'); } catch { /* In-memory setting still works. */ }
}

export function createNotificationSound(makeContext = () => new (window.AudioContext || window.webkitAudioContext)(), now = Date.now) {
  let context;
  let lastPlayed = -Infinity;
  return {
    async unlock() {
      try { context ||= makeContext(); await context.resume(); return context.state === 'running'; } catch { return false; }
    },
    play() {
      if (!context || context.state !== 'running' || now() - lastPlayed < 10_000) return false;
      try {
        const oscillator = context.createOscillator(); const gain = context.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = 660;
        gain.gain.setValueAtTime(0.035, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + .16);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(); oscillator.stop(context.currentTime + .18);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
        lastPlayed = now(); return true;
      } catch { return false; }
    },
    close() { if (context) void context.close().catch(() => {}); context = null; },
  };
}
