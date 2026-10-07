import React, { useEffect, useId, useRef, useState } from 'react';
import { Bell, X, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { pushAvailable, requestPushPermission } from '../../services/pushClient';
import { useNotifications } from '../../context/notificationAccess';
import { useToast } from '../../context/toastAccess';

export default function NotificationBell({ label }) {
  const toast = useToast();
  const panelId = useId();
  const trigger = useRef(null);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { items, count, error, loading: loadingItems, refresh, soundEnabled, toggleSound } = useNotifications();
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => { if (!event.target.closest('.notification-center')) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const toggle = () => {
    if (!open) void refresh();
    setOpen(!open);
  };
  const markAll = async () => {
    setBusy(true);
    try { await api.patch('/api/notifications/read-all', {}); toast('success', 'Notifications marked as read.'); await refresh({ afterCurrent: true }); }
    catch { toast('error', 'Could not mark notifications as read.'); }
    finally { setBusy(false); }
  };
  const follow = async (item) => {
    if (!item.readAt) {
      try { await api.patch(`/api/notifications/${item.id}/read`, {}); }
      catch { toast('error', 'Could not mark notification as read.'); return; }
    }
    setOpen(false);
    void refresh({ afterCurrent: true });
    navigate(item.type?.startsWith('message.') ? item.href + '#session-messages' : item.href);
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
        <button type="button" aria-label="Close notifications" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={18} /></button>
        <button type="button" className="text-action" disabled={busy || count === 0} onClick={markAll}>Mark all read</button>
      </div>
      <button type="button" className="notification-sound text-action" aria-pressed={soundEnabled} onClick={toggleSound}>
        {soundEnabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}{soundEnabled ? 'Mute notification sound' : 'Enable notification sound'}
      </button>
      {error && <p role="alert" className="notification-error">{error}</p>}
      {loadingItems ? <p className="notification-empty" role="status">Loading notifications...</p> :
        items.length === 0 ? <p className="notification-empty">{error ? 'Notifications are unavailable. Try again.' : 'No notifications yet.'}{error && <button type="button" className="text-action" onClick={() => void refresh()}>Retry</button>}</p> :
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
