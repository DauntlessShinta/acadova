import React, { useRef, useState, useSyncExternalStore } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BookOpen, CalendarDays, Coins, GraduationCap, Home, Layers, Menu, MessageCircle, Search, User } from 'lucide-react';
import SessionConversations from '../student/SessionConversations';
import DiscoverySearch from './DiscoverySearch';
import { useAuth } from '../../context/AuthContext';
import Modal from './Modal';
import AccountMenu from './AccountMenu';
import NotificationBell from './NotificationBell';
import { getRoleNavigation } from '../../config/roleNavigation';

const icons = { Home, 'Find Tutors': GraduationCap, Learning: BookOpen, Sessions: CalendarDays, Messages: MessageCircle, Credits: Coins, Profile: User };
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
  const { credits } = useAuth();
  const messagesButton = useRef(null);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchButton = useRef(null);
  const [more, setMore] = useState(false);
  const button = useRef(null);
  const navigation = <>
    <Link to="/dashboard" className="staff-brand"><span className="staff-brand-mark"><Layers size={22} aria-hidden="true" /></span><strong>Acadova</strong></Link>
    <nav className="student-nav" aria-label="Student navigation" onClick={(event) => { if (event.target.closest('a')) setMore(false); }}>{links.map(([to, label, Icon]) => {
      const selected = to.includes('?') ? location.pathname === '/sessions' && location.search.includes('view=messages')
        : to === '/sessions' ? location.pathname.startsWith('/sessions') && !location.search.includes('view=messages')
          : location.pathname === to || location.pathname.startsWith(to + '/');
      return <Link key={to} to={to} aria-current={selected ? 'page' : undefined}
        className={`staff-nav-link${selected ? ' is-active' : ''}`}><Icon size={19} aria-hidden="true" />{label}</Link>;
    })}</nav>
    <div className="student-sidebar-bottom"><Link className="staff-nav-link" to="/about" onClick={() => setMore(false)}>How Acadova works</Link>{compact && <div className="student-more-account"><AccountMenu /></div>}</div>
  </>;
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {!compact && <header className="student-utility-bar" aria-label="Global utilities"><Link className="utility-discovery-shortcut" to="/tutors"><GraduationCap size={18} aria-hidden="true" />Find Tutors</Link><nav aria-label="Student utilities"><button ref={searchButton} className="utility-link" type="button" aria-label="Search Acadova" onClick={() => setSearchOpen(true)}><Search size={20} aria-hidden="true" /></button><button className="utility-link" ref={messagesButton} type="button" aria-label="Messages" title="Messages" aria-haspopup="dialog" onClick={() => setMessagesOpen(true)}><MessageCircle size={20} aria-hidden="true" /></button><NotificationBell /><Link className="utility-credits" to="/credits"><Coins size={18} aria-hidden="true" /><span>{credits} Credits</span></Link><AccountMenu /></nav></header>}
    <aside className="student-sidebar">{navigation}</aside>
    {compact && <header className="student-mobile-header"><Link to="/dashboard" className="staff-brand" aria-label="Acadova home"><Layers size={23} aria-hidden="true" /><strong>Acadova</strong></Link>
      <div className="student-mobile-utilities"><button ref={searchButton} className="utility-link" type="button" aria-label="Search Acadova" onClick={() => setSearchOpen(true)}><Search size={20} aria-hidden="true" /></button><NotificationBell /><AccountMenu compact /><button ref={messagesButton} className="utility-link" type="button" aria-label="Messages" aria-haspopup="dialog" onClick={() => setMessagesOpen(true)}><MessageCircle size={20} aria-hidden="true" /></button>
      <button className="student-more-trigger utility-link" aria-label="More navigation" ref={button} type="button" aria-expanded={more} onClick={() => setMore(true)}><Menu size={20} aria-hidden="true" /></button></div></header>}
    <nav className="student-mobile-bottom" aria-label="Primary navigation">{links.slice(0, 4).map(([to, label, Icon]) =>
      <NavLink key={to} to={to} end={to === '/dashboard'}><Icon size={20} aria-hidden="true" /><span>{label}</span></NavLink>)}</nav>
    <Modal isOpen={messagesOpen} title="Messages" className="messages-drawer" maxWidth="420px" onClose={() => { setMessagesOpen(false); messagesButton.current?.focus(); }}><SessionConversations onOpen={() => setMessagesOpen(false)} /></Modal>
    <Modal isOpen={searchOpen} title="Search Acadova" onClose={() => { setSearchOpen(false); searchButton.current?.focus(); }}><p>Find tutors by teaching skill, or search the published learning topic list.</p><DiscoverySearch onNavigate={() => setSearchOpen(false)} /></Modal>
    <Modal isOpen={more} title="Acadova navigation" onClose={() => { setMore(false); button.current?.focus(); }}>{navigation}</Modal>
  </>;
}
