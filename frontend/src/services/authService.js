/**
 * Authentication Service
 * Handles login, token storage, and token retrieval
 */

import api from './api';

export const authService = {
  /**
   * Login with email and password
   * Returns: { accessToken, refreshToken, user }
   */
  async login(email, password) {
    try {
      const response = await api.post('/api/v1/auth/login', {
        email,
        password,
        groups: ['USER', 'EDITOR'],
        role: 'USER',
      });

      if (response.data.data?.accessToken) {
        const { accessToken, refreshToken, user } = response.data.data;
        
        // Store tokens
        localStorage.setItem('authToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));
        
        return {
          accessToken,
          refreshToken,
          user,
          success: true,
        };
      }
      throw new Error('No token in response');
    } catch (error) {
      // Message and status only: the error object carries the request body
      // (email and password) and the response body (Task #1976).
      console.error('[authService] Login failed:', error.message, error.response?.status);
      throw error;
    }
  },

  /**
   * Get stored auth token
   */
  getToken() {
    return localStorage.getItem('authToken');
  },

  /**
   * Get stored refresh token
   */
  getRefreshToken() {
    return localStorage.getItem('refreshToken');
  },

  /**
   * Get stored user info
   */
  getUser() {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  /**
   * Get user profile (alias for getUser for compatibility)
   */
  getProfile() {
    return this.getUser();
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getToken();
  },

  /**
   * Logout - clear all stored auth data and call backend logout
   */
  async logout() {
    try {
      // Try to call backend logout endpoint. apiClient request interceptor
      // adds Authorization automatically — no explicit Bearer construction needed.
      if (this.getToken()) {
        try {
          await api.post('/api/v1/auth/logout', {});
        } catch (err) {
          console.warn('Backend logout failed (continuing with local logout):', err.message);
        }
      }
    } finally {
      // Always clear local storage regardless of backend response
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  },

  /**
   * Refresh access token
   */
  async refreshToken() {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const response = await api.post('/api/v1/auth/refresh', {
        refreshToken,
      });

      if (response.data.data?.accessToken) {
        const { accessToken } = response.data.data;
        localStorage.setItem('authToken', accessToken);
        return accessToken;
      }
      throw new Error('No token in refresh response');
    } catch (error) {
      // Message and status only: the request body carries the refresh token (Task #1976).
      console.error('Token refresh failed:', error.message, error.response?.status);
      this.logout();
      throw error;
    }
  },
};

export default authService;
