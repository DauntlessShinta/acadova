import { useEffect, useRef, useState } from 'react';
import service from '../../services/collaborationService';
import Alert from '../common/Alert';
import { useConfirm } from '../../context/confirmAccess';
import '../../pages/studyTogether.css';
export default function StudyShareSettings({ id, changed }) {
  const [settings, setSettings] = useState(null); const [link, setLink] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const pending = useRef(false); const confirm = useConfirm();
  useEffect(() => { let active = true; service.sharing(id).then(r => { if (active) setSettings(r.data); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [id]);
  const change = async visibility => {
    if (pending.current) return;
    if (visibility === 'unlisted' && !await confirm('Share only content you have the right to distribute. You are responsible for permission. Private original files, academic IDs, plans and attempts will not be shared. Any signed-in eligible student with the link can read the questions and answers. This is not moderator approval. Creating a new link revokes the previous link.', { title: 'Confirm sharing rights', label: 'I have permission · Create link', destructive: false })) return;
    if (pending.current) return; pending.current = true; setBusy(true); setError('');
    try { const r = await service.changeSharing(id, { visibility, version: settings.version, ...(visibility === 'unlisted' ? { rightsAcknowledged: true } : {}) }); setSettings(r.data); setLink(r.data.token ? `${window.location.origin}/study-share/${id}#${r.data.token}` : ''); changed?.(r.data); }
    catch(e) { setError(e.message); try { setSettings((await service.sharing(id)).data); } catch { /* retain original error */ } }
    finally { pending.current = false; setBusy(false); }
  };
  return <section className="share-settings" aria-label="Study set sharing"><h3>Share settings</h3>{error && <Alert type="danger" message={error} />}{settings && <><span className="circle-badge">{settings.visibility === 'public' ? 'Public · reviewed revision' : settings.visibility === 'unlisted' ? 'Unlisted · link access' : 'Private'}</span><p>Original resources, private academic structure, plans, progress and attempts stay private. Shared content is read-only; import and editing by other students are unavailable.</p>
    {!settings.shareable ? <p>AI-generated sets, including strict-source evidence and source pins, stay private. Source permission and a safe publication contract are not implemented.</p> : <><p>Unlisted links require an eligible, signed-in Student account. Sign in first, then open the original link. Revocation blocks future access; content already read or copied cannot be recalled.</p><div className="circle-actions"><button className="btn btn-secondary" disabled={busy || settings.state !== 'private'} onClick={() => change('unlisted')}>{settings.visibility === 'unlisted' ? 'Replace unlisted link' : 'Create unlisted link'}</button>{settings.visibility !== 'private' && <button className="btn btn-secondary" disabled={busy} onClick={() => change('private')}>Make private / revoke link</button>}</div>{link && <><label htmlFor="unlisted-link">New link (shown only this time)</label><input id="unlisted-link" readOnly value={link} onFocus={e => e.target.select()} /><button className="btn btn-secondary" disabled={busy} onClick={async () => { try { await navigator.clipboard.writeText(link); } catch { setError('Select and copy the link from the field above.'); } }}>Copy unlisted link</button></>}<p className="form-hint">Public discovery uses the separate moderator review controls below. Editing, deleting, submitting for review or making private revokes unlisted access.</p></>}
  </>}</section>;
}
