import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Info, RefreshCw, ShieldCheck } from 'lucide-react';
import { recentRange, rangeError } from '../../utils/analyticsPresentation';
import { groupTrend } from '../../utils/staffPresentation';

export function StaffPeriod({ range, onChange, invalid }) {
  const key = `${range.from}:${range.to}`;
  const [state, setState] = useState({ ...range, key });
  const [error, setError] = useState('');
  const details = useRef(null);
  const draft = state.key === key ? state : range;
  const edit = (field, value) => setState({ ...draft, [field]: value, key });
  return <div className="staff-period-control" aria-label="Analytics period">
    <div className="staff-period-presets" role="group" aria-label="Selected activity period">{[7, 30, 90].map(days => {
      const next = recentRange(days);
      return <button type="button" key={days} aria-pressed={range.from === next.from && range.to === next.to} onClick={() => { setError(''); onChange(next); if (details.current) details.current.open = false; }}>Last {days} days</button>;
    })}</div>
    <details className="staff-period-custom" ref={details} open={invalid ? true : undefined}><summary><CalendarDays size={16} aria-hidden="true"/><span>{invalid ? 'Correct date range' : `${range.from} — ${range.to}`}</span></summary>
      <form onSubmit={event => { event.preventDefault(); const message = rangeError(draft); setError(message); if (!message) { onChange({ from: draft.from, to: draft.to }); details.current.open = false; } }}>
        <label>From (UTC)<input type="date" required value={draft.from} onChange={event => edit('from', event.target.value)}/></label>
        <label>To (UTC)<input type="date" required value={draft.to} onChange={event => edit('to', event.target.value)}/></label>
        <p className="form-error" role="alert">{error || invalid}</p><button className="btn btn-primary btn-sm">Apply period</button>
      </form>
    </details>
  </div>;
}

export function StaffPageHeader({ title, description, scope, period, busy, refresh, updatedAt }) {
  return <><header className="staff-premium-header"><div><h1>{title}</h1><p>{description}</p><span className="staff-scope"><ShieldCheck size={15} aria-hidden="true"/>{scope}</span></div>
    <div className="staff-premium-header-actions">{period && <StaffPeriod {...period}/>}<button className="staff-icon-button" type="button" disabled={busy || Boolean(period?.invalid)} aria-label="Refresh dashboard" title="Refresh dashboard" onClick={refresh}><RefreshCw size={18} aria-hidden="true" className={busy ? 'refreshing-icon' : ''}/></button></div>
  </header><p className="sr-only" role="status">{busy ? 'Updating dashboard...' : updatedAt ? 'Dashboard updated' : 'Dashboard not yet loaded'}</p></>;
}

export function StaffNotes({ children }) {
  return <footer className="staff-data-footer"><span><Info size={16} aria-hidden="true"/>Counts use recorded events. Dates are inclusive UTC.</span><span>{children || 'Session completion does not verify meeting attendance.'}</span></footer>;
}

