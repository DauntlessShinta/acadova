import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { pushAvailable, requestPushPermission } from '../../services/pushClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/toastAccess';

export default function NotificationBell({ label }) {
  const toast = useToast();
  const panelId = useId();
  const trigger = useRef(null);
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
    try { await api.patch('/api/notifications/read-all', {}); toast('success', 'Notifications marked as read.'); await refresh(true); }
    catch { toast('error', 'Could not mark notifications as read.'); }
    finally { setBusy(false); }
  };
  const follow = async (item) => {
    if (!item.readAt) {
      try { await api.patch(`/api/notifications/${item.id}/read`, {}); }
      catch { toast('error', 'Could not mark notification as read.'); return; }
    }
    setOpen(false);
    void refresh();
    navigate(item.href);
  };
  const enablePush = async () => {
    try { await requestPushPermission(); }
    catch { toast('error', 'Push is unavailable. In-app notifications still work.'); }
  };

  return <div className="notification-center" onKeyDown={(event) => {
    if (open && event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" className="notification-trigger" onClick={toggle}
      aria-label={`Notifications${count ? `, ${count} unread` : ''}`} aria-expanded={open} aria-controls={open ? panelId : undefined}>
      <Bell size={19} aria-hidden="true" />{label && <span>{label}</span>}{count > 0 && <span className="notification-badge">{count > 99 ? '99+' : count}</span>}
    </button>
    {open && <section id={panelId} className="notification-panel" aria-label="Notifications">
      <div className="notification-panel-header"><strong>Notifications</strong>
        <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)}><X size={18} /></button>
        <button type="button" className="text-action" disabled={busy || count === 0} onClick={markAll}>Mark all read</button>
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
      {pushAvailable && <button type="button" className="notification-push text-action" onClick={enablePush}>Enable browser alerts</button>}
    </section>}
  </div>;
}
