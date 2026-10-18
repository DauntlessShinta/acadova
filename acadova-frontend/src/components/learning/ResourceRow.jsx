import React from 'react';
import { ArrowRight, FileText, Link2 } from 'lucide-react';
import { learningAccessLabel, resourceSource } from '../../utils/learningPresentation';

export default function ResourceRow({ resource, onOpen, disabled = false, selected = false, compact = false, completed, number }) {
  const Icon = resource.resourceType === 'text' ? FileText : Link2;
  const source = resourceSource(resource.externalUrl);
  const access = learningAccessLabel(resource);
  return <button type="button" className={`learning-resource-row${selected ? ' is-current' : ''}${compact ? ' is-curriculum-row' : ''}`}
    disabled={disabled} aria-current={selected ? 'step' : undefined}
    aria-label={`View resource: ${resource.title}`} onClick={onOpen}>
    {compact ? <span className="learning-lesson-number" aria-hidden="true">{number}</span> : <Icon size={20} aria-hidden="true" />}
    <span className="learning-resource-copy"><strong>{resource.title}</strong>
      {!compact && resource.description && <span className="learning-resource-description">{resource.description}</span>}
      <span className="learning-item-meta"><span>{resource.resourceType === 'text' ? compact ? 'Reading' : 'Reading resource' : compact ? 'External resource' : 'External learning resource'}</span>
        {compact && <span className="learning-completion-label">{completed ? 'Completed' : 'Not completed'}</span>}
        {selected && <span className="learning-current-label">Current resource</span>}
        {!compact && source && <span>{source}</span>}{access && !compact && <span className="learning-access">{access}</span>}{compact && resource.locked && <span>{access}</span>}</span>
    </span>
    <ArrowRight size={20} aria-hidden="true" />
  </button>;
}