// Small code-native charts retain exact values in a keyboard-accessible table.
export function StaffLineChart({ rows, series }) {
  const container = useRef(null);
  const [width, setWidth] = useState(635);
  const hasActivity = rows.some(row => series.some(item => row[item.key] > 0));
  useEffect(() => {
    if (!hasActivity || !container.current) return;
    // Keep the chart coordinate system in CSS pixels: small panels must not
    // shrink axis text together with a fixed desktop-size SVG.
    const element = container.current;
    const measure = () => {
      if (element.isConnected) setWidth(Math.max(160, Math.round(element.getBoundingClientRect().width)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasActivity]);
  const max = Math.ceil(Math.max(1, ...rows.flatMap(row => series.map(item => row[item.key] || 0))) / 4) * 4;
  if (!hasActivity) return <p className="staff-chart-empty">No recorded activity in this period.</p>;
  const right = width - 22;
  const x = index => 34 + index * (right - 34) / Math.max(1, rows.length - 1);
  const y = value => 160 - value / max * 140;
  const labelStep = Math.ceil((rows.length - 1) / Math.max(1, Math.floor((width - 56) / 100)));
  return <div className="staff-line-chart" ref={container}><div className="staff-chart-legend">{series.map((item, index) => <span key={item.key}><i className={'staff-series-' + index}/>{item.label}</span>)}</div>
    <svg viewBox={`0 0 ${width} 190`} role="img" aria-label="Recorded daily activity; exact values in the following table">
      {[0, .25, .5, .75, 1].map(fraction => <g key={fraction}><line x1="34" x2={right} y1={y(max * fraction)} y2={y(max * fraction)} className="staff-chart-grid"/><text x="28" y={y(max * fraction) + 4} textAnchor="end">{Number((max * fraction).toFixed(1))}</text></g>)}
      <polygon className="staff-chart-area" points={`34,160 ${rows.map((row, i) => `${x(i)},${y(row[series[0].key] || 0)}`).join(' ')} ${right},160`}/>
      {series.map((item, index) => <g key={item.key}><polyline className={'staff-line staff-series-' + index} points={rows.map((row, i) => `${x(i)},${y(row[item.key] || 0)}`).join(' ')}/>{rows.length === 1 && <circle className={'staff-point staff-series-' + index} cx={x(0)} cy={y(rows[0][item.key] || 0)} r="4"/>}</g>)}
      {rows.filter((_, i) => i === 0 || i === rows.length - 1 || (i % labelStep === 0 && i < rows.length - 1 - labelStep / 2)).map(row => <text key={row.date} x={x(rows.indexOf(row))} y="184" textAnchor="middle">{row.date.slice(5)}</text>)}
    </svg><details className="staff-chart-values"><summary>View exact daily values</summary><div className="table-responsive" tabIndex={0} role="region" aria-label="Daily recorded values"><table className="table"><thead><tr><th>Date (UTC)</th>{series.map(item => <th key={item.key}>{item.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.date}><th scope="row">{row.date}</th>{series.map(item => <td key={item.key}>{row[item.key] || 0}</td>)}</tr>)}</tbody></table></div></details>
  </div>;
}

export function StaffBars({ rows, vertical = false }) {
  const max = Math.max(1, ...rows.map(row => row.value));
  return <dl className={vertical ? 'staff-bars is-vertical' : 'staff-bars'}>{rows.map((row, index) => <div key={row.key || row.label}><dt>{row.label}</dt><dd><span className={'staff-bar staff-series-' + index % 3} style={{ [vertical ? 'height' : 'width']: vertical ? row.value / max * 120 : `${row.value / max * 100}%` }}/><strong>{row.value.toLocaleString()}</strong></dd></div>)}</dl>;
}

export function StaffStackedChart({ rows, series }) {
  const grouped = groupTrend(rows, 7);
  const max = Math.max(1, ...grouped.map(row => series.reduce((sum, item) => sum + row[item.key], 0)));
  return <div><div className="staff-chart-legend">{series.map((item, index) => <span key={item.key}><i className={'staff-series-' + index}/>{item.label}</span>)}</div>
    <dl className="staff-stacked-bars">{grouped.map(row => <div key={row.date}><dt>{row.date.slice(5)}<span className="sr-only">{row.date !== row.through ? ` through ${row.through}` : ''}</span></dt><dd><strong>{series.reduce((sum, item) => sum + row[item.key], 0)}</strong><div>{series.map((item, index) => <span key={item.key} className={'staff-stack-' + index} style={{ height: `${row[item.key] / max * 100}%` }}><span className="sr-only">{item.label}: {row[item.key]}</span></span>)}</div></dd></div>)}</dl>
    <p className="staff-small-note">{grouped.some(row => row.date !== row.through) ? 'Consecutive UTC days grouped; totals preserved.' : 'Recorded outcomes by UTC day.'} Exact daily values are available in the throughput table.</p>
  </div>;
}
