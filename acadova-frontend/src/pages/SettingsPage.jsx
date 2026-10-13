import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/notificationAccess';
import { pushAvailable, requestPushPermission } from '../services/pushClient';

export default function SettingsPage() {
  const { user } = useAuth();
  const { soundEnabled, toggleSound } = useNotifications();
  const [permission, setPermission] = useState(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const update = () => setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  }, []);
  const push = async () => {
    setBusy(true); setMessage('');
    try { await requestPushPermission(); setMessage('Follow the browser alert prompt. Permission does not guarantee provider delivery.'); }
    catch (error) { setMessage(error.message || 'Browser alerts are unavailable. In-app notifications still work.'); }
    finally { setPermission(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission); setBusy(false); }
  };
  return <div className={user?.role === 'student' ? 'settings-page' : 'staff-page settings-page'}>
    <header className="student-page-header"><div><span className="student-eyebrow">Your account</span><h1>Settings</h1><p>Manage the preferences available for your Acadova account.</p></div></header>
    <section className="card settings-section" aria-labelledby="notification-settings"><h2 id="notification-settings">Notifications</h2>
      <div className="settings-row"><div><h3>Notification sound</h3><p>Play a short sound for new notifications while Acadova is open. Saved for this account in this browser.</p></div>
        <button className="btn btn-secondary" type="button" role="switch" aria-checked={soundEnabled} aria-label="Notification sound" disabled={busy} onClick={async () => { setBusy(true); try { await toggleSound(); } finally { setBusy(false); } }}>{soundEnabled ? 'Sound on' : 'Sound off'}</button></div>
      <div className="settings-row"><div><h3>Browser alerts</h3><p>Browser permission: <strong>{permission === 'default' ? 'Not requested' : permission === 'granted' ? 'Allowed' : permission === 'denied' ? 'Blocked' : 'Unsupported'}</strong>.</p><p>{!pushAvailable ? 'Push alerts are not configured or supported in this browser. In-app notifications remain available.' : permission === 'denied' ? 'To allow alerts, update this site’s permission in your browser settings.' : 'Alerts also require a configured Acadova push identity and an active provider subscription.'}</p></div>
        {pushAvailable && permission === 'default' && <button className="btn btn-secondary" type="button" disabled={busy} onClick={push}>Enable browser alerts</button>}</div>
      {message && <p role="status" className="form-hint">{message}</p>}
      <p className="form-hint">Your in-app notification history remains available from the bell.</p>
    </section>
    <section className="card settings-section" aria-labelledby="account-settings"><h2 id="account-settings">Account and preferences</h2><p><strong>{user?.name}</strong> · {user?.role === 'admin' ? 'Administrator' : user?.role === 'moderator' ? 'Moderator' : 'Student'}</p>
      {user?.role === 'student' ? <><p>Your Student profile supports both learning and teaching. Manage your name, skills and weekly availability in Profile.</p><Link className="btn btn-secondary" to="/profile">Manage profile</Link></> : <p>Staff role and account access are managed by an Administrator. Student profile editing is available only to Student accounts.</p>}
      {user?.role === 'admin' && <div className="study-actions"><Link className="btn btn-secondary" to="/admin/security">Security Center</Link><Link className="btn btn-secondary" to="/admin/users">Manage account access</Link></div>}
      <p className="form-hint">Use the account menu to sign out. Password recovery is available from the sign-in page after signing out.</p>
    </section>
  </div>;
}
