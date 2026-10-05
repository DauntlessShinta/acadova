import React from 'react';
import { ExternalLink } from 'lucide-react';
import { resourceSource } from '../../utils/learningPresentation';

export default function ExternalResourceLink({ href, children = 'Open resource', primary = false }) {
  if (!resourceSource(href)) return <p className="form-hint">This external resource link is unavailable.</p>;
  return <a className={primary ? 'btn btn-primary learning-external-action' : 'text-link external-resource-link'}
    href={href} target="_blank" rel="noopener noreferrer">
    {children}<ExternalLink size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
  </a>;
}
