import { useEffect, useRef, useState } from 'react';

// Text entry is debounced; committed queries remain shareable history entries.
export function useSearchDraft(params, setParams, key = 'q') {
  const route = params.toString();
  const [value, setValue] = useState(() => params.get(key) || '');
  const ownRoute = useRef(null);
  useEffect(() => {
    if (ownRoute.current === route) { ownRoute.current = null; return undefined; }
    let active = true;
    Promise.resolve().then(() => { if (active) setValue(new URLSearchParams(route).get(key) || ''); });
    return () => { active = false; };
  }, [route, key]);
  useEffect(() => {
    const back = () => { ownRoute.current = null; setValue(new URLSearchParams(window.location.search).get(key) || ''); };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, [key]);
  const apply = () => {
    const next = new URLSearchParams(route);
    if (value.trim()) next.set(key, value.trim()); else next.delete(key);
    next.delete('page');
    if (next.toString() !== route) { ownRoute.current = next.toString(); setParams(next); }
  };
  useEffect(() => {
    const timer = setTimeout(() => {
      if (value.trim() === (new URLSearchParams(route).get(key) || '')) return;
      const next = new URLSearchParams(route);
      if (value.trim()) next.set(key, value.trim()); else next.delete(key);
      next.delete('page');
      if (next.toString() !== route) { ownRoute.current = next.toString(); setParams(next); }
    }, 250);
    return () => clearTimeout(timer);
  }, [value, route, key, setParams]);
  return { value, change: setValue, apply };
}
