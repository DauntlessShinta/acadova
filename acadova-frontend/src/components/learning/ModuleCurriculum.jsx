import { useEffect, useState } from 'react';
import { ChevronDown, ClipboardList, ListOrdered } from 'lucide-react';
import ResourceRow from './ResourceRow';

export default function ModuleCurriculum({ resources, assessment, lessonIndex, working, progress, onSelect }) {
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 1025px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1025px)');
    const update = () => setOpen(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return <details className="learning-curriculum" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><ListOrdered size={18} aria-hidden="true" /><h2 id="learning-study-heading">Module curriculum</h2><ChevronDown size={16} aria-hidden="true" /></summary>
    <div className="learning-curriculum-intro"><span>{resources.length} {resources.length === 1 ? 'lesson' : 'lessons'}</span><span>Self-paced</span></div>
    <ol className="learning-resource-order">
      {resources.map((resource, index) => <li key={resource.id}>
        <ResourceRow resource={resource} number={index + 1} compact completed={progress?.lessons.find((row) => row.resource === resource.id)?.completed} selected={lessonIndex === index}
          disabled={working} onOpen={() => onSelect(index)} />
      </li>)}
    </ol>
    {assessment && <a className="learning-curriculum-assessment" href="#learning-assessment-heading">
      <ClipboardList size={19} aria-hidden="true" /><span><strong>Module assessment</strong><span>{progress?.assessment?.passed ? 'Passed - requirement completed' : 'Check your learning & credit eligibility'}</span></span>
    </a>}
    <p className="learning-curriculum-note">Your place is saved on this browser. Lesson position does not record completion.</p>
  </details>;
}
