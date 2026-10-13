import React, { useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ShieldCheck, LockKeyhole, Users, FileCheck, Clock3, Search, CheckCircle2 } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import Alert from '../../components/common/Alert';
import WorkflowTabs from '../../components/common/WorkflowTabs';
import { DashboardHeader, DashboardKpis, DashboardPanel, PanelLink, RecordIcon } from '../../components/staff/DashboardPrimitives';
import { useDashboardData } from '../../utils/useDashboardData';
import { useSearchDraft } from '../../utils/useSearchDraft';
import { recentRange, rangeError } from '../../utils/analyticsPresentation';
import { readableTime, eventLabel, initials } from '../../utils/staffPresentation';
import { auditActions, securityActions, targets, trustTab, trustAuditQuery, legacyTrustUrl } from '../../utils/trustActivity';

const sources = [
  ['summary', analyticsService.getTrustSummary],
  ['records', async (query, options) => {
    if (query.tab === 'protection') return { data: null };
    const response = await analyticsService.getAuditLogs(trustAuditQuery(query), options);
    return { data: { rows: response.data || [], pagination: response.pagination } };
  }],
  ['protection', (query, options) => analyticsService.getSecurityOverview({ period: query.period || '24h',
    category: query.securityCategory || 'all', ...(query.targetId ? { account: query.targetId } : {}) }, options)],
];
const securityLabels = { 'security.login_cooldown_started': 'Cooldown started', 'security.login_cooldown_extended': 'Cooldown extended',
  'security.login_success_after_failures': 'Login recovered', 'security.suspended_account_login_attempt': 'Suspended login attempt' };
function RecordedMetadata({ metadata }) {
  const fields = ['resolution', 'direction', 'amount', 'reference', 'creditCost', 'beforeVersion', 'afterVersion', 'previousRole', 'newRole', 'hidden', 'previousStatus', 'newStatus'];
  const values = fields.filter(key => metadata && ['string', 'number', 'boolean'].includes(typeof metadata[key]));
  return values.length ? <details><summary>Recorded details</summary><dl className="trust-metadata">{values.map(key => <div key={key}><dt>{key.replace(/([a-z])([A-Z])/g, '$1 $2')}</dt><dd>{String(metadata[key])}</dd></div>)}</dl></details> : null;
}

export function LegacyTrustRoute() {
  const location = useLocation();
  return <Navigate to={legacyTrustUrl(location.pathname, location.search)} replace />;
}

function ExactIdFilter({ params, setParams, name, id, label, button }) {
  const key = params.toString(); const [draft, setDraft] = useState(null); const value = draft?.key === key ? draft.value : params.get(name) || '';
  const [error, setError] = useState('');
  return <form className="audit-actor-filter" onSubmit={event => {
    event.preventDefault(); const text = value.trim();
    if (text && !/^[a-f\d]{24}$/i.test(text)) { setError('Enter a valid 24-character record ID.'); document.getElementById(id)?.focus(); return; }
    setError(''); const next = new URLSearchParams(params); if (text) next.set(name, text); else next.delete(name); next.delete('page'); setParams(next);
  }}><label htmlFor={id}>{label}</label><div className="staff-inline-search"><input id={id} className="form-input" value={value} maxLength={24} aria-invalid={Boolean(error)} aria-describedby={error ? id + '-error' : undefined} onChange={event => { setDraft({ key, value: event.target.value }); setError(''); }} placeholder="Optional exact ID" /><button className="btn btn-secondary btn-sm">{button}</button></div>{error && <p className="form-error" id={id + '-error'} role="alert">{error}</p>}</form>;
}

