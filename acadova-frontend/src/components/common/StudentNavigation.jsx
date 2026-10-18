import React, { useRef, useState, useSyncExternalStore } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BookOpen, CalendarDays, Coins, GraduationCap, Home, Layers, Menu, MessageCircle, Search, User, Settings, ChevronLeft } from 'lucide-react';
import SessionConversations from '../student/SessionConversations';
import PublicBrandLogo from './PublicBrandLogo';
import DiscoverySearch from './DiscoverySearch';
import Modal from './Modal';
import AccountMenu from './AccountMenu';
import NotificationBell from './NotificationBell';
import { getPageContext, getRoleNavigation } from '../../config/roleNavigation';

const icons = { Home, 'My Subjects': BookOpen, 'Study Sets': Layers, 'Study Together': CalendarDays, 'Find Tutors': GraduationCap, Learning: BookOpen, Sessions: CalendarDays, Messages: MessageCircle, Credits: Coins, Profile: User, Settings };
const links = getRoleNavigation('student').map(({ to, label }) => [to, label, icons[label]]);
const compactQuery = '(max-width: 1024px)';
const subscribeViewport = (changed) => {
  const media = window.matchMedia(compactQuery);
  media.addEventListener('change', changed);
  return () => media.removeEventListener('change', changed);
};
const readCompactViewport = () => window.matchMedia(compactQuery).matches;
export default function StudentNavigation() {
  const compact = useSyncExternalStore(subscribeViewport, readCompactViewport, () => false);
  const location = useLocation();
  const page = getPageContext(location.pathname, location.search);
  const messageView = new URLSearchParams(location.search).get('view') === 'messages';
  const isAssessmentArea = location.pathname.replace(/\/$/, '') === '/assessments';
  const isStudyArea = location.pathname.startsWith('/study-sets');
  const isAiStudyArea = location.pathname === '/learning/ai-study' || location.pathname.startsWith('/learning/ai-study/');
  const isLearningArea = isAssessmentArea || isStudyArea || isAiStudyArea || location.pathname.replace(/\/$/, '') === '/learning';
  const modern = location.pathname === '/dashboard' || location.pathname === '/subjects' || location.pathname.startsWith('/subjects/') || location.pathname === '/study-together';
  const primary = ['Home', 'My Subjects', 'Study Sets', 'Study Together'];
  const secondary = ['Profile', 'Messages', 'Settings'];
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('acadova_sidebar_collapsed') === '1'; } catch { return false; } });
  const toggleSidebar = () => setCollapsed(value => { try { localStorage.setItem('acadova_sidebar_collapsed', value ? '0' : '1'); } catch { /* Preference storage is optional. */ } return !value; });
  const messagesButton = useRef(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButton = useRef(null);
  const [more, setMore] = useState(false);
  const button = useRef(null);
  const renderLink = ([to, label, Icon]) => {
    const selected = to === '/dashboard#study-planning' ? location.pathname === '/dashboard' && location.hash === '#study-planning'
      : to === '/dashboard' ? location.pathname === '/dashboard'
      : to.includes('?') ? location.pathname === '/sessions' && messageView
      : to === '/study-together' ? ['/study-together','/tutors','/sessions','/dashboard/peer'].some(path => location.pathname === path || location.pathname.startsWith(path + '/'))
      : to === '/study-sets' ? isStudyArea || isAiStudyArea
      : to === '/learning' ? isLearningArea && !isStudyArea
      : to === '/sessions' ? location.pathname.startsWith('/sessions') && !messageView
      : location.pathname.replace(/\/$/, '') === to || location.pathname.startsWith(to + '/');
    return <Link key={to} to={to} aria-label={label} title={collapsed && !compact ? label : undefined} aria-current={selected ? 'page' : undefined} className={`staff-nav-link${selected ? ' is-active' : ''}`} onClick={() => setMore(false)}><Icon size={19} aria-hidden="true"/><span className="ac-nav-label">{label}</span></Link>;
  };
  const navigation = (drawer = false) => <div className="ac-navigation-content">
    <Link to="/dashboard" className="staff-brand" aria-label="Acadova home" onClick={() => setMore(false)}>{collapsed && !compact ? <Layers size={26} aria-hidden="true"/> : <PublicBrandLogo/>}</Link>
    {!compact && <button className="ac-sidebar-toggle" type="button" onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} aria-controls="student-primary-nav">{collapsed ? <Menu size={20} aria-hidden="true"/> : <><ChevronLeft size={20} aria-hidden="true"/><span>Collapse sidebar</span></>}</button>}
    {!drawer && <nav id={!compact ? 'student-primary-nav' : undefined} className="student-nav" aria-label="Student navigation">{links.filter(([,label]) => primary.includes(label)).map(renderLink)}</nav>}
    {compact && <nav className="ac-mobile-more-links" aria-label="More student destinations">{renderLink(['/dashboard#study-planning','Study Plan',CalendarDays])}{secondary.map(label => links.find(([,name]) => name === label)).map(renderLink)}{renderLink(['/growth','Growth',Layers])}{links.filter(([,label]) => !primary.includes(label) && !secondary.includes(label)).map(renderLink)}{renderLink(['/dashboard/peer','Peer dashboard',GraduationCap])}{renderLink(['/about','Help & support',BookOpen])}</nav>}
  </div>;
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {!compact && <header className="student-utility-bar" aria-label="Global utilities">{modern ? <button className="ac-top-search" aria-label="Search Acadova" ref={searchButton} onClick={() => setSearchOpen(true)}><Search size={19} aria-hidden="true"/><span>Search subjects, tutors or learning topics...</span></button> : isLearningArea
      ? <nav className="utility-discovery-shortcut learning-shell-context" aria-label="Current learning area"><Link to="/learning" aria-current={!isAssessmentArea && !isStudyArea && !isAiStudyArea ? 'page' : undefined}><BookOpen size={18} aria-hidden="true" />Learning</Link>{(isAssessmentArea || isStudyArea || isAiStudyArea) && <><span aria-hidden="true">/</span><span aria-current="page">{isAiStudyArea ? 'AI Study Tools' : isStudyArea ? 'Study sets' : 'Assessments'}</span></>}</nav>
      : <span className="utility-discovery-shortcut" aria-current="page">{page.title}</span>}<nav aria-label="Student utilities"><button ref={searchButton} className="utility-link" type="button" aria-label="Search Acadova" onClick={() => setSearchOpen(true)}><Search size={20} aria-hidden="true" /></button><button className="utility-link" ref={messagesButton} type="button" aria-label="Messages" title="Messages" aria-haspopup="dialog" onClick={() => setMessagesOpen(true)}><MessageCircle size={20} aria-hidden="true" /></button><NotificationBell /><AccountMenu /></nav></header>}
    <aside className={`student-sidebar ac-organized-sidebar${collapsed && !compact ? ' is-collapsed' : ''}`}>{navigation()}</aside>
    {compact && <header className="student-mobile-header"><Link to="/dashboard" className="staff-brand" aria-label="Acadova home"><Layers size={23} aria-hidden="true" /><strong>Acadova</strong></Link>
      <div className="student-mobile-utilities"><button ref={searchButton} className="utility-link" type="button" aria-label="Search Acadova" onClick={() => setSearchOpen(true)}><Search size={20} aria-hidden="true" /></button><NotificationBell /><AccountMenu compact /><button ref={messagesButton} className="utility-link" type="button" aria-label="Messages" aria-haspopup="dialog" onClick={() => setMessagesOpen(true)}><MessageCircle size={20} aria-hidden="true" /></button>
      <button className="student-more-trigger utility-link" aria-label="More navigation" ref={button} type="button" aria-expanded={more} onClick={() => setMore(true)}><Menu size={20} aria-hidden="true" /></button></div></header>}
    <nav className="student-mobile-bottom" aria-label="Primary navigation">{links.slice(0, 4).map(([to, label, Icon]) =>
      to === '/learning' ? <Link key={to} to={to} className={isLearningArea ? 'active' : undefined} aria-current={isLearningArea ? 'page' : undefined}><Icon size={20} aria-hidden="true" /><span>{label}</span></Link>
        : <NavLink key={to} to={to} end={to === '/dashboard'}><Icon size={20} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>
    <Modal isOpen={messagesOpen} title="Messages" className="messages-drawer" maxWidth="420px" onClose={() => { setMessagesOpen(false); messagesButton.current?.focus(); }}><SessionConversations onOpen={() => setMessagesOpen(false)} /></Modal>
    <Modal isOpen={searchOpen} title="Search Acadova" onClose={() => { setSearchOpen(false); searchButton.current?.focus(); }}><p>Find tutors by teaching skill, or search the published learning topic list.</p><p><Link to="/subjects" onClick={() => setSearchOpen(false)}>Search my private subjects</Link></p><DiscoverySearch onNavigate={() => setSearchOpen(false)} /></Modal>
    <Modal isOpen={more} title="Acadova navigation" onClose={() => { setMore(false); button.current?.focus(); }}>{navigation(true)}</Modal>
  </>;
}
