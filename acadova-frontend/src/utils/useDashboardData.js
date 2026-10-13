import { useCallback, useEffect, useRef, useState } from 'react';
import { createRefreshGate, subscribeVisibleRefresh } from './visibleRefresh';

export function useDashboardData(sources, query, enabled = true) {
  const [state, setState] = useState({ key: '', data: {}, busy: true, error: '', updatedAt: null });
  const gate = useRef(createRefreshGate());
  const activeRequest = useRef(null);
  const key = JSON.stringify(query);
  const refresh = useCallback(() => gate.current.run(async valid => {
    if (!enabled) return;
    setState(current => ({ ...current, key, data: current.key === key ? current.data : {}, busy: true, error: '', updatedAt: current.key === key ? current.updatedAt : null }));
    const controller = new AbortController();
    activeRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const results = await Promise.allSettled(sources.map(([, fetcher]) => fetcher(JSON.parse(key), { signal: controller.signal })));
    clearTimeout(timeout);
    if (activeRequest.current === controller) activeRequest.current = null;
    if (!valid()) return;
    const failed = results.filter(result => result.status === 'rejected').length;
    setState(current => ({ key, busy: false,
      data: Object.fromEntries(sources.map(([name], index) => [name, results[index].status === 'fulfilled' ? results[index].value.data : current.data[name] ?? null])),
      error: failed ? 'Some data could not be refreshed. Previously loaded values may be out of date. Retry to update all sources.' : '',
      updatedAt: failed ? current.updatedAt : new Date().toISOString(),
    }));
  }), [key, enabled, sources]);
  useEffect(() => {
    const controller = gate.current;
    controller.invalidate();
    void refresh();
    const unsubscribe = enabled ? subscribeVisibleRefresh(refresh) : () => {};
    const request = activeRequest;
    return () => { unsubscribe(); controller.invalidate(); request.current?.abort(); };
  }, [refresh, enabled]);
  const current = state.key === key ? state : { data: {}, busy: enabled, error: '', updatedAt: null };
  return { ...current, loading: enabled && current.busy && !Object.values(current.data).some(Boolean), refresh };
}
