import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Layers, LogOut, Menu, ShieldAlert, User, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const publicLinks = [
  { to: '/#how-it-works', label: 'How It Works' },
  { to: '/#credit-system', label: 'Credit Model' },
  { to: '/#features', label: 'Features' },
  { to: '/#skill-network', label: 'Explore Skills' },
  { to: '/#dashboard-preview', label: 'Dashboard Preview' },
  { to: '/about', label: 'About' },
];

const appLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tutors', label: 'Find Tutors' },
  { to: '/sessions', label: 'My Sessions' },
  { to: '/credits', label: 'Credits' },
  { to: '/profile', label: 'Profile' },
];

export const Navbar = () => {
  const { user, isAuthenticated, isAdmin, credits, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMenu = () => setMobileMenuOpen(false);

  const links = isAuthenticated ? appLinks : publicLinks;

  return (
    <header className="site-navbar">
      <div className="container site-navbar-inner">
        <Link to={isAuthenticated ? '/dashboard' : '/'} className="site-brand" aria-label="Acadova home" onClick={closeMenu}>
          <span className="site-brand-mark"><Layers size={20} /></span>
          <span>Acadova</span>
        </Link>

        <nav className="site-nav-desktop" aria-label="Primary navigation">
          {links.map((link) => (
            isAuthenticated ? (
              <NavLink key={link.to} to={link.to} onClick={closeMenu} className={({ isActive }) => `site-nav-link ${isActive ? 'is-active' : ''}`}>
                {link.label}
              </NavLink>
            ) : (
              <Link key={link.to} to={link.to} onClick={closeMenu} className="site-nav-link">{link.label}</Link>
            )
          ))}
          {isAuthenticated && isAdmin && (
            <NavLink to="/admin" onClick={closeMenu} className={({ isActive }) => `site-nav-link site-nav-admin ${isActive ? 'is-active' : ''}`}>
              <ShieldAlert size={14} /> Admin
            </NavLink>
          )}
        </nav>

        <div className="site-nav-actions">
          {!isAuthenticated ? (
            <>
              <Link to="/login" onClick={closeMenu} className="btn btn-secondary btn-sm">Log In</Link>
              <Link to="/register" onClick={closeMenu} className="btn btn-primary btn-sm">Get Started</Link>
            </>
          ) : (
            <>
              <Link to="/credits" onClick={closeMenu} className="credit-pill"><span className="dot" />{credits} Credits</Link>
              <Link to="/profile" onClick={closeMenu} className="site-user-link" title={user?.email}>
                <User size={16} /><span>{user?.name || 'User'}</span>
              </Link>
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
                <div><strong>{user?.name || 'User'}</strong><span>{user?.email}</span></div>
                <span className="credit-pill"><span className="dot" />{credits} Credits</span>
              </div>
            )}

            <div className="site-mobile-links">
              {links.map((link) => (
                <Link key={link.to} to={link.to} onClick={closeMenu}>{link.label}</Link>
              ))}
              {isAuthenticated && isAdmin && <Link to="/admin" onClick={closeMenu} className="site-nav-admin">Admin Analytics</Link>}
            </div>

            {!isAuthenticated ? (
              <div className="site-mobile-actions">
                <Link to="/login" onClick={closeMenu} className="btn btn-secondary">Log In</Link>
                <Link to="/register" onClick={closeMenu} className="btn btn-primary">Get Started</Link>
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
