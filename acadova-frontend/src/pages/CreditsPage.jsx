import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import creditService from '../services/creditService';
import StatCard from '../components/common/StatCard';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Coins, ArrowUpRight, ArrowDownLeft, RefreshCw, History } from 'lucide-react';
import CreditActivityList from '../components/credits/CreditActivityList';
import './CreditsPage.css';

export const CreditsPage = () => {
  const { credits, refreshUser } = useAuth();
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({ recordedEarned: 0, recordedSpent: 0 });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCreditHistory = useCallback(async (nextPage = 1) => {
    try {
      setLoading(true);
      setError('');
      const res = await creditService.getMyCreditHistory(nextPage);
      setHistory((previous) => nextPage === 1 ? (res?.data || []) : [...previous, ...(res?.data || [])]);
      setSummary(res?.summary || { recordedEarned: 0, recordedSpent: 0 });
      setPage(nextPage);
      setHasMore(Boolean(res?.pagination?.hasMore));
      await refreshUser();
    } catch (err) {
      setError(err.message || 'Failed to load credit activity');
    } finally {
      setLoading(false);
    }
  }, [refreshUser]);

  useEffect(() => {
    const initialLoad = setTimeout(() => { fetchCreditHistory(); }, 0);
    return () => clearTimeout(initialLoad);
  }, [fetchCreditHistory]);

  return (
    <div>
      <div className="credit-wallet-heading">
        <div>
          <span className="credit-wallet-eyebrow">Acadova credits</span>
          <h1>Credit wallet</h1>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => fetchCreditHistory()} disabled={loading}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <Alert type="danger" message={error} onClose={() => setError('')} />
      <div className="stat-grid credit-wallet-balance">
        <StatCard title="Available credits" value={`${credits} credits`}
          subtitle="Current spendable balance" icon={Coins} color="var(--brass-600)" />
        <StatCard title="Recorded earned" value={`${summary.recordedEarned} credits`}
          subtitle="Incoming ledger activity" icon={ArrowUpRight} color="var(--success-text)" />
        <StatCard title="Recorded spent" value={`${summary.recordedSpent} credits`}
          subtitle="Outgoing ledger activity" icon={ArrowDownLeft} color="var(--brass-700)" />
      </div>
      <p className="credit-wallet-note">
        Credits support learning on Acadova and have no cash value. Your balance comes from your account;
        recorded earned and spent cover ledger activity only. Older starting balances may not have a matching activity entry.
      </p>

      <section className="card" aria-labelledby="credit-history-heading">
        <div className="credit-history-heading">
          <History size={18} color="var(--brass-600)" />
          <h2 id="credit-history-heading">Credit activity</h2>
        </div>
        {loading && page === 1 ? <LoadingSpinner text="Loading credit activity..." size={32} />
          : <CreditActivityList history={history} />}
        {hasMore && <button type="button" className="btn btn-secondary btn-sm"
          onClick={() => fetchCreditHistory(page + 1)} disabled={loading}>
          {loading ? 'Loading...' : 'Load more activity'}
        </button>}
      </section>
    </div>
  );
};

export default CreditsPage;
