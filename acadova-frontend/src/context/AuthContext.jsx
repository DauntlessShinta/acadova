import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

  const logout = useCallback(() => {
    localStorage.removeItem('acadova_token');
    localStorage.removeItem('acadova_user');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const requestedToken = localStorage.getItem('acadova_token');
    if (!requestedToken) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const res = await userService.getMe();
      if (requestedToken === localStorage.getItem('acadova_token')
        && res && res.success && res.data) {
        setUser(res.data);
        localStorage.setItem('acadova_user', JSON.stringify(res.data));
        return res.data;
      }
    } catch (err) {
      console.warn('Failed to refresh user session:', err.message);
      // If unauthorized, clear
      if (err.status === 401 && requestedToken === localStorage.getItem('acadova_token')) {
        logout();
      }
    } finally {
      setLoading(false);
    }
    return null;
  }, [logout]);

  useEffect(() => {
    setOnUnauthorized((reason) => {
      logout();
      setAuthNotice(reason === 'suspended' ? 'Your account is suspended. Contact an Acadova administrator for help.' : '');
    });
    refreshUser();
    return () => setOnUnauthorized(null);
  }, [refreshUser, logout]);

  useEffect(() => {
    void syncPushIdentity(user?._id || user?.id || null).catch(() => {
      // In-app notifications remain available when push setup or permission fails.
    });
  }, [user?._id, user?.id]);

  useEffect(() => {
    const refreshAuthoritativeRole = () => {
      if (document.visibilityState === 'visible' && localStorage.getItem('acadova_token')) {
        refreshUser();
      }
    };

    window.addEventListener('focus', refreshAuthoritativeRole);
    document.addEventListener('visibilitychange', refreshAuthoritativeRole);
    return () => {
      window.removeEventListener('focus', refreshAuthoritativeRole);
      document.removeEventListener('visibilitychange', refreshAuthoritativeRole);
    };
  }, [refreshUser]);

  const establishSession = useCallback(async (res) => {
    if (res && res.success && res.data) {
      const { token: newToken, user: userData } = res.data;
      setAuthNotice('');
      localStorage.setItem('acadova_token', newToken);
      localStorage.setItem('acadova_user', JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);
      // Asynchronously load full profile (which includes skills arrays, etc.)
      try {
        const fullProfile = await userService.getMe();
        if (localStorage.getItem('acadova_token') === newToken && fullProfile?.data) {
          setUser(fullProfile.data);
          localStorage.setItem('acadova_user', JSON.stringify(fullProfile.data));
        }
      } catch {
        // use basic userData
      }
      if (localStorage.getItem('acadova_token') !== newToken) {
        throw new Error('Your account could not access Acadova. Please check the account notice.');
      }
      return res;
    }
    throw new Error(res?.message || 'Login failed');
  }, []);
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
