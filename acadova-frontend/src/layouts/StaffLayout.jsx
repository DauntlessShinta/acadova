import React, { useRef, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu, PanelLeftClose, PanelLeftOpen, Search, Home, Users, CalendarDays, BarChart3, Coins, ShieldCheck, Flag, FileCheck, BookOpen, Star, Settings, MessageSquare } from 'lucide-react';
import PublicBrandLogo from '../components/common/PublicBrandLogo';
import { useAuth } from '../context/AuthContext';
import { canAccessStaffArea, getPageContext, getRoleHomeRoute, getStaffWorkspaceGroups, staffWorkspaceGroup } from '../config/roleNavigation';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AccountMenu from '../components/common/AccountMenu';
import Modal from '../components/common/Modal';
import NotificationBell from '../components/common/NotificationBell';
import '../components/staff/staffDashboard.css';
const icons = { Queue: Flag, 'Learning Content': BookOpen, 'Users & Roles': Users, Catalog: BookOpen, Escalations: Flag, 'Policies & Settings': Settings, 'Audit Log': ShieldCheck, Overview: Home, Users, Sessions: CalendarDays, Analytics: BarChart3, Credits: Coins,
  'Trust & Activity': ShieldCheck, Moderation: Flag, Assessments: FileCheck, 'Learning content': BookOpen,
  'Study-set reviews': Star, Settings, Reviews: MessageSquare, 'Session disputes': Flag };

export const StaffLayout = ({ area }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const dashboardRoute = ['/admin', '/admin/analytics', '/moderator', '/moderator/analytics'].includes(location.pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const isAdminArea = area === 'admin';
  const allowed = canAccessStaffArea(user?.role, area);
  const links = getStaffWorkspaceGroups(area);
  const group = staffWorkspaceGroup(area, location.pathname, location.search, location.hash);
  const [collapsed, setCollapsed] = useState(false);
  const pageContext = getPageContext(location.pathname, location.search);
  const current = pageContext.title;



  if (loading) return <LoadingSpinner text="Checking account access..." size={36} />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!allowed) return <Navigate to={getRoleHomeRoute(user?.role)} replace />;

  const nav = (
    <>
      <Link to={isAdminArea ? '/admin' : '/moderator'} className="staff-brand" aria-label="Acadova home" onClick={() => setMenuOpen(false)}>
        <PublicBrandLogo symbol={collapsed} />
        {!collapsed && <small>{isAdminArea ? 'Administration' : 'Moderator'}</small>}
      </Link>
      <nav className="staff-nav" aria-label={`${isAdminArea ? 'Administration' : 'Moderator'} sections`}>
        {links.map((link) => (
          <Link key={link.to} to={link.to} aria-label={link.label} title={collapsed ? link.label : undefined} aria-current={group?.label === link.label ? 'page' : undefined} className={`staff-nav-link${group?.label === link.label ? ' is-active' : ''}`} onClick={() => setMenuOpen(false)}>
            {React.createElement(icons[link.label] || BookOpen, { size: 20, 'aria-hidden': true })}<span className="staff-nav-label">{link.label}</span>
          </Link>
        ))}
      </nav>
      <div className="staff-sidebar-bottom">
        {!isAdminArea && user.role === 'admin' && (
          <Link to="/admin" className="staff-nav-link" onClick={() => setMenuOpen(false)}><ArrowLeft size={16} /> Administration</Link>
        )}
        <Link to="/about" className="staff-nav-link">How Acadova works</Link>
        <AccountMenu />
      </div>
    </>
  );

  return (
    <div className={`staff-workspace staff-premium${collapsed ? ' is-collapsed' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="staff-sidebar"><button className="ac-sidebar-toggle staff-collapse-toggle" type="button" aria-label={collapsed ? 'Expand staff sidebar' : 'Collapse staff sidebar'} title={collapsed ? 'Expand staff sidebar' : 'Collapse staff sidebar'} aria-expanded={!collapsed} onClick={() => setCollapsed(value => !value)}>{collapsed ? <PanelLeftOpen size={18} aria-hidden="true"/> : <PanelLeftClose size={18} aria-hidden="true"/>}</button>{nav}</aside>
      <div className="staff-workspace-content">
        <header className="staff-topbar">
          <button ref={menuButtonRef} type="button" className="staff-menu-button" aria-label="Open staff navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <form className="staff-header-search" role="search" onSubmit={event => { event.preventDefault(); navigate((isAdminArea ? '/admin/users' : '/moderator/study-sets') + (search.trim() ? '?q=' + encodeURIComponent(search.trim()) : '')); }}><Search size={18} aria-hidden="true"/><label className="sr-only" htmlFor="staff-header-search">{isAdminArea ? 'Search user accounts' : 'Search submitted Study Sets'}</label><input id="staff-header-search" type="search" maxLength={80} value={search} onChange={event => setSearch(event.target.value)} placeholder={isAdminArea ? 'Search user accounts...' : 'Search submitted Study Sets...'}/><button type="submit" className="sr-only">Search</button></form><span className="sr-only">{current}</span>
          <NotificationBell />
          <div className="staff-topbar-account"><AccountMenu compact /></div>
        </header>
        <main className="staff-content" id="main-content" tabIndex={-1}>{group && !dashboardRoute && <nav className="staff-context-nav" aria-label={`${group.label} destinations`}>{group.items.map(([to,label]) => <Link key={to} to={to} aria-current={location.pathname + location.search + location.hash === to ? 'page' : undefined}>{label}</Link>)}</nav>}<Outlet /></main>
        <footer className="staff-workspace-footer">Acadova · {isAdminArea ? 'Administration' : 'Moderator'} workspace</footer>
      </div>
      <Modal isOpen={menuOpen} onClose={() => setMenuOpen(false)} title="Staff navigation">{nav}</Modal>
    </div>
  );
};

export default StaffLayout;
