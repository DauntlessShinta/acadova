import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layers, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleHomeRoute, normalizeRole } from '../../config/roleNavigation';
import NotificationBell from './NotificationBell';
import AccountMenu from './AccountMenu';

const publicLinks = [
  { to: '/#how-it-works', label: 'How It Works' },
  { to: '/#credit-system', label: 'Credit Model' },
  { to: '/#features', label: 'Features' },
  { to: '/#skill-network', label: 'Explore Skills' },
  { to: '/about', label: 'About' },
];

const roleLabels = {
  moderator: 'Moderator',
  admin: 'Administration',
};

export const Navbar = () => {
  const { user, isAuthenticated, credits } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuTrigger = useRef(null);
  const role = normalizeRole(user?.role);
  const isStudent = role === 'student';
  const homeRoute = isAuthenticated ? getRoleHomeRoute(role) : '/';
  const links = isAuthenticated ? [{ to: homeRoute, label: 'Back to workspace' }] : publicLinks;

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && mobileMenuOpen) { setMobileMenuOpen(false); menuTrigger.current?.focus(); }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (location.hash) {
      window.requestAnimationFrame(() => {
        document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      });
    }
  }, [location.pathname, location.hash]);

  const isLinkActive = (to) => {
    const [pathname, hash = ''] = to.split('#');
    const expectedHash = hash ? `#${hash}` : '';
    return location.pathname === pathname && location.hash === expectedHash;
  };

  return (
    <header className={`site-navbar ${isAuthenticated && !isStudent ? 'site-navbar-staff' : ''}`}>
      <div className="container site-navbar-inner">
        <Link to={homeRoute} className="site-brand" aria-label={`Acadova ${roleLabels[role] || 'home'}`} onClick={() => setMobileMenuOpen(false)}>
          <span className="site-brand-mark"><Layers size={20} /></span>
          <span className="site-brand-copy">
            <span>Acadova</span>
            {isAuthenticated && roleLabels[role] && <small>{roleLabels[role]}</small>}
          </span>
        </Link>

        <nav className="site-nav-desktop" aria-label={isAuthenticated ? `${role} navigation` : 'Primary navigation'}>
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMobileMenuOpen(false)}
              aria-current={isLinkActive(link.to) ? 'page' : undefined}
              className={`site-nav-link ${isLinkActive(link.to) ? 'is-active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="site-nav-actions">
          {!isAuthenticated ? (
            <>
              <Link to="/login" className="btn btn-secondary btn-sm">Log In</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          ) : (
            <>
              <NotificationBell />
              {isStudent && <Link to="/credits" className="credit-pill"><span className="dot" />{credits} Credits</Link>}
              <AccountMenu />
            </>
          )}
        </div>

        <button
          ref={menuTrigger}
          type="button"
          className="site-menu-button"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="site-mobile-menu"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? <X size={23} /> : <Menu size={23} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <nav id="site-mobile-menu" className="site-nav-mobile" aria-label="Mobile navigation">
          <div className="container">
            {isAuthenticated && (
              <div className="site-mobile-user">
                <div>
                  <strong>{user?.name || 'User'}</strong>
                  <span>{user?.email}</span>
                  {!isStudent && <span className="site-mobile-role">{roleLabels[role]}</span>}
                </div>
                {isStudent && <span className="credit-pill"><span className="dot" />{credits} Credits</span>}
              </div>
            )}

            <div className="site-mobile-links">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={isLinkActive(link.to) ? 'page' : undefined}
                  className={isLinkActive(link.to) ? 'is-active' : ''}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {!isAuthenticated ? (
              <div className="site-mobile-actions">
                <Link to="/login" className="btn btn-secondary" onClick={() => setMobileMenuOpen(false)}>Log In</Link>
                <Link to="/register" className="btn btn-primary" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
              </div>
            ) : (
              <AccountMenu />
            )}
          </div>
        </nav>
      )}
    </header>
  );
};

export default Navbar;
