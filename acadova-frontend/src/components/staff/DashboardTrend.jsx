import React, { useSyncExternalStore } from 'react';
import { groupTrend } from '../../utils/staffPresentation';
const query = '(max-width: 600px)';
const subscribe = callback => { const media = window.matchMedia(query); media.addEventListener('change', callback); return () => media.removeEventListener('change', callback); };
const compact = () => window.matchMedia(query).matches;

export default function DashboardTrend({ rows, series, emptyText = 'No recorded activity in this period.' }) {
  const isCompact = useSyncExternalStore(subscribe, compact, () => false);
  const groupLimit = isCompact ? 10 : 30;
  const groups = groupTrend(rows, groupLimit); const max = Math.max(1, ...groups.flatMap(row => series.map(item => row[item.key] || 0)));
  if (!rows.some(row => series.some(item => row[item.key] > 0))) return <p className="dashboard-empty">{emptyText}</p>;
  const span = 850 / Math.max(1, groups.length); const width = Math.min(18, span / (series.length + 1));
  const y = value => 160 - value * 130 / max;
  return <div className="dashboard-chart"><div className="dashboard-chart-legend">{series.map((item, i) => <span key={item.key}><i className={'series-' + i} aria-hidden="true" />{item.label}</span>)}</div>
    <p className="dashboard-chart-scale">Recorded events · UTC · {groups.length < rows.length ? `Grouped into intervals of up to ${Math.ceil(rows.length / groupLimit)} days` : 'Daily totals'} · Scale 0–{max}</p>
    <svg viewBox="0 0 920 198" preserveAspectRatio="none" className="dashboard-trend-svg" aria-hidden="true">
      {[0, .5, 1].map(value => <g key={value}><line className="analytics-gridline" x1="45" x2="895" y1={y(max * value)} y2={y(max * value)} /><text x="35" y={y(max * value) + 4} textAnchor="end">{Number((max * value).toFixed(1))}</text></g>)}
      {groups.map((row, index) => <g key={row.date}>{series.map((item, i) => <rect key={item.key} className={'series-' + i} x={45 + index * span + (span - width * series.length) / 2 + i * width} y={y(row[item.key] || 0)} width={Math.max(2, width - 2)} height={160 - y(row[item.key] || 0)} rx="2" />)}
        {(index === 0 || index === groups.length - 1 || index % Math.max(1, Math.ceil(groups.length / 6)) === 0) && <text x={45 + index * span + span / 2} y="185" textAnchor="middle">{row.date.slice(5)}</text>}</g>)}
    </svg><div className="dashboard-chart-range"><span>{rows[0].date}</span><span>{rows.at(-1).date}</span></div><details className="analytics-data-table"><summary>View exact daily values</summary><div className="table-responsive" tabIndex={0} role="region" aria-label="Recorded activity by UTC day"><table className="table"><caption>Daily stored event totals in UTC</caption><thead><tr><th scope="col">Date</th>{series.map(item => <th scope="col" key={item.key}>{item.label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.date}><th scope="row">{row.date}</th>{series.map(item => <td key={item.key}>{row[item.key] || 0}</td>)}</tr>)}</tbody></table></div></details>
  </div>;
}
