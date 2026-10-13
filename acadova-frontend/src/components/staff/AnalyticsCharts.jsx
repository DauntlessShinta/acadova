import React from 'react';
import EmptyState from '../common/EmptyState';
import { BarChart3 } from 'lucide-react';

export function ComparisonChart({ rows, unit = 'records', emptyText = 'No records in this period.' }) {
  const max = Math.max(1, ...rows.map(row => row.value));
  if (!rows.some(row => row.value > 0)) return <EmptyState icon={BarChart3} title={emptyText} description="Choose a wider period or return after activity is recorded." />;
  return <><p className="form-hint">Amounts in {unit}. Each bar is labelled with its exact value.</p>
    <dl className="analytics-comparison">{rows.map(row => <div key={row.label}>
      <dt>{row.label}</dt><dd><span className="analytics-bar" aria-hidden="true"><span style={{ width: `${row.value / max * 100}%` }} /></span><strong className="tabular">{row.value.toLocaleString()}</strong></dd>
    </div>)}</dl></>;
}

export function ActivityTrend({ rows }) {
  const max = Math.max(1, ...rows.flatMap(row => [row.requests, row.payments]));
  if (!rows.some(row => row.requests || row.payments)) return <EmptyState icon={BarChart3} title="No session activity in this period" description="Request and payment trends appear when those records are stored." />;
  const x = index => 45 + index * 610 / Math.max(1, rows.length - 1);
  const y = value => 175 - value / max * 140;
  const points = key => rows.map((row, i) => `${x(i)},${y(row[key])}`).join(' ');
  return <>
    <div className="analytics-legend"><span>Solid line: requests created</span><span>Dashed line: tutoring payment records</span></div>
    <p className="analytics-mobile-scale">Daily records (UTC), scale 0–{max}</p>
    <svg className="analytics-trend" viewBox="0 0 700 220" preserveAspectRatio="none" aria-hidden="true">
      {[0, 0.5, 1].map(fraction => <g key={fraction}><line className="analytics-gridline" x1="45" x2="655" y1={y(max * fraction)} y2={y(max * fraction)} /><text x="35" y={y(max * fraction) + 4} textAnchor="end">{Number((max * fraction).toFixed(1))}</text></g>)}
      <polyline className="analytics-request-line" vectorEffect="non-scaling-stroke" points={points('requests')} />
      <polyline className="analytics-payment-line" vectorEffect="non-scaling-stroke" points={points('payments')} />
      {rows.length === 1 && <><circle className="analytics-request-dot" cx={x(0)} cy={y(rows[0].requests)} r="4" /><circle className="analytics-payment-dot" cx={x(0)} cy={y(rows[0].payments)} r="4" /></>}
      <text x="45" y="204">{rows[0].date}</text><text x="655" y="204" textAnchor="end">{rows.at(-1).date}</text>
      <text x="45" y="18">Records per UTC day</text>
    </svg>
    <div className="analytics-mobile-range"><span>{rows[0].date}</span><span>{rows.at(-1).date}</span></div>
    <details className="analytics-data-table"><summary>View exact daily values</summary><div className="table-responsive" tabIndex={0} role="region" aria-label="Daily session activity"><table className="table"><caption>Requests and payment records by UTC day</caption><thead><tr><th scope="col">Date (UTC)</th><th scope="col">Requests created</th><th scope="col">Tutoring payment records</th></tr></thead><tbody>{rows.map(row => <tr key={row.date}><th scope="row">{row.date}</th><td>{row.requests}</td><td>{row.payments}</td></tr>)}</tbody></table></div></details>
  </>;
}
