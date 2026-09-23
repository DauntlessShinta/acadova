import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Clock, Coins, Star, Zap, ShieldCheck, Database, BarChart3, CheckCircle2 } from 'lucide-react';

export const FeaturesPage = () => {
  return (
    <div style={{ padding: '60px 0 80px' }}>
      <div className="container">
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 54px' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--brass-600)',
            display: 'block',
            marginBottom: '10px',
          }}>
            Technical & Functional Capabilities
          </span>
          <h1 style={{ color: 'var(--navy-900)', marginBottom: '16px' }}>Platform Features</h1>
          <p style={{ color: 'var(--ink-600)', fontSize: '1.15rem' }}>
            A deep dive into the architecture powering smart tutor matching, atomic transactions, and MapReduce analytics.
          </p>
        </div>

        <div className="grid-2" style={{ marginBottom: '40px' }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--brass-100)', color: 'var(--brass-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Coins size={20} />
              </div>
              <h3 style={{ margin: 0, color: 'var(--navy-900)' }}>Atomic Credit Escrow Engine</h3>
            </div>
            <p>
              Credit balances are never incremented or decremented casually. Acadova uses MongoDB multi-document transactions to ensure that credits deduct from the learner and credit to the tutor in a single atomic database operation upon session completion.
            </p>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--brass-100)', color: 'var(--brass-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={20} />
              </div>
              <h3 style={{ margin: 0, color: 'var(--navy-900)' }}>MapReduce Subject Analytics</h3>
            </div>
            <p>
              Platform administrators can monitor real-time academic demand through a 3-stage MapReduce implementation (Map sessions to key-value pairs → Group identical subjects → Reduce sum totals) to identify high-demand curriculum subjects.
            </p>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--brass-100)', color: 'var(--brass-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={20} />
              </div>
              <h3 style={{ margin: 0, color: 'var(--navy-900)' }}>Structured Session State Machine</h3>
            </div>
            <p>
              Sessions strictly transition through valid state boundaries (<span className="badge badge-pending">pending</span> → <span className="badge badge-navy">accepted</span> → <span className="badge badge-success">completed</span> or <span className="badge badge-danger">cancelled</span>). Strict ownership guards prevent unauthorized party manipulation.
            </p>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--brass-100)', color: 'var(--brass-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Star size={20} />
              </div>
              <h3 style={{ margin: 0, color: 'var(--navy-900)' }}>Double-Blind Peer Rating System</h3>
            </div>
            <p>
              Reviews require a completed session ID and enforce a unique compound index (session + rater), guaranteeing that scores cannot be spammed, artificially inflated, or forged without real participation.
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link to="/register" className="btn btn-primary btn-lg">
            Start Learning Today (+2 Credits)
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FeaturesPage;

