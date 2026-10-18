export function safeAcademicReturnPath(value) {
  if (typeof value !== 'string' || value.length > 500 || /[\\\s]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://acadova.invalid');
    if (url.origin !== 'https://acadova.invalid' || !value.startsWith('/') || url.search) return null;
    if (['/dashboard/peer', '/study-together'].includes(url.pathname) && !url.hash) return url.pathname;
    if (!/^\/subjects(?:\/[a-f0-9]{24})?$/i.test(url.pathname)) return null;
    if (url.hash && (!/^\/subjects\/[a-f0-9]{24}$/i.test(url.pathname) || !/^#module-[a-f0-9]{24}$/i.test(url.hash))) return null;
    return url.pathname + url.hash;
  } catch { return null; }
}
