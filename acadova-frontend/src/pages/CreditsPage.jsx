import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import creditService from '../services/creditService';
import StatCard from '../components/common/StatCard';
import Badge from '../components/common/Badge';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import {
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  GraduationCap,
  BookOpen,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  History,
} from 'lucide-react';

export const CreditsPage = () => {
  const { credits, refreshUser } = useAuth();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCreditHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await creditService.getMyCreditHistory();
      setHistory(res?.data || []);
      await refreshUser();
    } catch (err) {
      setError(err.message || 'Failed to load credit history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreditHistory();
  }, []);

  const totalEarned = history
    .filter((tx) => tx.direction === 'earned')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  const totalSpent = history
    .filter((tx) => tx.direction === 'spent')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0);

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '28px',
      }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--brass-600)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Internal Currency
          </span>
          <h1 style={{ fontSize: '2rem', color: 'var(--navy-900)', margin: '4px 0 0' }}>
            Credit Wallet & Ledger
          </h1>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={fetchCreditHistory}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'spinner' : ''} /> Refresh Ledger
        </button>
      </div>

      <Alert type="danger" message={error} onClose={() => setError('')} />

      {/* METRICS ROW */}
      <div className="stat-grid" style={{ marginBottom: '32px' }}>
        <StatCard
          title="Available Balance"
          value={`${credits} Credits`}
          subtitle="Ready to spend on learning"
          icon={Coins}
          color="var(--brass-600)"
        />
        <StatCard
          title="Total Credits Earned"
          value={`+${totalEarned} Credits`}
          subtitle="Earned through peer tutoring"
          icon={ArrowUpRight}
          color="var(--success-text)"
        />
        <StatCard
          title="Total Credits Spent"
          value={`-${totalSpent} Credits`}
          subtitle="Reinvested in your education"
          icon={ArrowDownLeft}
          color="var(--navy-700)"
        />
      </div>

      {/* HOW CREDITS WORK CARD */}
      <div className="card" style={{ marginBottom: '32px', background: 'linear-gradient(180deg, #ffffff 0%, var(--brass-50) 100%)', border: '1px solid var(--brass-300)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Sparkles size={20} color="var(--brass-600)" />
          <h3 style={{ margin: 0, color: 'var(--navy-900)', fontSize: '1.2rem' }}>
            The 100% Cashless Knowledge Cycle
          </h3>
        </div>
        <p style={{ color: 'var(--ink-700)', fontSize: '0.92rem', marginBottom: '20px' }}>
          Acadova eliminates cash fees to ensure equal academic access. Here is how your academic credits flow:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{ background: '#ffffff', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--brass-700)', fontWeight: 700, marginBottom: 4 }}>
              1. TEACH PEERS
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-600)', margin: 0 }}>
              Share your mastery in topics you know. Completing a session earns you +1 to +2 credits.
            </p>
          </div>

          <div style={{ background: '#ffffff', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--brass-700)', fontWeight: 700, marginBottom: 4 }}>
              2. STORE CREDITS
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-600)', margin: 0 }}>
              Credits stay securely in your wallet with permanent ledger audit records.
            </p>
          </div>

          <div style={{ background: '#ffffff', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--brass-700)', fontWeight: 700, marginBottom: 4 }}>
              3. REINVEST & LEARN
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-600)', margin: 0 }}>
              Spend credits to get 1-on-1 tutoring in demanding subjects from qualified peers.
            </p>
          </div>
        </div>
      </div>

      {/* TRANSACTION LEDGER TABLE */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={18} color="var(--brass-600)" />
            <h3 style={{ margin: 0, color: 'var(--navy-900)', fontSize: '1.2rem' }}>
              Transaction Ledger History
            </h3>
          </div>
          <span className="badge badge-navy">{history.length} Record{history.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <LoadingSpinner text="Retrieving transaction audit ledger..." size={32} />
        ) : history.length === 0 ? (
          <EmptyState
            icon={Coins}
            title="No credit transactions yet"
            description="Complete study sessions as a learner or tutor to see ledger entries."
            actionText="Find Peers to Begin"
            onAction={() => window.location.href = '/tutors'}
          />
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Subject / Reason</th>
                  <th>Counterparty</th>
                  <th>Direction</th>
                  <th style={{ textAlign: 'right' }}>Credit Amount</th>
                </tr>
              </thead>
              <tbody>
                {history.map((tx) => (
                  <tr key={tx.id}>
                    <td className="mono" style={{ fontSize: '0.82rem', color: 'var(--ink-500)' }}>
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--navy-900)' }}>
                      {tx.subject || 'Session Exchange'}
                    </td>
                    <td>
                      {tx.counterparty || 'Peer User'}
                    </td>
                    <td>
                      <Badge status={tx.direction}>
                        {tx.direction === 'earned' ? 'Earned (Taught)' : 'Spent (Learned)'}
                      </Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        className="mono"
                        style={{
                          fontWeight: 700,
                          fontSize: '1rem',
                          color: tx.direction === 'earned' ? 'var(--success-text)' : 'var(--brass-700)',
                        }}
                      >
                        {tx.direction === 'earned' ? `+${tx.amount}` : `-${tx.amount}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditsPage;
