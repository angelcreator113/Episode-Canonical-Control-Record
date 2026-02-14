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
      console.log('[authService] Sending login request to:', '/api/v1/auth/login');
      const response = await api.post('/api/v1/auth/login', {
        email,
        password,
        groups: ['USER', 'EDITOR'],
        role: 'USER',
      });

      console.log('[authService] Login response received:', response.status);
      console.log('[authService] Response data:', response.data);

      if (response.data.data?.accessToken) {
        const { accessToken, refreshToken, user } = response.data.data;
        
        console.log('[authService] Storing tokens and user...');
        // Store tokens
        localStorage.setItem('authToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('user', JSON.stringify(user));
        
        console.log('[authService] Tokens stored successfully');
        return {
          accessToken,
          refreshToken,
          user,
          success: true,
        };
      }
      throw new Error('No token in response');
    } catch (error) {
      console.error('[authService] Login failed:', error);
      console.error('[authService] Error details:', {
        message: error.message,
        response: error.response?.status,
        responseData: error.response?.data,
        code: error.code,
      });
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
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
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
      // Try to call backend logout endpoint
      const token = this.getToken();
      if (token) {
        try {
          await api.post('/api/v1/auth/logout', {}, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
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
      console.error('Token refresh failed:', error);
      this.logout();
      throw error;
    }
  },
};

export default authService;
