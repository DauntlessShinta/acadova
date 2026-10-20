import { useState } from 'react';
import api from '../../services/api';

export default function GrowthVisibility({ data }) {
  const [draft, setDraft] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const saved = data.visibility || {showLevel:false,showRank:false,badgeIds:[]};
  const value = draft || saved;
  const earned = data.badges.filter(badge => badge.earned);
  const edit = update => { setDraft({...value,...update}); setMessage(''); setError(''); };
  const submit = async event => {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage(''); setError('');
    try {
      const response = await api.patch('/api/growth/visibility', {...value,badgeIds:value.badgeIds.filter(id=>earned.some(badge=>badge.id===id))});
      setDraft(response.data); setMessage('Visibility saved. Exact EXP totals and activity remain private.');
    } catch { setError('Visibility was not saved. Your choices are retained; retry when ready.'); }
    finally { setBusy(false); }
  };
  return <details className="card ac-growth-visibility"><summary>Growth visibility — private by default</summary><h2>Who can see your growth?</h2><p>Choose what other signed-in students can see on your peer profile. Exact EXP, activity history and assessment performance are never shared here.</p>
    <form onSubmit={submit}><fieldset disabled={busy}><legend>Optional profile recognition</legend>
      <label><input type="checkbox" checked={value.showLevel} onChange={e=>edit({showLevel:e.target.checked})}/>Show my level</label>
      <label><input type="checkbox" checked={value.showRank} onChange={e=>edit({showRank:e.target.checked})}/>Show my rank title</label>
      <p>Select earned achievements to share (changes apply after Save visibility):</p>{earned.length?earned.map(badge=><label key={badge.id}><input type="checkbox" checked={value.badgeIds.includes(badge.id)} onChange={e=>edit({badgeIds:e.target.checked?[...value.badgeIds,badge.id]:value.badgeIds.filter(id=>id!==badge.id)})}/>{badge.title}</label>):<p>No earned achievements to share yet.</p>}
      <button className="btn btn-secondary" type="button" onClick={()=>edit({showLevel:false,showRank:false,badgeIds:[]})}>Select all private</button><button className="btn btn-primary" type="submit">{busy?'Saving visibility...':'Save visibility'}</button>
    </fieldset>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}</form>
  </details>;
}
