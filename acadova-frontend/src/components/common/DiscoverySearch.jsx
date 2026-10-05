import React, { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { discoveryDestination, discoveryQueryError } from '../../utils/discoverySearch';

export default function DiscoverySearch({ onNavigate }) {
  const navigate = useNavigate();
  const id = useId();
  const input = useRef(null);
  const [scope, setScope] = useState('tutors');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  return <form className="discovery-search" role="search" aria-label="Search Acadova" onSubmit={(event) => {
    event.preventDefault();
    const message = discoveryQueryError(scope, query);
    setError(message);
    if (message) { input.current?.focus(); return; }
    navigate(discoveryDestination(scope, query));
    onNavigate?.();
  }}>
    <label className="sr-only" htmlFor={`${id}-scope`}>Search in</label>
    <select id={`${id}-scope`} value={scope} onChange={(event) => { setScope(event.target.value); setError(''); }}>
      <option value="tutors">Tutors by skill</option><option value="learning">Learning topics</option>
    </select>
    <label className="sr-only" htmlFor={`${id}-query`}>{scope === 'learning' ? 'Search published learning topics' : 'Search tutors by teaching skill'}</label>
    <input ref={input} id={`${id}-query`} type="search" maxLength={80} value={query} placeholder={scope === 'learning' ? 'Search topic names or descriptions…' : 'Search a subject or teaching skill…'}
      aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} onChange={(event) => { setQuery(event.target.value); setError(''); }} />
    <button className="btn btn-primary" type="submit" aria-label="Search"><Search size={19} aria-hidden="true" /></button>
    {error && <span className="form-error discovery-search-error" id={`${id}-error`}>{error}</span>}
  </form>;
}
