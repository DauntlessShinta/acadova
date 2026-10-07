import { Link, useLocation, useSearchParams } from 'react-router-dom';
import './learning.css';

export default function LearningNavigation({ disabled = false, onNavigate }) {
  const { pathname } = useLocation();
  const currentPath = pathname.replace(/\/$/, '');
  const [params] = useSearchParams();
  const browse = new URLSearchParams(currentPath === '/learning' ? params : undefined);
  browse.delete('view');
  const contribute = new URLSearchParams(browse);
  contribute.set('view', 'contribute');
  const current = currentPath === '/assessments' ? 'assessments' : params.get('view') === 'contribute' ? 'contribute' : 'library';
  const items = [
    ['library', 'Browse learning', '/learning' + (browse.size ? '?' + browse : '')],
    ['assessments', 'Assessments', '/assessments'],
    ['contribute', 'Share a resource', '/learning?' + contribute],
  ];
  return <nav className="learning-section-nav" aria-label="Learning sections">{items.map(([key, label, to]) =>
    <Link key={key} id={'learning-tab-' + key} to={to} aria-current={current === key ? 'page' : undefined}
      aria-disabled={disabled || undefined} onClick={(event) => {
        if (disabled) event.preventDefault(); else onNavigate?.(event, to);
      }}>{label}</Link>)}</nav>;
}
