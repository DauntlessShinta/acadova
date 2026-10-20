import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export function useGrowth(enabled = true) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const owner = String(user?._id || user?.id || '');
  const [state, setState] = useState(null);
  const [ticket, setTicket] = useState(0);
  const refresh = useCallback(() => setTicket(value => value + 1), []);
  useEffect(() => {
    if (!enabled || !owner || user?.role !== 'student') return;
    const controller = new AbortController();
    api.get('/api/growth', { signal:controller.signal }).then(response => {
      if (!controller.signal.aborted) setState({ owner, data:response.data, error:'' });
    }).catch(error => {
      if (!controller.signal.aborted) setState(previous => ({owner,data:previous?.owner===owner?previous.data:null,error:error.message}));
    });
    return () => controller.abort();
  }, [enabled, owner, user?.role, pathname, ticket]);
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    window.addEventListener('focus', refresh);
    window.addEventListener('acadova:growth-refresh', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('acadova:growth-refresh', refresh); };
  }, [enabled, refresh]);
  return { data:state?.owner===owner?state.data:null,error:state?.owner===owner?state.error:'',refresh,owner };
}
