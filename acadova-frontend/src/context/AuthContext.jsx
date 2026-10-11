import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import authService from '../services/authService';
import userService from '../services/userService';
import { setOnUnauthorized } from '../services/api';
import { syncPushIdentity } from '../services/pushClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('acadova_token') || null);
  const [loading, setLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState('');
  const refreshVersion = useRef(0);
  const activeToken = useRef(token);
  const currentUser = useRef(null);

  useEffect(() => { currentUser.current = user; }, [user]);

  const logout = useCallback(() => {
    refreshVersion.current += 1;
    activeToken.current = null;
    localStorage.removeItem('acadova_token');
    localStorage.removeItem('acadova_user');
    setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const version = ++refreshVersion.current;
    const requestedToken = localStorage.getItem('acadova_token');
    if (activeToken.current !== requestedToken) {
      activeToken.current = requestedToken;
      setToken(requestedToken);
      setUser(null);
      setLoading(Boolean(requestedToken));
    }
    if (!requestedToken) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const res = await userService.getMe();
      if (version === refreshVersion.current && requestedToken === localStorage.getItem('acadova_token')
        && res && res.success && res.data) {
        setUser(res.data);
        localStorage.setItem('acadova_user', JSON.stringify(res.data));
        return res.data;
      }
    } catch (err) {
      console.warn('Failed to refresh user session:', err.message);
      // If unauthorized, clear
      if (err.status === 401 && version === refreshVersion.current && requestedToken === localStorage.getItem('acadova_token')) {
        logout();
      }
    } finally {
      if (version === refreshVersion.current) setLoading(false);
    }
    return null;
  }, [logout]);

  useEffect(() => {
    setOnUnauthorized((reason) => {
      logout();
      setAuthNotice(reason === 'suspended' ? 'Your account is suspended. Contact an Acadova administrator for help.' : '');
    });
    let active = true;
    Promise.resolve().then(() => { if (active) void refreshUser(); });
    return () => { active = false; refreshVersion.current += 1; setOnUnauthorized(null); };
  }, [refreshUser, logout]);

  useEffect(() => {
    void syncPushIdentity(user?._id || user?.id || null).catch(() => {
      // In-app notifications remain available when push setup or permission fails.
    });
  }, [user?._id, user?.id]);

  useEffect(() => {
    let pendingRefresh;
    // Focus and visibility commonly fire together. Collapse that burst into one read.
    const refreshVisibleAccount = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(pendingRefresh);
      pendingRefresh = setTimeout(() => { void refreshUser(); }, 100);
    };
    const accountChanged = (event) => {
      if (event.storageArea !== localStorage) return;
      if (event.key === 'acadova_token' || event.key === null) {
        // Immediately hide the old account, including in a background tab.
        refreshVersion.current += 1;
        activeToken.current = localStorage.getItem('acadova_token');
        setToken(activeToken.current);
        setUser(null);
        setLoading(Boolean(activeToken.current));
        refreshVisibleAccount();
        return;
      }
      if (event.key !== 'acadova_user' || !localStorage.getItem('acadova_token')) return;
      try {
        const previous = JSON.parse(event.oldValue);
        const next = JSON.parse(event.newValue);
        const accountId = currentUser.current?._id || currentUser.current?.id;
        if (accountId && (next?._id || next?.id) === accountId
          && previous?.credits !== next?.credits) {
          // Stored data is an invalidation signal, never a source of balances.
          refreshVisibleAccount();
        }
      } catch {
        // Ignore malformed/unrelated local state; focus still revalidates with the API.
      }
    };

    window.addEventListener('focus', refreshVisibleAccount);
    document.addEventListener('visibilitychange', refreshVisibleAccount);
    window.addEventListener('storage', accountChanged);
    return () => {
      clearTimeout(pendingRefresh);
      window.removeEventListener('focus', refreshVisibleAccount);
      document.removeEventListener('visibilitychange', refreshVisibleAccount);
      window.removeEventListener('storage', accountChanged);
    };
  }, [refreshUser]);

  const establishSession = useCallback(async (res) => {
    if (res && res.success && res.data) {
      const { token: newToken, user: userData } = res.data;
      refreshVersion.current += 1;
      activeToken.current = newToken;
      setAuthNotice('');
      localStorage.setItem('acadova_token', newToken);
      localStorage.setItem('acadova_user', JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);
      // Asynchronously load full profile (which includes skills arrays, etc.)
      await refreshUser();
      if (localStorage.getItem('acadova_token') !== newToken) {
        throw new Error('Your account could not access Acadova. Please check the account notice.');
      }
      return res;
    }
    throw new Error(res?.message || 'Login failed');
  }, [refreshUser]);
  const login = useCallback(async (email, password) =>
    establishSession(await authService.login(email, password)), [establishSession]);
  const googleLogin = useCallback(async (credential, policyAccepted) =>
    establishSession(await authService.googleLogin(credential, policyAccepted)), [establishSession]);

  const register = async (formData) => {
    // Registration creates an unverified account; only login can establish a session.
    return authService.register(formData);
  };

  const value = {
    user,
    token,
    loading,
    authNotice,
    isAuthenticated: Boolean(token && user),
    isAdmin: user?.role === 'admin',
    isModerator: user?.role === 'moderator',
    canModerate: user?.role === 'moderator' || user?.role === 'admin',
    isStudent: user?.role === 'student' || !user?.role,
    credits: user?.credits ?? 0,
    login,
    googleLogin,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
