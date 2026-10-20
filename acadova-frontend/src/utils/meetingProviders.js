export const meetingProviders = [
  { id:'meet', label:'Google Meet', createUrl:'https://meet.google.com/' },
  { id:'zoom', label:'Zoom', createUrl:'https://zoom.us/signin' },
  { id:'teams', label:'Microsoft Teams', createUrl:'https://teams.microsoft.com/' },
];
// UX parity with the existing strict Circle bookmark contract. The backend still
// revalidates and decides who can retrieve a saved link; this is not authorization.
export function meetingBookmark(value) {
  const clean = typeof value === 'string' ? value.trim() : '';
  try {
    const u = new URL(clean);
    if (clean.length > 500 || /[\s\\]/.test(clean) || u.protocol !== 'https:' || u.username || u.password || u.port || u.hash) return null;
    const provider = u.hostname === 'meet.google.com' && /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(u.pathname) ? 'meet'
      : /^(?:[a-z0-9-]+\.)?zoom\.us$/.test(u.hostname) && /^\/(?:j|my)\/[A-Za-z0-9._-]+\/?$/.test(u.pathname) ? 'zoom'
      : ['teams.microsoft.com','teams.live.com'].includes(u.hostname) && u.pathname.startsWith('/meet/') ? 'teams' : null;
    if (!provider) return null;
    const keys = [...u.searchParams.keys()], allowed = provider === 'zoom' ? 'pwd' : 'p';
    if (keys.length > 1 || keys.some(key => key !== allowed) || keys.length && !/^[A-Za-z0-9._~-]{1,200}$/.test(u.searchParams.get(allowed)) || provider === 'meet' && u.search) return null;
    return { ...meetingProviders.find(row => row.id === provider), href:u.href };
  } catch { return null; }
}
