import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowRightLeft, BookOpen, Network, Sparkles } from 'lucide-react';
import PublicBrandLogo from '../components/common/PublicBrandLogo';

export const AuthLayout = () => {
  const { pathname } = useLocation();
  const isRegister = pathname.replace(/\/$/, '') === '/register';
  const BrandHeading = isRegister ? 'p' : 'h1';
  return (
  <main className={`auth-shell${isRegister ? ' auth-shell--register' : ''}`}>
    <section className="auth-brand-panel" aria-label="About Acadova">
      <Link to="/" className="auth-brand-link" aria-label="Acadova home"><PublicBrandLogo /></Link>
      <div className="auth-brand-content">
        <span className="auth-eyebrow"><Sparkles size={15} /> A workspace for your learning</span>
        <BrandHeading className={isRegister ? 'register-brand-heading' : undefined}>Organize your subjects.<br />Build your study routine.</BrandHeading>
        <p>Keep class materials together, create practice, and collaborate with peers when you need help.</p>
        <div className="auth-visual" aria-hidden="true">
          <div className="auth-visual-heading"><Network size={18} /> Your learning workspace</div>
          <div className="auth-skill-grid"><span>Subjects</span><span>Materials</span><span>Flashcards</span><span>Quizzes</span></div>
          <div className="auth-exchange"><span><BookOpen size={17} /> Learn</span><ArrowRightLeft size={19} /><span><BookOpen size={17} /> Practice</span></div>
        </div>
      </div>
      <small className="auth-brand-foot">Organize &middot; Practise &middot; Collaborate</small>
    </section>
    <section className="auth-form-panel" aria-label="Account access"><div className="auth-form-inner"><Outlet />
      {!isRegister && <p className="auth-policy-links"><Link to="/terms">Terms of Use</Link> · <Link to="/privacy">Privacy Policy</Link> · <Link to="/community-guidelines">Community Guidelines</Link></p>}
    </div></section>
  </main>
);
};

export default AuthLayout;
