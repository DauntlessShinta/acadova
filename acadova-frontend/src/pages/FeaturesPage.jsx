import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Coins, Star, BarChart3 } from 'lucide-react';

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
            Learning and teaching
          </span>
          <h1 style={{ color: 'var(--navy-900)', marginBottom: '16px' }}>Platform Features</h1>
          <p style={{ color: 'var(--ink-600)', fontSize: '1.15rem' }}>
            Find peers by teaching skill, coordinate tutoring, explore learning materials, and review completed sessions.
          </p>
        </div>

        <div className="grid-2" style={{ marginBottom: '40px' }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--brass-100)', color: 'var(--brass-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Coins size={20} />
              </div>
              <h3 style={{ margin: 0, color: 'var(--navy-900)' }}>Recorded credit transfers</h3>
            </div>
            <p>
              Verified session settlement deducts the stored Session cost from the Learner and credits the Tutor together, with a transaction history. Credits are not reserved when requesting; the Learner must still have enough at settlement.
            </p>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--brass-100)', color: 'var(--brass-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={20} />
              </div>
              <h3 style={{ margin: 0, color: 'var(--navy-900)' }}>Subject activity for Admins</h3>
            </div>
            <p>
              Administrators can view subject demand from recorded Session requests. Analytics update when loaded or refreshed; they are not a live activity feed.
            </p>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--brass-100)', color: 'var(--brass-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={20} />
              </div>
              <h3 style={{ margin: 0, color: 'var(--navy-900)' }}>Guided Session workflow</h3>
            </div>
            <p>
              New Sessions follow request, schedule, both check in, Tutor finishes, both confirm, then completed. Participants can explicitly dispute an awaiting-confirmation or no-show Session for Moderator review. Older Sessions retain their compatibility flow.
            </p>
          </div>

          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--brass-100)', color: 'var(--brass-700)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Star size={20} />
              </div>
              <h3 style={{ margin: 0, color: 'var(--navy-900)' }}>Reviews tied to Sessions</h3>
            </div>
            <p>
              Reviews require an eligible completed and settled Session. Each participant can submit one review per Session. Moderators can hide inappropriate reviews; hidden reviews do not contribute to public reputation.
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link to="/register" className="btn btn-primary btn-lg">
            Start learning
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FeaturesPage;
