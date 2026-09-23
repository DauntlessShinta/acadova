import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canAccessStaffArea, getRoleHomeRoute, getRoleNavigation } from '../config/roleNavigation';
import LoadingSpinner from '../components/common/LoadingSpinner';

export const StaffLayout = ({ area }) => {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeButtonRef = useRef(null);
  const menuButtonRef = useRef(null);
  const isAdminArea = area === 'admin';
  const allowed = canAccessStaffArea(user?.role, area);
  const links = getRoleNavigation(area);
  const current = links.find((link) => link.to === location.pathname)?.label || 'Overview';

  useEffect(() => {
    if (!menuOpen) return undefined;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

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
          <NavLink key={link.to} to={link.to} end className={({ isActive }) => `staff-nav-link${isActive ? ' is-active' : ''}`} onClick={() => setMenuOpen(false)}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="staff-sidebar-bottom">
        {!isAdminArea && user.role === 'admin' && (
          <Link to="/admin" className="staff-nav-link" onClick={() => setMenuOpen(false)}><ArrowLeft size={16} /> Administration</Link>
        )}
        <div className="staff-account"><ShieldCheck size={18} /><span><strong>{user.name || 'Staff account'}</strong><small>{user.role === 'admin' ? 'Administrator' : 'Moderator'}</small></span></div>
        <button type="button" className="staff-logout" onClick={handleLogout}><LogOut size={17} /> Log out</button>
      </div>
    </>
  );

  return (
    <div className="staff-workspace">
      <aside className="staff-sidebar">{nav}</aside>
      <div className="staff-workspace-content">
        <header className="staff-topbar">
          <button ref={menuButtonRef} type="button" className="staff-menu-button" aria-label="Open staff navigation" aria-expanded={menuOpen} aria-controls="staff-mobile-navigation" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <span><strong>{isAdminArea ? 'Administration' : 'Moderator'}</strong><small>{current}</small></span>
          <div className="staff-topbar-account"><ShieldCheck size={16} /> {user.name || 'Staff'}</div>
        </header>
        <main className="staff-content" id="main-content"><Outlet /></main>
        <footer className="staff-workspace-footer">Acadova · {isAdminArea ? 'Administration' : 'Moderator'} workspace</footer>
      </div>
      {menuOpen && (
        <div className="staff-drawer-layer" id="staff-mobile-navigation">
          <button type="button" className="staff-drawer-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
          <aside className="staff-drawer" role="dialog" aria-modal="true" aria-label="Staff navigation drawer">
            <button ref={closeButtonRef} type="button" className="staff-drawer-close" aria-label="Close navigation" onClick={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }}><X size={22} /></button>
            {nav}
          </aside>
        </div>
      )}
    </div>
  );
};

export default StaffLayout;
