import { safeSessionReturnPath } from './sessionNavigation.js';
export function safeStudyReturnPath(value) {
  if (typeof value !== 'string' || value.length > 500 || /[\\\s]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://acadova.invalid');
    if (url.origin !== 'https://acadova.invalid' || !value.startsWith('/study-sets') || url.hash || !/^\/study-sets(?:\/(?:new|[a-f0-9]{24}))?$/i.test(url.pathname)) return null;
    const keys = [...url.searchParams.keys()];
    if (url.pathname === '/study-sets/new' && keys.length) return null;
    if (new Set(keys).size !== keys.length) return null;
    if (url.pathname === '/study-sets') {
      if (keys.some(key => !['view', 'q'].includes(key)) || url.searchParams.has('view') && !['mine', 'shared', 'results'].includes(url.searchParams.get('view')) || (url.searchParams.get('q') || '').length > 80) return null;
    } else if (keys.length > 1 || keys.some(key => !['edit', 'review', 'attempt'].includes(key)) || keys.some(key => key === 'attempt' ? !/^[a-f0-9]{24}$/i.test(url.searchParams.get(key)) : url.searchParams.get(key) !== '1')) return null;
    return url.pathname + url.search;
  } catch { return null; }
}
export const safeStudentReturnPath = value => safeSessionReturnPath(value) || safeStudyReturnPath(value);
export const studentReturnFromSearch = search => safeStudentReturnPath(new URLSearchParams(search).get('returnTo'));
