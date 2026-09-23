import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Layers, LogOut, Menu, ShieldCheck, User, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleHomeRoute, getRoleNavigation, normalizeRole } from '../../config/roleNavigation';

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
  const { user, isAuthenticated, credits, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const role = normalizeRole(user?.role);
  const isStudent = role === 'student';
  const homeRoute = isAuthenticated ? getRoleHomeRoute(role) : '/';
  const links = isAuthenticated ? getRoleNavigation(role) : publicLinks;

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  useEffect(() => {
    if (location.hash) {
      window.requestAnimationFrame(() => {
        document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [location.pathname, location.hash]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
              className={`site-nav-link ${isAuthenticated && isLinkActive(link.to) ? 'is-active' : ''}`}
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
              {isStudent ? (
                <>
                  <Link to="/credits" className="credit-pill"><span className="dot" />{credits} Credits</Link>
                  <Link to="/profile" className="site-user-link" title={user?.email}>
                    <User size={16} /><span>{user?.name || 'User'}</span>
                  </Link>
                </>
              ) : (
                <div className="site-staff-identity" title={user?.email}>
                  <ShieldCheck size={16} />
                  <span><strong>{user?.name || 'Staff'}</strong><small>{roleLabels[role]}</small></span>
                </div>
              )}
              <button type="button" className="site-logout-button" onClick={handleLogout} aria-label="Log out">
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>

        <button
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
                  className={isAuthenticated && isLinkActive(link.to) ? 'is-active' : ''}
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
              <button type="button" className="btn btn-danger site-mobile-logout" onClick={handleLogout}>
                <LogOut size={16} /> Log Out
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
};

export default Navbar;