export default function TrustActivityPage() {
  const [params, setParams] = useSearchParams(); const tab = trustTab(params); const search = useSearchDraft(params, setParams);
  const range = recentRange(7); const from = params.get('from') || range.from; const to = params.get('to') || range.to;
  const periodKey = `${from}:${to}`; const [dateDraft, setDateDraft] = useState(null); const dates = dateDraft?.key === periodKey ? dateDraft : { from, to };
  const [dateError, setDateError] = useState('');
  const query = { ...Object.fromEntries(params), tab, from, to };
  const { data, loading, busy, error, updatedAt, refresh } = useDashboardData(sources, query, !rangeError({ from, to }));
  const summary = data.summary; const protection = data.protection; const records = data.records;
  const category = params.get('category') || ''; const action = params.get('action') || '';
  const change = (name, value) => { const next = new URLSearchParams(params); if (value) next.set(name, value); else next.delete(name); if (name !== 'page') next.delete('page'); setParams(next); };
  const selectTab = value => { const next = new URLSearchParams(params); next.set('tab', value); ['category', 'action', 'actor', 'targetType', 'targetId', 'securityCategory', 'page', 'q'].forEach(key => next.delete(key)); search.change(''); setParams(next); };
  const securityGroup = params.get('securityCategory') || 'all';
  const allowedActions = (tab === 'activity' ? auditActions.filter(value => !value.startsWith('security.')) : securityActions)
    .filter(value => tab === 'activity' ? !category || value.startsWith(category + '.')
      : securityGroup === 'all' || (securityGroup === 'cooldown' ? value.includes('cooldown') : securityGroup === 'login' ? value.includes('success_after_failures') : value.includes('suspended')));
  return <div className="staff-page operations-dashboard trust-dashboard">
    <DashboardHeader title="Trust & Activity" description="Review recorded administrative actions and account login-protection events." updatedAt={updatedAt} busy={busy} onRefresh={refresh} refreshLabel="Refresh data" />
    <Alert type="danger" message={error || rangeError({ from, to })} />
    <><span className="sr-only" role="status">{loading ? 'Loading Trust and Activity...' : ''}</span>
      <DashboardKpis loading={loading} items={[
        { label: 'Protection Events', value: summary?.protectionEvents, detail: 'Recorded login signals · Last 24 hours', icon: LockKeyhole, tone: 'red' },
        { label: 'Role Changes', value: summary?.roleChanges, detail: 'Recorded changes · Last 24 hours', icon: Users, tone: 'blue' },
        { label: 'Admin Actions', value: summary?.adminActions, detail: 'Account and credit actions · Last 24 hours', icon: FileCheck, tone: 'violet' },
        { label: 'Active Cooldowns', value: summary?.activeCooldowns, detail: 'Accounts currently in login cooldown', icon: Clock3, tone: 'amber' },
      ]} />
      <div className="dashboard-panel-grid">
        <DashboardPanel title="Recorded Login Protection" description={params.get('period') === '7d' ? 'Selected events from the last 7 days.' : 'Selected events from the last 24 hours.'} icon={LockKeyhole}
          action={<button className="dashboard-panel-link" onClick={() => selectTab('security')}>View events</button>}>
          {!protection ? <p className="dashboard-empty">Login-protection records unavailable.</p> : !protection.events.length ? <p className="dashboard-empty">No recorded protection events in this view.</p> : <ul className="dashboard-records">{protection.events.slice(0, 5).map(row => <li key={row.id} className="dashboard-record"><RecordIcon icon={ShieldCheck} tone="blue" /><div className="record-copy"><strong>{securityLabels[row.action] || eventLabel(row.action)}</strong><time dateTime={row.createdAt}>{readableTime(row.createdAt)}</time></div></li>)}</ul>}
        </DashboardPanel>
        <DashboardPanel title="Account Protection" icon={ShieldCheck} action={<PanelLink to="/admin/users">Manage access</PanelLink>}>
          <ul className="dashboard-records protection-facts">{[
            ['Authenticated access', 'JWT authentication and database-backed role checks'],
            ['Login cooldowns', 'Temporary progressive protection; successful login resets counters'],
            ['Recorded staff decisions', 'Audit records for supported account, credit and moderation actions'],
          ].map(([title, detail]) => <li key={title} className="dashboard-record"><CheckCircle2 size={21} aria-hidden="true" /><div className="record-copy"><strong>{title}</strong><p>{detail}</p></div><span className="dashboard-status">Implemented</span></li>)}</ul>
        </DashboardPanel>
      </div>
      <section className="card trust-record-panel">
        <WorkflowTabs id="trust" tabs={[[ 'activity', 'Activity Logs' ], [ 'security', 'Security Events' ], [ 'protection', 'Login Protection' ]]} active={tab} onChange={selectTab} />
        {['activity', 'security'].map(view => <div key={view} id={'trust-panel-' + view} role="tabpanel" aria-labelledby={'trust-tab-' + view} hidden={tab !== view}>
          {tab === view && <>
            <div className="trust-filters"><label className="trust-search"><span className="sr-only">Search recorded activity</span><Search size={18} aria-hidden="true" /><input type="search" className="form-input" maxLength={80} placeholder={tab === 'activity' ? 'Search events, staff names or record IDs…' : 'Search events or account IDs…'} value={search.value} onChange={event => search.change(event.target.value)} /></label>
              {tab === 'activity' ? <label>Category<select className="form-select" value={category} onChange={event => { const next = new URLSearchParams(params); if (event.target.value) next.set('category', event.target.value); else next.delete('category'); next.delete('action'); next.delete('page'); setParams(next); }}><option value="">All categories</option>{['user', 'credit', 'session', 'study', 'learning', 'review'].map(value => <option key={value}>{value}</option>)}</select></label>
                : <label>Security event group<select className="form-select" value={params.get('securityCategory') || 'all'} onChange={event => { const next = new URLSearchParams(params); next.set('securityCategory', event.target.value); next.delete('action'); next.delete('page'); setParams(next); }}><option value="all">All security events</option><option value="cooldown">Cooldown</option><option value="login">Login recovery</option><option value="suspension">Suspended login</option></select></label>}
              <label>Action<select className="form-select" value={action} onChange={event => change('action', event.target.value)}><option value="">All actions in category</option>{allowedActions.map(value => <option key={value} value={value}>{eventLabel(value)}</option>)}</select></label>
              <button className="btn btn-secondary btn-sm" onClick={() => { search.change(''); setParams({ tab }); }}>Clear filters</button>
            </div>
            <details className="trust-advanced" open={params.has('actor') || params.has('targetId') || params.has('targetType') ? true : undefined}><summary>Dates and exact record filters</summary><div className="staff-filter-bar">
              <form className="trust-date-form" onSubmit={event => { event.preventDefault(); const message = rangeError(dates); setDateError(message); if (message) return; const next = new URLSearchParams(params); next.set('from', dates.from); next.set('to', dates.to); next.delete('page'); next.delete('period'); setParams(next); }}><label>From (UTC)<input className="form-input" type="date" required value={dates.from} onChange={event => setDateDraft({ ...dates, from: event.target.value, key: periodKey })} /></label><label>To (UTC)<input className="form-input" type="date" required value={dates.to} onChange={event => setDateDraft({ ...dates, to: event.target.value, key: periodKey })} /></label><button className="btn btn-secondary btn-sm">Apply dates</button>{dateError && <p className="form-error" role="alert">{dateError}</p>}</form>
              {tab === 'activity' && <ExactIdFilter params={params} setParams={setParams} name="actor" id="audit-actor" label="Actor ID" button="Apply actor" />}
              <ExactIdFilter params={params} setParams={setParams} name="targetId" id="security-account" label={tab === 'security' ? 'Affected account ID' : 'Target record ID'} button="Apply account" />
              {tab === 'activity' && <label>Target type<select className="form-select" value={params.get('targetType') || ''} onChange={event => change('targetType', event.target.value)}><option value="">All types</option>{targets.map(value => <option key={value}>{value}</option>)}</select></label>}
            </div></details>
            <p className="trust-filter-summary" role="status">{tab === 'security' && params.has('period') ? `Last ${params.get('period') === '7d' ? '7 days' : '24 hours'}, rolling window` : `${from} through ${to}, inclusive UTC`} · {records?.pagination?.total ?? 'Unavailable'} matching recorded events</p>
            {!records ? <p className="dashboard-empty">Activity records unavailable. Refresh to retry.</p> : <>
              <div className="table-responsive trust-table-scroll" tabIndex={0} role="region" aria-label="Recorded activity. Scroll horizontally to view all columns."><table className="table trust-table"><thead><tr><th scope="col">Time</th><th scope="col">Actor</th><th scope="col">Event</th><th scope="col">Category</th><th scope="col">Target</th><th scope="col">Record</th></tr></thead><tbody>{records.rows.map(row => <tr key={row._id}><td><time dateTime={row.createdAt}>{readableTime(row.createdAt)}</time></td><td><div className="trust-actor"><RecordIcon icon={Users} initials={initials(row.actor?.name)} /><span><strong>{row.actorRole === 'system' ? 'System' : row.actor?.name || 'Former staff account'}</strong><small>{row.actorRole}</small></span></div></td><td><strong>{eventLabel(row.action)}</strong><p>{row.summary}</p><RecordedMetadata metadata={row.metadata} />{(row.metadata?.reason || row.metadata?.suspensionReason) && <details><summary>Recorded decision reason</summary><p>{row.metadata.reason || row.metadata.suspensionReason}</p></details>}</td><td><span className="dashboard-status">{row.action.split('.')[0]}</span></td><td>{row.targetType}<details><summary>Record references</summary><code>{row.targetId}</code>{row.actor?._id && <p>Actor: <code>{row.actor._id}</code></p>}</details></td><td><span className="dashboard-status">Recorded</span></td></tr>)}</tbody></table></div>
              {!records.rows.length && <p className="dashboard-empty">No matching audit records.</p>}
              <div className="trust-pagination"><button className="btn btn-secondary btn-sm" disabled={busy || (records.pagination?.page || 1) <= 1} onClick={() => change('page', String((records.pagination?.page || 1) - 1))}>Previous</button><span>Page {records.pagination?.page || 1} · {records.pagination?.total || 0} records</span><button className="btn btn-secondary btn-sm" disabled={busy || (records.pagination?.page || 1) * (records.pagination?.limit || 25) >= (records.pagination?.total || 0)} onClick={() => change('page', String((records.pagination?.page || 1) + 1))}>Next</button></div>
            </>}
          </>}
        </div>)}
        <div id="trust-panel-protection" role="tabpanel" aria-labelledby="trust-tab-protection" hidden={tab !== 'protection'}>
          {tab === 'protection' && <div className="login-protection-panel"><h2>Login Protection</h2><p>Recorded account protection and temporary login cooldowns. No permanent lock is inferred.</p>
            <div className="staff-filter-bar"><label>Event period<select className="form-select" value={params.get('period') || '24h'} onChange={event => change('period', event.target.value)}><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option></select></label><ExactIdFilter params={params} setParams={setParams} name="targetId" id="protection-account" label="Affected account ID" button="Apply account" /></div>
            {protection ? <dl className="protection-counts">{[['Cooldowns started', 'cooldownStarted'], ['Cooldowns extended', 'cooldownExtended'], ['Active cooldowns now', 'activeCooldowns'], ['Successful logins after failures', 'recoveredLogins'], ['Suspended-account attempts', 'suspendedAttempts']].map(([label, key]) => <div key={key}><dt>{label}</dt><dd className="tabular">{protection.counts[key]}</dd></div>)}</dl> : <p className="dashboard-empty">Protection information unavailable.</p>}
            <PanelLink to="/admin/users">Review account access</PanelLink><p className="form-hint">Counts are platform-wide for the last 24 hours, except active cooldowns which are current. The recorded-event list follows its selected filters. Unknown-account failures and rate-limit events are not persisted in the current Audit Log. Normal login attempts are not a complete security incident feed.</p>
          </div>}
        </div>
      </section>
      <details className="dashboard-help"><summary>Record coverage and refresh</summary><p>Summary cards use recorded events from the last 24 hours or current cooldown counts; table filters do not change those definitions. Administrative records are not backfilled for actions before audit logging began. Each page has at most 25 records. Refresh checks occur every 45 seconds while visible, with the last complete successful refresh shown above.</p><p>Account-protection descriptions reflect implemented application code, not proof of live provider configuration. Two-factor authentication, anomaly detection and an enterprise incident system are not represented here.</p></details>
    </>
  </div>;
}
