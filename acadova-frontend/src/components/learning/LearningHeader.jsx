import { Link } from 'react-router-dom';
import { StudyHero } from './AcademicUi';

export default function LearningHeader({ title, children, actions, headingRef, breadcrumb, onNavigate }) {
  return <StudyHero compact className="learning-page-header ac-learning-header" headingRef={headingRef} title={title} actions={actions} eyebrow={breadcrumb || <nav className="learning-breadcrumbs" aria-label="Learning breadcrumb"><ol><li><Link to="/learning" onClick={event=>onNavigate?.(event,'/learning')}>Learning</Link></li>{title !== 'Learning' && <li aria-current="page">{title}</li>}</ol></nav>}>{children}</StudyHero>;
}
