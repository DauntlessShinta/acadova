import React from 'react';
import { Clock3, RefreshCw, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function DashboardHeader({ title, description, updatedAt, busy, onRefresh, refreshLabel = 'Refresh overview' }) {
  return <header className="dashboard-header"><div><h1>{title}</h1><p>{description}</p></div>
    <div className="dashboard-header-actions"><div className="dashboard-updated" role="status"><Clock3 size={20} aria-hidden="true" /><span>Last successful update<time dateTime={updatedAt || undefined}>{updatedAt ? new Date(updatedAt).toLocaleString() : 'Not yet available'}</time></span></div>
      <button type="button" className="btn btn-secondary dashboard-refresh-button" disabled={busy} onClick={onRefresh}><RefreshCw size={18} aria-hidden="true" className={busy ? 'refreshing-icon' : ''} />{busy ? 'Updating…' : refreshLabel}</button></div>
  </header>;
}

export function DashboardKpis({ items, loading = false }) {
  return <div className="dashboard-kpis stat-grid">{items.map(({ label, value, detail, icon: Icon, tone = 'blue' }) => <article className="card dashboard-kpi" key={label}>
    <span className={'dashboard-icon tone-' + tone}>{Icon && <Icon size={28} aria-hidden="true" />}</span>
    <div><h2>{label}</h2><strong className="dashboard-kpi-value tabular">{loading ? 'Loading…' : value == null ? 'Unavailable' : typeof value === 'number' ? value.toLocaleString() : value}</strong><p>{detail}</p></div>
  </article>)}</div>;
}

export function DashboardPanel({ title, description, icon: Icon, action, children, className = '' }) {
  return <section className={'card dashboard-panel ' + className}><header><div>{Icon && <Icon size={22} aria-hidden="true" />}<div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>{action}</header>{children}</section>;
}

export function PanelLink({ to, children = 'View all' }) {
  return <Link className="dashboard-panel-link" to={to}>{children}<ArrowRight size={16} aria-hidden="true" /></Link>;
}

export function RecordIcon({ icon: Icon, tone = 'blue', initials }) {
  return <span className={'record-avatar tone-' + tone} aria-hidden="true">{initials || (Icon && <Icon size={20} />)}</span>;
}
