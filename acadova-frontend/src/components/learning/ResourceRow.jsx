import React from 'react';
import { ArrowRight, FileText, Link2 } from 'lucide-react';
import { learningAccessLabel, resourceSource } from '../../utils/learningPresentation';

export default function ResourceRow({ resource, onOpen, disabled = false, selected = false }) {
  const Icon = resource.resourceType === 'text' ? FileText : Link2;
  const source = resourceSource(resource.externalUrl);
  const access = learningAccessLabel(resource);
  return <button type="button" className={`learning-resource-row${selected ? ' is-current' : ''}`}
    disabled={disabled} aria-current={selected ? 'step' : undefined}
    aria-label={`View resource: ${resource.title}`} onClick={onOpen}>
    <Icon size={20} aria-hidden="true" />
    <span className="learning-resource-copy"><strong>{resource.title}</strong>
      {resource.description && <span className="learning-resource-description">{resource.description}</span>}
      <span className="learning-item-meta"><span>{resource.resourceType === 'text' ? 'Reading resource' : 'External learning resource'}</span>
        {source && <span>{source}</span>}{access && <span className="learning-access">{access}</span>}</span>
    </span>
    <ArrowRight size={20} aria-hidden="true" />
  </button>;
}
