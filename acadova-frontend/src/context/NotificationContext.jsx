import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './toastAccess';
import { NotificationContext } from './notificationAccess';
import api from '../services/api';
import { createNotificationTracker, threadFromNotification, isChatViewed } from '../utils/messagingUx';
import { createNotificationSound, readSoundPreference, saveSoundPreference } from '../services/notificationSound';

export function NotificationProvider({ children }) {
  const { user } = useAuth(); const userId = user?._id || user?.id;
  const toast = useToast();
  const [items, setItems] = useState([]); const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(() => readSoundPreference(userId));
  const enabled = useRef(soundEnabled); const activeThread = useRef('');
  const tracker = useRef(createNotificationTracker()); const sound = useRef(createNotificationSound());
  const lifecycle = useRef({ request: null, generation: 0 });
  const setActiveThread = useCallback((id) => { activeThread.current = id; }, []);
  const refresh = useCallback(function refreshNotifications({ afterCurrent = false } = {}) {
    if (!userId) return Promise.resolve();
    if (lifecycle.current.request) return afterCurrent ? lifecycle.current.request.then(() => refreshNotifications()) : lifecycle.current.request;
    const ticket = lifecycle.current.generation;
    setLoading(true);
    const request = Promise.all([api.get('/api/notifications/unread-count'), api.get('/api/notifications?limit=50')])
      .then(([counts, list]) => {
        if (lifecycle.current.generation !== ticket) return;
        const rows = Array.isArray(list.data) ? list.data : [];
        const incoming = tracker.current(rows);
        setItems(rows); setCount(counts.data?.count || 0); setError('');
        if (enabled.current && incoming.some((item) => !item.type?.startsWith('message.') || threadFromNotification(item) !== activeThread.current || !isChatViewed('messages'))) sound.current.play();
      }).catch(() => { if (lifecycle.current.generation === ticket) setError('Notifications are temporarily unavailable.'); })
      .finally(() => { if (lifecycle.current.generation === ticket) { lifecycle.current.request = null; setLoading(false); } });
    lifecycle.current.request = request; return request;
  }, [userId]);
  useEffect(() => {
    const player = sound.current; const state = lifecycle.current;
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh(); const interval = window.setInterval(visibleRefresh, 60_000);
    window.addEventListener('focus', visibleRefresh);
    const allowAudio = () => { if (enabled.current) void player.unlock(); };
    window.addEventListener('pointerdown', allowAudio); window.addEventListener('keydown', allowAudio);
    return () => { state.generation++; state.request = null; window.clearInterval(interval); window.removeEventListener('focus', visibleRefresh); window.removeEventListener('pointerdown', allowAudio); window.removeEventListener('keydown', allowAudio); player.close(); };
  }, [refresh]);
  const toggleSound = async () => {
    const next = !enabled.current;
    if (next && !await sound.current.unlock()) { toast('info', 'Sound is unavailable in this browser. In-app notifications still work.'); return; }
    enabled.current = next; setSoundEnabled(next); saveSoundPreference(userId, next);
  };
  return <NotificationContext.Provider value={{ items, count, loading, error, refresh, soundEnabled, toggleSound, setActiveThread }}>{children}</NotificationContext.Provider>;
}
