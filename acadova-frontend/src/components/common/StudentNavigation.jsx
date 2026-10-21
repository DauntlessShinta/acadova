import React, { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import './StudentNavigation.css';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BookOpen, CalendarDays, Coins, GraduationCap, Home, Layers, Menu, MessageCircle, Search, UserRound, Settings, PanelLeftClose, PanelLeftOpen, NotebookTabs, UsersRound } from 'lucide-react';
import SessionConversations from '../student/SessionConversations';
import PublicBrandLogo from './PublicBrandLogo';
import DiscoverySearch from './DiscoverySearch';
import Modal from './Modal';
import AccountMenu from './AccountMenu';
import AcadiHelp from '../learning/AcadiHelp';
import HeaderGrowth from '../student/HeaderGrowth';
import { AcadiMark } from '../learning/AcademicUi';
import NotificationBell from './NotificationBell';
import { isUnifiedStudentPath } from '../../utils/studentExperience';
import { useAuth } from '../../context/AuthContext';
import { getPageContext, getRoleNavigation } from '../../config/roleNavigation';

const icons = { Home, 'My Subjects': BookOpen, 'Study Sets': NotebookTabs, 'Study Together': UsersRound, 'Find Tutors': GraduationCap, Learning: BookOpen, 'Learning Hub': BookOpen, Sessions: CalendarDays, Messages: MessageCircle, Credits: Coins, Profile: UserRound, Settings };
const allLinks = getRoleNavigation('student').map(({ to, label }) => [to, label, icons[label]]);
const compactQuery = '(max-width: 1024px)';
const subscribeViewport = (changed) => {
  const media = window.matchMedia(compactQuery);
  media.addEventListener('change', changed);
  return () => media.removeEventListener('change', changed);
};
const readCompactViewport = () => window.matchMedia(compactQuery).matches;
export default function StudentNavigation() {
  const {freeLearning}=useAuth();
  const links=allLinks.filter(([to])=>!freeLearning||to!=='/credits');
  const compact = useSyncExternalStore(subscribeViewport, readCompactViewport, () => false);
  const location = useLocation();
  const page = getPageContext(location.pathname, location.search);
  const messageView = new URLSearchParams(location.search).get('view') === 'messages';
  const isAssessmentArea = location.pathname.replace(/\/$/, '') === '/assessments';
  const isStudyArea = location.pathname.startsWith('/study-sets');
  const isAiStudyArea = location.pathname === '/learning/ai-study' || location.pathname.startsWith('/learning/ai-study/');
  const isLearningArea = isAssessmentArea || isStudyArea || isAiStudyArea || location.pathname.replace(/\/$/, '') === '/learning';
  const modern = isUnifiedStudentPath(location.pathname);
  const primary = ['Home', 'My Subjects', 'Study Sets', 'Study Together'];
  const secondary = ['Profile', 'Messages', 'Settings'];
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('acadova_sidebar_collapsed') === '1'; } catch { return false; } });
  const [tooltip, setTooltip] = useState(null);
  const tooltipId = useId();
  const showTooltip = (event, to, label) => { if (!collapsed || compact) return; const row = event.currentTarget.getBoundingClientRect(); const rail = event.currentTarget.closest('aside').getBoundingClientRect(); setTooltip({ to, label, left: rail.right + 8, top: row.top + row.height / 2 }); };
  useEffect(() => { if (!tooltip) return; const hide = () => setTooltip(null); window.addEventListener('resize', hide); window.addEventListener('scroll', hide, true); return () => { window.removeEventListener('resize', hide); window.removeEventListener('scroll', hide, true); }; }, [tooltip]);
  const toggleSidebar = () => { setTooltip(null); setCollapsed(value => { try { localStorage.setItem('acadova_sidebar_collapsed', value ? '0' : '1'); } catch { /* Preference storage is optional. */ } return !value; }); };
  const messagesButton = useRef(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButton = useRef(null);
  const [more, setMore] = useState(false);
  const [acadiOpen, setAcadiOpen] = useState(false);
  const acadiButton = useRef(null);
  const acadiReturn = useRef(null);
  const openAcadi = target => { target?.focus(); acadiReturn.current = target; setMore(false); setTooltip(null); setAcadiOpen(true); };
  const closeAcadi = () => { setAcadiOpen(false); const target = acadiReturn.current; (target?.isConnected ? target : compact ? button.current : acadiButton.current)?.focus(); };
  const button = useRef(null);
  const renderLink = ([to, label, Icon]) => {
    const selected = to === '/dashboard#study-planning' ? location.pathname === '/dashboard' && location.hash === '#study-planning'
      : to === '/dashboard' ? location.pathname === '/dashboard'
      : to.includes('?') ? location.pathname === '/sessions' && messageView
      : to === '/study-together' ? ['/study-together','/tutors','/sessions','/dashboard/peer'].some(path => location.pathname === path || location.pathname.startsWith(path + '/'))
      : to === '/study-sets' ? isStudyArea || isAiStudyArea || location.pathname.startsWith('/study-share/')
      : to === '/learning' ? isLearningArea && !isStudyArea
      : to === '/sessions' ? location.pathname.startsWith('/sessions') && !messageView
      : location.pathname.replace(/\/$/, '') === to || location.pathname.startsWith(to + '/');
    return <Link key={to} to={to} aria-label={label} aria-describedby={collapsed && !compact && tooltip?.to === to ? tooltipId : undefined} onMouseEnter={event => showTooltip(event, to, label)} onMouseLeave={() => setTooltip(null)} onFocus={event => showTooltip(event, to, label)} onBlur={() => setTooltip(null)} onKeyDown={event => { if (event.key === 'Escape') setTooltip(null); }} title={collapsed && !compact ? label : undefined} aria-current={selected ? 'page' : undefined} className={`staff-nav-link${selected ? ' is-active' : ''}`} onClick={() => { setMore(false); setTooltip(null); }}><Icon size={19} aria-hidden="true"/><span className="ac-nav-label">{label}</span></Link>;
  };
  const navigation = (drawer = false) => <div className="ac-navigation-content">
    <div className="ac-sidebar-header">
      <Link to="/dashboard" className="staff-brand" aria-label="Acadova home" onClick={() => setMore(false)}><PublicBrandLogo symbol={collapsed && !compact}/></Link>
      {!compact && <button className="ac-sidebar-toggle" type="button" onClick={toggleSidebar} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} aria-controls="student-primary-nav">{collapsed ? <PanelLeftOpen size={20} aria-hidden="true"/> : <PanelLeftClose size={20} aria-hidden="true"/>}</button>}
    </div>
    {!drawer && <nav id={!compact ? 'student-primary-nav' : undefined} className="student-nav" aria-label="Student navigation">{links.filter(([,label]) => primary.includes(label)).map(renderLink)}</nav>}
    {compact && <nav className="ac-mobile-more-links" aria-label="More student destinations">{renderLink(['/dashboard#study-planning','Study Plan',CalendarDays])}{secondary.map(label => links.find(([,name]) => name === label)).map(renderLink)}{renderLink(['/growth','Growth',Layers])}{links.filter(([,label]) => !primary.includes(label) && !secondary.includes(label)).map(renderLink)}{renderLink(['/dashboard/peer','Peer dashboard',GraduationCap])}{renderLink(['/about','Help & support',BookOpen])}</nav>}
  </div>;
  return <>
    {tooltip && collapsed && !compact && createPortal(<div id={tooltipId} role="tooltip" className="student-rail-tooltip" style={{ left: tooltip.left, top: tooltip.top }}>{tooltip.label}</div>, document.body)}
    <a className="skip-link" href="#main-content">Skip to content</a>
    {!compact && <header className="student-utility-bar" aria-label="Global utilities">{modern ? <button className="ac-top-search" aria-label="Search Acadova" ref={searchButton} onClick={() => setSearchOpen(true)}><Search size={19} aria-hidden="true"/><span>Search subjects, tutors or learning topics...</span></button> : isLearningArea
      ? <nav className="utility-discovery-shortcut learning-shell-context" aria-label="Current learning area"><Link to="/learning" aria-current={!isAssessmentArea && !isStudyArea && !isAiStudyArea ? 'page' : undefined}><BookOpen size={18} aria-hidden="true" />Learning</Link>{(isAssessmentArea || isStudyArea || isAiStudyArea) && <><span aria-hidden="true">/</span><span aria-current="page">{isAiStudyArea ? 'AI Study Tools' : isStudyArea ? 'Study sets' : 'Assessments'}</span></>}</nav>
      : <span className="utility-discovery-shortcut" aria-current="page">{page.title}</span>}<nav aria-label="Student utilities"><button ref={searchButton} className="utility-link" type="button" aria-label="Search Acadova" onClick={() => setSearchOpen(true)}><Search size={20} aria-hidden="true" /></button><button className="utility-link" ref={messagesButton} type="button" aria-label="Messages" title="Messages" aria-haspopup="dialog" onClick={() => setMessagesOpen(true)}><MessageCircle size={20} aria-hidden="true" /></button><NotificationBell /><HeaderGrowth/><AccountMenu onOpenAcadi={openAcadi} /></nav></header>}
    <aside className={`student-sidebar ac-organized-sidebar${collapsed && !compact ? ' is-collapsed' : ''}`}>{navigation()}{!compact && <div className="acadi-sidebar-footer"><div className="acadi-sidebar-identity"><AcadiMark/><div><strong>Acadi</strong><small>Your learning companion</small></div></div><button ref={acadiButton} type="button" className="acadi-sidebar-launch" aria-label="Ask Acadi - navigation and help" aria-haspopup="dialog" title={collapsed ? 'Ask Acadi - navigation and help' : undefined} aria-describedby={tooltip?.to === 'acadi' ? tooltipId : undefined} onFocus={event => showTooltip(event, 'acadi', 'Ask Acadi - navigation and help')} onMouseEnter={event => showTooltip(event, 'acadi', 'Ask Acadi - navigation and help')} onMouseLeave={() => setTooltip(null)} onBlur={() => setTooltip(null)} onKeyDown={event => { if (event.key === 'Escape') setTooltip(null); }} onClick={() => openAcadi(acadiButton.current)}><AcadiMark/><span>Ask Acadi</span></button></div>}</aside>
    {compact && <header className="student-mobile-header"><Link to="/dashboard" className="staff-brand" aria-label="Acadova home"><PublicBrandLogo symbol /></Link>
      <div className="student-mobile-utilities"><button ref={searchButton} className="utility-link" type="button" aria-label="Search Acadova" onClick={() => setSearchOpen(true)}><Search size={20} aria-hidden="true" /></button><NotificationBell /><HeaderGrowth compact/><AccountMenu compact onOpenAcadi={openAcadi} /><button ref={messagesButton} className="utility-link" type="button" aria-label="Messages" aria-haspopup="dialog" onClick={() => setMessagesOpen(true)}><MessageCircle size={20} aria-hidden="true" /></button>
      <button className="student-more-trigger utility-link" aria-label="More navigation" ref={button} type="button" aria-expanded={more} onClick={() => setMore(true)}><Menu size={20} aria-hidden="true" /></button></div></header>}
    <nav className="student-mobile-bottom" aria-label="Primary navigation">{links.slice(0, 4).map(([to, label, Icon]) =>
      to === '/learning' ? <Link key={to} to={to} className={isLearningArea ? 'active' : undefined} aria-current={isLearningArea ? 'page' : undefined}><Icon size={20} aria-hidden="true" /><span>{label}</span></Link>
        : <NavLink key={to} to={to} end={to === '/dashboard'}><Icon size={20} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>
    <Modal isOpen={messagesOpen} title="Messages" className="messages-drawer" maxWidth="420px" onClose={() => { setMessagesOpen(false); messagesButton.current?.focus(); }}><SessionConversations onOpen={() => setMessagesOpen(false)} /></Modal>
    <Modal isOpen={searchOpen} title="Search Acadova" onClose={() => { setSearchOpen(false); searchButton.current?.focus(); }}><p>Find tutors by teaching skill, or search the published learning topic list.</p><p><Link to="/subjects" onClick={() => setSearchOpen(false)}>Search my private subjects</Link></p><DiscoverySearch onNavigate={() => setSearchOpen(false)} /></Modal>
    <Modal isOpen={more} title="Acadova navigation" onClose={() => { setMore(false); button.current?.focus(); }}>{navigation(true)}<button className="btn btn-secondary acadi-mobile-launch" type="button" onClick={() => openAcadi(button.current)}>Ask Acadi / Navigation &amp; help</button></Modal>
    <AcadiHelp isOpen={acadiOpen} onClose={closeAcadi}/>
  </>;
}
