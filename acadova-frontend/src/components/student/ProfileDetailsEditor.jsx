import React, { useState } from 'react';
import { X } from 'lucide-react';
import { LANGUAGES, YEAR_LEVELS } from '../../utils/profileDetails';

export default function ProfileDetailsEditor({ value, onChange, disabled }) {
  const [query, setQuery] = useState('');
  const change = patch => onChange({ ...value, ...patch });
  const visibility = key => <label className="profile-visibility"><input type="checkbox" checked={value.profileVisibility[key]}
    onChange={event => change({ profileVisibility: { ...value.profileVisibility, [key]: event.target.checked } })} />Show {key === 'yearLevel' ? 'year level' : key === 'bio' ? 'biography' : key} on my public profile</label>;
  const toggleLanguage = language => change({ languages: value.languages.includes(language) ? value.languages.filter(item => item !== language) : [...value.languages, language] });
  return <fieldset className="profile-details-editor" disabled={disabled}>
    <legend>About me & public profile</legend><p className="form-hint">Optional. These details stay private until you choose to show them. Never include contact details or sensitive information in your biography.</p>
    <div className="form-group"><label className="form-label" htmlFor="profile-bio">Biography</label><textarea id="profile-bio" className="form-textarea" rows={4} maxLength={1000} value={value.bio} onChange={event => change({ bio: event.target.value })} />{visibility('bio')}</div>
    <div className="form-group"><label className="form-label" htmlFor="profile-university">University (optional)</label><input id="profile-university" className="form-input" maxLength={120} value={value.university} onChange={event => change({ university: event.target.value })} />{visibility('university')}</div>
    <div className="form-group"><label className="form-label" htmlFor="profile-year-level">Year level (optional)</label><select id="profile-year-level" className="form-select" value={value.yearLevel} onChange={event => change({ yearLevel: event.target.value })}>{YEAR_LEVELS.map(year => <option key={year} value={year}>{year || 'Not specified'}</option>)}</select>{visibility('yearLevel')}</div>
    <div className="form-group"><span className="form-label" id="profile-languages-label">Languages (optional, up to 10)</span>
      <details className="profile-language-picker"><summary>Choose languages · {value.languages.length} selected</summary><label className="form-label" htmlFor="profile-language-search">Search languages</label><input id="profile-language-search" className="form-input" type="search" maxLength={50} value={query} onChange={event => setQuery(event.target.value)} />
        <div className="profile-language-options" role="group" aria-labelledby="profile-languages-label">{LANGUAGES.filter(language => language.toLowerCase().includes(query.toLowerCase())).map(language => <label key={language}><input type="checkbox" checked={value.languages.includes(language)} disabled={!value.languages.includes(language) && value.languages.length >= 10} onChange={() => toggleLanguage(language)} />{language}</label>)}
          {!LANGUAGES.some(language => language.toLowerCase().includes(query.toLowerCase())) && <p>No matching languages.</p>}</div></details>
      <ul className="profile-selected-languages" aria-label="Selected languages">{value.languages.map(language => <li key={language}>{language}<button type="button" aria-label={`Remove language ${language}`} onClick={() => toggleLanguage(language)}><X size={16} aria-hidden="true" /></button></li>)}</ul>{visibility('languages')}
    </div>
  </fieldset>;
}
