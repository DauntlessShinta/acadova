import React from 'react';
import { Link, Outlet } from 'react-router-dom';
import { ArrowRightLeft, BookOpen, Coins, Layers, Network, Sparkles } from 'lucide-react';

export const AuthLayout = () => (
  <main className="auth-shell">
    <section className="auth-brand-panel" aria-label="About Acadova">
      <Link to="/" className="auth-brand-link" aria-label="Acadova home"><span><Layers size={23} /></span><strong>Acadova</strong></Link>
      <div className="auth-brand-content">
        <span className="auth-eyebrow"><Sparkles size={15} /> Peer learning, made personal</span>
        <h1>Learn what you need.<br />Teach what you know.</h1>
        <p>Find student peers, share your strengths, and grow together through skill exchange and learning credits.</p>
        <div className="auth-visual" aria-hidden="true">
          <div className="auth-visual-heading"><Network size={18} /> Your knowledge network</div>
          <div className="auth-skill-grid"><span>Java</span><span>Networking</span><span>Mathematics</span><span>React</span></div>
          <div className="auth-exchange"><span><BookOpen size={17} /> Learn</span><ArrowRightLeft size={19} /><span><Coins size={17} /> Teach & earn</span></div>
        </div>
      </div>
      <small className="auth-brand-foot">Learn · Teach · Exchange · Grow</small>
    </section>
    <section className="auth-form-panel" aria-label="Account access"><div className="auth-form-inner"><Outlet /></div></section>
  </main>
);

export default AuthLayout;
