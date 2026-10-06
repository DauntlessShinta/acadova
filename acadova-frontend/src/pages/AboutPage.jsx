import React from 'react';
import { Link } from 'react-router-dom';
import { Award } from 'lucide-react';

export const AboutPage = () => {
  return (
    <div className="public-info-page">
      <div className="container-narrow">
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--brass-600)',
            display: 'block',
            marginBottom: '10px',
          }}>
            About Acadova
          </span>
          <h1 style={{ color: 'var(--navy-900)', marginBottom: '16px' }}>How Acadova works</h1>
          <p style={{ color: 'var(--ink-600)', fontSize: '1.15rem', lineHeight: 1.6 }}>
            Learn from fellow Students, share skills you can teach, and explore self-paced learning with Acadova Credits.
          </p>
        </div>

        <div className="card" style={{ marginBottom: '32px' }}>
          <h3 style={{ color: 'var(--navy-900)', marginBottom: '14px' }}>The Problem</h3>
          <p>
            Students in technical disciplines frequently encounter roadblocks in demanding subjects like algorithms, database systems, and networking. Commercial private tutoring platforms charge steep hourly rates that create financial disparities among undergraduates.
          </p>
          <p>
            Concurrently, those same students often possess mastery in other subjects (e.g. web development or calculus) that could directly unlock a fellow peer's academic breakthrough.
          </p>
        </div>

        <div className="card" style={{ marginBottom: '32px' }}>
          <h3 style={{ color: 'var(--navy-900)', marginBottom: '14px' }}>Our Solution: Reciprocal Credit Sharing</h3>
          <p>
            Acadova replaces direct monetary payments with an internal learning credit ledger. Students teach peers to earn credits, and spend those credits when requesting tutoring from others.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '20px' }}>
            <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <div className="mono" style={{ fontWeight: 700, color: 'var(--brass-700)', marginBottom: 4 }}>Starting credit grant</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--ink-600)' }}>Eligible new Students receive the configured starting grant after email verification (default: 100 credits).</div>
            </div>
            <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <div className="mono" style={{ fontWeight: 700, color: 'var(--brass-700)', marginBottom: 4 }}>Atomic Credit Transfer</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--ink-600)' }}>A verified session transfers credits after both participants confirm, or after a valid Moderator resolution. Credits are not reserved when a request is sent.</div>
            </div>
            <div style={{ background: 'var(--bg-subtle)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <div className="mono" style={{ fontWeight: 700, color: 'var(--brass-700)', marginBottom: 4 }}>Reviews after verified sessions</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--ink-600)' }}>Eligible participants can review a completed, settled session once. Visible reviews contribute to peer reputation.</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ background: 'var(--navy-900)', color: '#ffffff', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--brass-300)', marginBottom: 12 }}>
            <Award size={20} />
            <h3 style={{ color: '#ffffff', margin: 0 }}>United Nations SDG 4 Alignment</h3>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.95rem' }}>
            Acadova explicitly supports <strong>Sustainable Development Goal 4: Quality Education</strong> by removing economic barriers to academic support and providing collaborative teaching opportunities that deepen student subject mastery.
          </p>
        </div>

        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <Link to="/register" className="btn btn-primary btn-lg">
            Join Acadova
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
