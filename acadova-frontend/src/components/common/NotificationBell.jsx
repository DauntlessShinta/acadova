import React, { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { pushAvailable, requestPushPermission } from '../../services/pushClient';
import { useAuth } from '../../context/AuthContext';

export default function NotificationBell() {
  const { user } = useAuth();
  const userId = user?._id || user?.id;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const refresh = useCallback(async (includeItems = false) => {
    if (includeItems) setLoadingItems(true);
    try {
      const [counts, list] = await Promise.all([
        api.get('/api/notifications/unread-count'),
        includeItems ? api.get('/api/notifications?limit=20') : Promise.resolve(null),
      ]);
      setCount(counts.data.count);
      if (list) setItems(list.data);
      setError('');
    } catch { setError('Notifications are temporarily unavailable.'); }
    finally { if (includeItems) setLoadingItems(false); }
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    void Promise.resolve().then(() => refresh());
    const interval = window.setInterval(() => void refresh(open), 60_000);
    return () => window.clearInterval(interval);
  }, [userId, open, refresh]);

  const toggle = () => {
    if (!open) void refresh(true);
    setOpen(!open);
  };
  const markAll = async () => {
    setBusy(true);
    try { await api.patch('/api/notifications/read-all', {}); await refresh(true); }
    catch { setError('Could not mark notifications as read.'); }
    finally { setBusy(false); }
  };
  const follow = async (item) => {
    if (!item.readAt) {
      try { await api.patch(`/api/notifications/${item.id}/read`, {}); }
      catch { setError('Could not mark notification as read.'); return; }
    }
    setOpen(false);
    void refresh();
    navigate(item.href);
  };
  const enablePush = async () => {
    try { await requestPushPermission(); }
    catch { setError('Push is unavailable. In-app notifications still work.'); }
  };

  return <div className="notification-center">
    <button type="button" className="notification-trigger" onClick={toggle}
      aria-label={`Notifications${count ? `, ${count} unread` : ''}`} aria-expanded={open}>
      <Bell size={19} />{count > 0 && <span className="notification-badge">{count > 99 ? '99+' : count}</span>}
    </button>
    {open && <section className="notification-panel" aria-label="Notifications">
      <div className="notification-panel-header"><strong>Notifications</strong>
        <button type="button" disabled={busy || count === 0} onClick={markAll}>Mark all read</button>
      </div>
      {error && <p role="alert" className="notification-error">{error}</p>}
      {loadingItems ? <p className="notification-empty">Loading notifications...</p> :
        items.length === 0 ? <p className="notification-empty">No notifications yet.</p> :
        <ul className="notification-list">{items.map((item) => <li key={item.id}>
          <button type="button" className={item.readAt ? '' : 'is-unread'} onClick={() => follow(item)}>
            <strong>{item.title}</strong><span>{item.message}</span>
            <small>{new Date(item.createdAt).toLocaleString()}</small>
          </button>
        </li>)}</ul>}
      {pushAvailable && <button type="button" className="notification-push" onClick={enablePush}>Enable browser alerts</button>}
    </section>}
  </div>;
}
