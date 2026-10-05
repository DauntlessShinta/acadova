import React from 'react';
import { FileText, Link2 } from 'lucide-react';
import { learningAccessLabel, resourceSource } from '../../utils/learningPresentation';

export default function ResourceRow({ resource, onOpen, disabled = false, selected = false }) {
  const Icon = resource.resourceType === 'text' ? FileText : Link2;
  const source = resourceSource(resource.externalUrl);
  const access = learningAccessLabel(resource);
  return <div className={`learning-resource-row${selected ? ' is-current' : ''}`}>
    <Icon size={20} aria-hidden="true" />
    <div className="learning-resource-copy"><strong>{resource.title}</strong>
      {resource.description && <p>{resource.description}</p>}
      <div className="learning-item-meta"><span>{resource.resourceType === 'text' ? 'Reading resource' : 'External learning resource'}</span>
        {source && <span>{source}</span>}{access && <span className="learning-access">{access}</span>}</div>
    </div>
    <button className="text-action" type="button" disabled={disabled} aria-current={selected ? 'step' : undefined}
      aria-label={`View resource: ${resource.title}`} onClick={onOpen}>View resource</button>
  </div>;
}
