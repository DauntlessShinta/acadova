import { useState } from 'react';
import { ExternalLink, Copy } from 'lucide-react';
import { meetingBookmark, meetingProviders } from '../../utils/meetingProviders';
import meet from '../../assets/meeting/google-meet.svg';
import zoom from '../../assets/meeting/zoom.png';
import teams from '../../assets/meeting/teams.ico';
const icons = { meet, zoom, teams };
export function ProviderIcon({ id }) { return <img src={icons[id]} width="22" height="22" alt="" aria-hidden="true"/>; }
export default function MeetingProviders({ selected, onSelect }) {
  const choice = meetingProviders.find(row => row.id === selected) || meetingProviders[0];
  return <section className="meeting-provider-picker" aria-label="Meeting provider">
    <div className="meeting-provider-options">{meetingProviders.map(row=><button type="button" key={row.id} aria-pressed={choice.id===row.id} onClick={()=>onSelect(row.id)}><ProviderIcon id={row.id}/><span>{row.label}</span></button>)}</div>
    <a className="btn btn-secondary" href={choice.createUrl} target="_blank" rel="noopener noreferrer">Create meeting on {choice.label}<ExternalLink size={15} aria-hidden="true"/><span className="sr-only"> (opens official website in a new tab)</span></a>
    <p className="form-hint">Create the meeting there, then return and paste its invitation link. This shortcut does not create or save a meeting in Acadova.</p>
  </section>;
}
// Render only from the authorized detail DTO, never from public discovery rows.
export function MeetingActions({ href }) {
  const [copy, setCopy] = useState('');
  const bookmark = meetingBookmark(href);
  if (!bookmark) return null;
  return <section className="meeting-actions-card" aria-label="Private meeting bookmark">
    <a className="btn btn-primary" href={bookmark.href} target="_blank" rel="noopener noreferrer"><ProviderIcon id={bookmark.id}/>Open meeting on {bookmark.label}<ExternalLink size={15} aria-hidden="true"/></a>
    <button type="button" className="btn btn-secondary" onClick={async()=>{try{await navigator.clipboard.writeText(bookmark.href);setCopy('Meeting link copied.');}catch{setCopy('Could not copy. Use the Open meeting link or try again.');}}}><Copy size={16} aria-hidden="true"/>Copy link</button>
    {copy && <p role="status">{copy}</p>}<p className="form-hint">Meeting access does not verify attendance.</p>
  </section>;
}
