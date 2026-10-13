import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import analyticsService from '../../services/analyticsService';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const labels = {
  'security.login_cooldown_started': 'Login cooldown started',
  'security.login_cooldown_extended': 'Login cooldown extended',
  'security.login_success_after_failures': 'Successful login after failed attempts',
  'security.suspended_account_login_attempt': 'Suspended account attempted login',
};

export default function AdminSecurityPage() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('24h');
  const [category, setCategory] = useState('all');
  const [account, setAccount] = useState('');
  const [searchAccount, setSearchAccount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accountError, setAccountError] = useState('');
  const version = useRef(0);
  const load = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    setData(null); setError('');
    try {
      const result = await analyticsService.getSecurityOverview({ period, category,
        ...(searchAccount ? { account: searchAccount } : {}) });
      if (version.current === current) setData(result.data);
    } catch { if (version.current === current) setError('Security activity could not be loaded. Try again.'); }
    finally { if (version.current === current) setLoading(false); }
  }, [period, category, searchAccount]);
  useEffect(() => { Promise.resolve().then(load); return () => { version.current += 1; }; }, [load]);
  return <div className="staff-page"><header className="staff-page-header"><div>
    <span className="staff-eyebrow">Administration / Security</span><h1>Security Center</h1>
    <p>Monitor login cooldowns, successful recovery and suspended-account attempts. Audit Logs hold the broader history of administrative and moderation actions. This is not live intrusion detection.</p>
  </div></header><Alert type="danger" message={error} />
    <div className="card staff-queue-filters">
      <label>Time <select className="form-select" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option></select></label>
      <label>Event <select className="form-select" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All security events</option><option value="cooldown">Cooldown</option><option value="login">Login recovery</option><option value="suspension">Suspended login</option></select></label>
      <form onSubmit={(event) => { event.preventDefault(); const value = account.trim(); if (value && !/^[a-f\d]{24}$/i.test(value)) { setAccountError('Enter a valid 24-character account ID.'); document.getElementById('security-account')?.focus(); return; } setAccountError(''); setSearchAccount(value); }}><label htmlFor="security-account">Account ID (optional)</label>
        <div className="staff-inline-search"><input id="security-account" className="form-input" maxLength={24} aria-invalid={Boolean(accountError)} aria-describedby={accountError ? 'security-account-error' : undefined} value={account} onChange={(event) => setAccount(event.target.value)} placeholder="Exact account ID" /><button className="btn btn-secondary btn-sm">Search</button></div>{accountError && <p className="form-error" id="security-account-error" role="alert">{accountError}</p>}</form>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setAccount(''); setSearchAccount(''); setAccountError(''); setPeriod('24h'); setCategory('all'); }}>Clear filters</button>
      <Link to="/admin/audit-logs" className="btn btn-secondary btn-sm">Browse audit history</Link>
    </div>
    {loading ? <LoadingSpinner text="Loading security activity..." /> : error ? <p className="staff-data-note">Security activity is unavailable. <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Retry</button></p> : data && <>
      <section className="staff-queue-summary card" aria-label="Platform-wide security counts for the last 24 hours">
        <strong>{data.counts.cooldownStarted} cooldowns started</strong>
        <strong>{data.counts.cooldownExtended} cooldowns extended</strong>
        <strong>{data.counts.activeCooldowns} active cooldowns now</strong>
        <strong>{data.counts.recoveredLogins} successful logins after failures</strong>
        <strong>{data.counts.suspendedAttempts} suspended-account attempts</strong>
      </section>
      <h2>Recent security events</h2>
      {data.events.length ? <div className="staff-queue-list">{data.events.map((event) =>
        <article className="card" key={event.id}><h3>{labels[event.action] || 'Security event'}</h3>
          <p>Account: {event.accountId || 'System'} · {event.createdAt ? new Date(event.createdAt).toLocaleString() : 'Time unavailable'}</p>
        </article>)}</div> : <p className="card">No recorded events match these filters.</p>}
      <p className="form-hint">Counts are platform-wide for the last 24 hours; the event list follows your filters. Unknown-account and rate-limit events are not persisted in the current AuditLog.</p>
    </>}
  </div>;
}
