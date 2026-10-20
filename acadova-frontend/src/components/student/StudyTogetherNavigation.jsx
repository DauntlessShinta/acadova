import { Link, useLocation } from 'react-router-dom';
export default function StudyTogetherNavigation({ children }) {
  const { pathname } = useLocation();
  const circles = pathname === '/study-together';
  return <div className={`ac-collaboration-context${['/tutors', '/study-together'].includes(pathname) ? ' is-discovery' : ''}`}><nav className="ac-collaboration-intentions" aria-label="Study Together sections">
    <Link to="/tutors" aria-current={!circles ? 'page' : undefined}><strong>Find a Tutor / Peer Help</strong></Link>
    <Link to="/study-together" aria-current={circles ? 'page' : undefined}><strong>Study Circles</strong></Link>
  </nav>{<nav className="ac-peer-context-links" aria-label="Peer tutoring destinations"><Link to="/sessions" aria-current={pathname.startsWith('/sessions') ? 'page' : undefined}>My Sessions</Link><Link to="/profile#profile-skills-teach" aria-current={pathname === '/profile' ? 'page' : undefined}>Offer Help</Link></nav>}{children}</div>;
}
