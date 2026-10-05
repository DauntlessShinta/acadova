import { createContext, useContext } from 'react';
export const NotificationContext = createContext(null);
const fallback = { items: [], count: 0, loading: false, error: '', soundEnabled: false,
  refresh: async () => {}, toggleSound: async () => {}, setActiveThread: () => {} };
export const useNotifications = () => useContext(NotificationContext) || fallback;
