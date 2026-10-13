// One request per dashboard at a time. A changed filter invalidates its results.
export function createRefreshGate() {
  let generation = 0;
  let running = false;
  let pending = null;
  const run = async task => {
    if (running) { pending = task; return; }
    running = true;
    const ticket = generation;
    try { await task(() => ticket === generation); }
    finally { running = false; const next = pending; pending = null; if (next) void run(next); }
  };
  return { run, invalidate() { generation++; pending = null; } };
}

export function subscribeVisibleRefresh(refresh, { document: doc = document, window: win = window, interval = 45_000 } = {}) {
  let timer;
  const stop = () => { if (timer) win.clearInterval(timer); timer = null; };
  const change = () => {
    stop();
    if (doc.visibilityState !== 'visible') return;
    refresh();
    timer = win.setInterval(refresh, interval);
  };
  const mutation = event => {
    if (doc.visibilityState === 'visible' && /^\/api\/(sessions|assessments|learning|study-sets|admin|moderator)\b/.test(event.detail?.endpoint || '')) refresh();
  };
  doc.addEventListener('visibilitychange', change);
  win.addEventListener('acadova:data-changed', mutation);
  if (doc.visibilityState === 'visible') timer = win.setInterval(refresh, interval);
  return () => { stop(); doc.removeEventListener('visibilitychange', change); win.removeEventListener('acadova:data-changed', mutation); };
}
