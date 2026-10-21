import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock3, FileQuestion, Layers, LockKeyhole, Plus, Search, Sparkles, Users } from 'lucide-react';
import { studyStateLabel } from '../../utils/studyQuiz';

const destination = (row, results) => row.origin === 'ai' ? `/learning/ai-study/${row.id}` : `/study-sets/${row.studySetId || row.id}${results ? '?attempt=' + row.id : ''}`;
const updated = row => new Date(row.updatedAt || row.createdAt || row.submittedAt || 0).getTime() || 0;
function SavedDate({ row }) {
  const time = updated(row);
  return time ? <span><Clock3 size={14} aria-hidden="true"/>Updated <time dateTime={new Date(time).toISOString()}>{new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></span> : null;
}

// Presentation of existing API records only. Missing context/counts are never inferred.
export default function StudySetsLibrary({ rows, section }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');
  const mine = section === 'mine', results = section === 'results';
  const shown = mine ? rows.filter(row => `${row.title || ''} ${row.subject || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => sort === 'title' ? (a.title || '').localeCompare(b.title || '') : updated(b) - updated(a)) : rows;
  const recent = mine ? rows.filter(row => row.origin === 'ai' && !row.archivedAt).sort((a, b) => updated(b) - updated(a)).slice(0, 3) : [];
  const title = results ? 'My Results' : mine ? 'My Study Sets' : 'Shared Study Sets';
  return <div className="ac-study-library">
    <section className="ac-study-list" aria-label={title}>
      {section === 'shared' && <p className="form-hint">Only moderator-approved public revisions appear here. Private sets stay in your library; unlisted sets require their original signed-in access link and are not publicly discoverable. AI-origin sets remain private.</p>}
      <div className="ac-study-list-heading"><h2>{title} ({rows.length})</h2>{mine && <div className="ac-study-filters">
        <label className="ac-study-search"><span className="sr-only">Search my study sets</span><Search size={18} aria-hidden="true"/><input type="search" value={query} onChange={event => setQuery(event.target.value)} maxLength={120} placeholder="Search my study sets..."/></label>
        <label className="ac-study-sort">Sort by <select value={sort} onChange={event => setSort(event.target.value)}><option value="updated">Recently updated</option><option value="title">Title</option></select></label>
      </div>}</div>
      {!shown.length ? <div className="card ac-study-empty"><Layers size={32} aria-hidden="true"/><h3>{query ? 'No matching study sets' : results ? 'No quiz results yet' : mine ? 'Your next study session starts here' : 'No approved sets found'}</h3><p>{query ? 'Try another title or subject, or clear your search.' : results ? 'Your submitted practice results will appear here. Practice awards no credits.' : mine ? 'Create a private set, or generate study material from an authorized module in My Subjects.' : 'Only approved, available revisions appear here. Try a different search.'}</p>{mine && !query && <Link className="btn btn-secondary" to="/study-sets/new"><Plus size={17} aria-hidden="true"/>Create your first set</Link>}</div> : <div className="study-set-grid">{shown.map(row => <article className="card study-card ac-study-card" key={row.id}>
        <div className="ac-study-card-heading"><span className={`ac-icon-tile${row.origin === 'ai' ? ' ac-study-ai-icon' : ''}`}>{row.origin === 'ai' ? <Sparkles size={27} aria-hidden="true"/> : <BookOpen size={27} aria-hidden="true"/>}</span><div><h3>{row.title || 'Untitled draft'}</h3><p>{row.subject || 'Subject not set'}{row.authorName && ` / By ${row.authorName}`}</p>{row.description && <p className="ac-study-description">{row.description}</p>}</div></div>
        <div className="ac-study-card-actions"><div className="ac-study-badges">{Array.isArray(row.flashcards) && row.flashcards.length > 0 && <span><Layers size={16} aria-hidden="true"/>Flashcards ({row.flashcards.length})</span>}{Array.isArray(row.questions) && row.questions.length > 0 && <span><FileQuestion size={16} aria-hidden="true"/>Practice Quiz ({row.questions.length})</span>}{row.origin === 'ai' && <span>AI-generated</span>}{row.archivedAt && <span>Archived - content retained</span>}{results && <span>Score: {row.score}% / Revision {row.revision}</span>}</div><Link className="btn btn-secondary" to={destination(row, results)}>{results ? 'View result' : 'Open study material'}<ArrowRight size={17} aria-hidden="true"/></Link></div>
        <div className="ac-study-card-meta"><SavedDate row={row}/><span>{section === 'shared' || row.visibility === 'public' ? <Users size={14} aria-hidden="true"/> : <LockKeyhole size={14} aria-hidden="true"/>}{row.visibility === 'unlisted' ? 'Unlisted link access' : section === 'shared' || row.visibility === 'public' ? 'Approved public revision' : row.state ? studyStateLabel(row.state) : results ? 'Private result' : 'Personal study set'}</span>{results && <span>Practice does not earn EXP</span>}</div>
      </article>)}</div>}
    </section>
    <aside className="ac-study-aside" aria-label="Study shortcuts">
      {mine && <section className="card ac-study-recent"><h2><Sparkles size={21} aria-hidden="true"/>Recent AI study materials</h2>{recent.length ? <ul>{recent.map(row => <li key={row.id}><span className="ac-icon-tile ac-study-ai-icon"><Layers size={20} aria-hidden="true"/></span><div><Link to={destination(row)}>{row.title || 'Untitled study set'}</Link><p>{row.subject || 'Personal study material'} / AI-generated</p></div></li>)}</ul> : <p>Your saved AI materials will appear here. No materials generated yet? Start with an authorized module.</p>}</section>}
      <section className="card ac-study-shortcuts"><h2>Quick actions</h2>{[
        ['/study-sets/new', Plus, 'Create study set', 'Write your own questions and flashcards'],
        ['/subjects', BookOpen, 'Study from a module', 'Keep generated material with your subject'],
        ['/study-sets?view=shared', Users, 'Explore shared study sets', 'Practice with approved community materials'],
      ].map(([to, Icon, label, hint]) => <Link key={to} to={to}><span className="ac-icon-tile"><Icon size={21} aria-hidden="true"/></span><span><strong>{label}</strong><small>{hint}</small></span><ArrowRight size={16} aria-hidden="true"/></Link>)}</section>
    </aside>
  </div>;
}
