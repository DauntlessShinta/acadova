import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import userService from '../services/userService';
import { setOnUnauthorized } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('acadova_token') || null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('acadova_token');
    localStorage.removeItem('acadova_user');
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem('acadova_token')) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const res = await userService.getMe();
      if (res && res.success && res.data) {
        setUser(res.data);
        localStorage.setItem('acadova_user', JSON.stringify(res.data));
        return res.data;
      }
    } catch (err) {
      console.warn('Failed to refresh user session:', err.message);
      // If unauthorized, clear
      if (err.status === 401) {
        logout();
      }
    } finally {
      setLoading(false);
    }
    return null;
  }, [logout]);

  useEffect(() => {
    setOnUnauthorized(() => {
      logout();
    });
    refreshUser();
  }, [refreshUser, logout]);

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    if (res && res.success && res.data) {
      const { token: newToken, user: userData } = res.data;
      localStorage.setItem('acadova_token', newToken);
      localStorage.setItem('acadova_user', JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);
      // Asynchronously load full profile (which includes skills arrays, etc.)
      try {
        const fullProfile = await userService.getMe();
        if (fullProfile?.data) {
          setUser(fullProfile.data);
          localStorage.setItem('acadova_user', JSON.stringify(fullProfile.data));
        }
      } catch {
        // use basic userData
      }
      return res;
    }
    throw new Error(res?.message || 'Login failed');
  };

  const register = async (formData) => {
    const res = await authService.register(formData);
    if (res && res.success && res.data) {
      const { token: newToken, user: userData } = res.data;
      localStorage.setItem('acadova_token', newToken);
      localStorage.setItem('acadova_user', JSON.stringify(userData));
      setToken(newToken);
      setUser(userData);
      try {
        const fullProfile = await userService.getMe();
        if (fullProfile?.data) {
          setUser(fullProfile.data);
          localStorage.setItem('acadova_user', JSON.stringify(fullProfile.data));
        }
      } catch {
        // use basic userData
      }
      return res;
    }
    throw new Error(res?.message || 'Registration failed');
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    isAdmin: user?.role === 'admin',
    isStudent: user?.role === 'student' || !user?.role || user?.role !== 'admin',
    credits: user?.credits ?? 0,
    login,
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

