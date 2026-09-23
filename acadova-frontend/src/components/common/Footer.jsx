import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Layers } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer-grid">
          <div className="site-footer-brand">
            <Link to="/" className="site-brand" aria-label="Acadova home">
              <span className="site-brand-mark"><Layers size={19} /></span>
              <span>Acadova</span>
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
              <li><Link to="/#dashboard-preview">Dashboard Preview</Link></li>
              <li><Link to="/about">About Acadova</Link></li>
            </ul>
          </div>

          <div>
            <h2>Explore Skills</h2>
            <ul>
              <li><Link to="/#skill-network">Web Development</Link></li>
              <li><Link to="/#skill-network">Mathematics</Link></li>
              <li><Link to="/#skill-network">Networking</Link></li>
              <li><Link to="/#skill-network">Cybersecurity</Link></li>
              <li><Link to="/#skill-network">Databases</Link></li>
            </ul>
          </div>

          <div>
            <h2>Learning & Trust</h2>
            <ul>
              <li><Link to="/#community">Community Reputation</Link></li>
              <li><Link to="/#sdg-section">SDG 4 Quality Education</Link></li>
              <li><span>Credit-based exchange</span></li>
              <li><span>Peer accountability</span></li>
            </ul>
          </div>
        </div>

        <div className="site-footer-bottom">
          <span>© {new Date().getFullYear()} Acadova. Built for collaborative student learning.</span>
          <span>Learn. Teach. Exchange. Grow.</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
