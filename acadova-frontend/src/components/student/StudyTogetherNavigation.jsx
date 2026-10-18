import { Link, useLocation } from 'react-router-dom';
export default function StudyTogetherNavigation({ children }) {
  const { pathname } = useLocation();
  const items = [['/tutors','Find Help'],['/sessions','My Sessions'],['/profile#profile-skills-teach','Offer Help'],['/study-together','Study Circles']];
  return <nav className="ac-filter-tabs ac-collaboration-nav" aria-label="Study Together sections">{items.map(([to,label]) => <Link key={to} to={to} aria-current={pathname === to.split('#')[0] || pathname.startsWith(to.split('#')[0] + '/') ? 'page' : undefined}>{label}</Link>)}{children}</nav>;
}
