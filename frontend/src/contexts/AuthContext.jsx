/**
 * AuthContext - Centralized Authentication State Management
 * Provides authentication state to all components
 */

import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Initialize from localStorage to prevent flickering
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Initialize as true if token exists to prevent flicker
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('authToken');
  });

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          const profile = authService.getProfile();
          setUser(profile || { email: 'user' });
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('[AuthContext] Check auth error:', err.message);
        setError(err.message);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for logout event
    const handleUnauthorized = () => {
      setUser(null);
      setIsAuthenticated(false);
    };

    // Listen for storage changes (logout in other tabs or manual localStorage changes)
    const handleStorageChange = (e) => {
      if (e.key === 'authToken' && !e.newValue) {
        // Token was removed, user logged out
        setUser(null);
        setIsAuthenticated(false);
      }
    };

    window.addEventListener('unauthorized', handleUnauthorized);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('unauthorized', handleUnauthorized);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.login(email, password);
      const user = response?.user || { email };
      setUser(user);
      setIsAuthenticated(true);
      return response;
    } catch (err) {
      // Message and status only: an axios error carries the login body (Task #1976).
      console.error('[AuthContext] Login error:', err.message, err.response?.status);
      setError(err.message);
      setIsAuthenticated(false);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      // Clear backend/storage first
      await authService.logout();
      
      // Then clear state
      setUser(null);
      setIsAuthenticated(false);
    } catch (err) {
      console.error('[AuthContext] Logout error:', err.message);
      setError(err.message);
      // Still clear state even if backend call fails
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
