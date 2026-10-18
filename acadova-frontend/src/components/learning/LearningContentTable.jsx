export function LearningContentStatus({ status }) {
  const label = status === 'submitted' ? 'Awaiting review' : status.charAt(0).toUpperCase() + status.slice(1);
  const color = status === 'published' ? 'badge-success' : status === 'rejected' ? 'badge-danger'
    : status === 'draft' || status === 'submitted' ? 'badge-pending' : 'badge-navy';
  return <span className={`badge ${color}`}>{label}</span>;
}

export default function LearningContentTable({ label, columns, count, children, empty }) {
  return <div className="learning-table-region" role="region" aria-label={label} tabIndex={0}>
    <table className="learning-content-table" role="table">
      <caption className="sr-only">{label}</caption>
      <thead role="rowgroup"><tr role="row">{columns.map((column) => <th scope="col" role="columnheader" key={column}>{column}</th>)}</tr></thead>
      <tbody role="rowgroup">{count ? children : <tr role="row"><td role="cell" colSpan={columns.length} className="learning-table-empty">{empty}</td></tr>}</tbody>
    </table>
  </div>;
}
