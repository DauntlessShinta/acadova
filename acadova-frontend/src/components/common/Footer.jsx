import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Layers } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getRoleHomeRoute } from '../../config/roleNavigation';
import PublicBrandLogo from './PublicBrandLogo';

export const Footer = () => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const isStaff = isAuthenticated && (user?.role === 'admin' || user?.role === 'moderator');

  if (isStaff) {
    const areaLabel = user.role === 'admin' ? 'Administration' : 'Moderator';
    return (
      <footer className="staff-footer">
        <div className="container staff-footer-inner">
          <Link to={getRoleHomeRoute(user.role)} className="site-brand" aria-label={`Acadova ${areaLabel}`}>
            <span className="site-brand-mark"><Layers size={18} /></span>
            <span>Acadova <small>{areaLabel}</small></span>
          </Link>
          <span>Authorized staff workspace</span>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`site-footer ${!isAuthenticated && location.pathname === '/' ? 'landing-public-footer' : ''}`}>
      <div className="container">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <Link to="/" className={`site-brand ${!isAuthenticated ? 'public-brand-link public-brand-footer' : ''}`} aria-label="Acadova home">
              {!isAuthenticated ? <PublicBrandLogo /> : <><span className="site-brand-mark"><Layers size={19} /></span>
              <span>Acadova</span></>}
            </Link>
            <p>Peer-to-peer academic skill and knowledge sharing, powered by reciprocal learning credits.</p>
            <span className="site-footer-purpose"><BookOpen size={15} /> Supporting accessible, student-led learning</span>
          </div>

          <div>
            <h2>Platform</h2>
            <ul>
              <li><Link to="/#how-it-works">How It Works</Link></li>
              <li><Link to="/#credit-system">Credit Model</Link></li>
              <li><Link to="/#features">Features</Link></li>
              <li><Link to={!isAuthenticated ? "/#dashboard-preview" : "/features"}>{!isAuthenticated ? "Dashboard Preview" : "Platform features"}</Link></li>
              <li><Link to="/about">About Acadova</Link></li>
            </ul>
          </div>

          <div>
            <h2>{!isAuthenticated ? "Explore Skills" : "Learning"}</h2>
            <ul>
              {!isAuthenticated ? ['Web Development', 'Mathematics', 'Networking', 'Cybersecurity', 'Databases'].map((skill) =>
                <li key={skill}><Link to="/#skill-network">{skill}</Link></li>) : <>
                <li><Link to="/tutors">Find Tutors</Link></li>
                <li><Link to="/learning">Learning library</Link></li>
                <li><Link to="/#features">Two ways to learn</Link></li>
              </>}
            </ul>
          </div>

          <div>
            <h2>Learning & Trust</h2>
            <ul>
              <li><Link to="/#community">{!isAuthenticated ? "Community Reputation" : "Community accountability"}</Link></li>
              <li><Link to="/#sdg-section">SDG 4 Quality Education</Link></li>
              {!isAuthenticated && <><li><span>Credit-based exchange</span></li><li><span>Peer accountability</span></li></>}
              <li><Link to="/community-guidelines">Community Guidelines</Link></li>
            </ul>
          </div>
        </div>

        <div className="site-footer-bottom">
          <span>© {new Date().getFullYear()} Acadova. Built for collaborative student learning.</span>
          <span><Link to="/terms">Terms of Use</Link> · <Link to="/privacy">Privacy Policy</Link></span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
