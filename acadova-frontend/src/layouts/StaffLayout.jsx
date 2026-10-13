import React, { useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft, Layers, Menu, Home, Users, CalendarDays, BarChart3, Coins, ShieldCheck, Flag, FileCheck, BookOpen, Star, Settings, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canAccessStaffArea, getPageContext, getRoleHomeRoute, getRoleNavigation } from '../config/roleNavigation';
import LoadingSpinner from '../components/common/LoadingSpinner';
import AccountMenu from '../components/common/AccountMenu';
import Modal from '../components/common/Modal';
import NotificationBell from '../components/common/NotificationBell';
const icons = { Overview: Home, Users, Sessions: CalendarDays, Analytics: BarChart3, Credits: Coins,
  'Trust & Activity': ShieldCheck, Moderation: Flag, Assessments: FileCheck, 'Learning content': BookOpen,
  'Study-set reviews': Star, Settings, Reviews: MessageSquare, 'Session disputes': Flag };

export const StaffLayout = ({ area }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const isAdminArea = area === 'admin';
  const allowed = canAccessStaffArea(user?.role, area);
  const links = getRoleNavigation(area);
  const pageContext = getPageContext(location.pathname, location.search);
  const current = pageContext.title;



  if (loading) return <LoadingSpinner text="Checking account access..." size={36} />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!allowed) return <Navigate to={getRoleHomeRoute(user?.role)} replace />;

  const nav = (
    <>
      <Link to={isAdminArea ? '/admin' : '/moderator'} className="staff-brand" onClick={() => setMenuOpen(false)}>
        <span className="staff-brand-mark"><Layers size={22} /></span>
        <span><strong>Acadova</strong><small>{isAdminArea ? 'Administration' : 'Moderator'}</small></span>
      </Link>
      <nav className="staff-nav" aria-label={`${isAdminArea ? 'Administration' : 'Moderator'} sections`}>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end aria-current={pageContext.to === link.to ? 'page' : undefined} className={({ isActive }) => `staff-nav-link${isActive || pageContext.to === link.to ? ' is-active' : ''}`} onClick={() => setMenuOpen(false)}>
            {React.createElement(icons[link.label] || BookOpen, { size: 20, 'aria-hidden': true })}{link.label}
          </NavLink>
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
    <div className="staff-workspace">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="staff-sidebar">{nav}</aside>
      <div className="staff-workspace-content">
        <header className="staff-topbar">
          <button ref={menuButtonRef} type="button" className="staff-menu-button" aria-label="Open staff navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <span><strong>{isAdminArea ? 'Administration' : 'Moderator'}</strong><small>{current}</small></span>
          <NotificationBell />
          <div className="staff-topbar-account"><AccountMenu compact /></div>
        </header>
        <main className="staff-content" id="main-content" tabIndex={-1}><Outlet /></main>
        <footer className="staff-workspace-footer">Acadova · {isAdminArea ? 'Administration' : 'Moderator'} workspace</footer>
      </div>
      <Modal isOpen={menuOpen} onClose={() => setMenuOpen(false)} title="Staff navigation">{nav}</Modal>
    </div>
  );
};

export default StaffLayout;
