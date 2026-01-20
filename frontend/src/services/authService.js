/**
 * Authentication Service
 * Handles login, token storage, and token retrieval
 */

import axios from 'axios';

// Use full backend URL in development, relative path in production
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? import.meta.env.VITE_API_URL || '/api/v1'
  : '/api/v1';

export const authService = {
  /**
   * Login with email and password
   * Returns: { accessToken, refreshToken, user }
   */
  async login(email, password) {
    try {
      console.log('[authService] Sending login request to:', `${API_BASE_URL}/auth/login`);
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
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
          await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
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

      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
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

/**
 * Create axios instance with auth header
 */
export const createAuthenticatedAxios = () => {
  const token = authService.getToken();
  const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (token) {
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Add response interceptor to handle 401
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const newToken = await authService.refreshToken();
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        } catch (refreshError) {
          authService.logout();
          window.location.href = '/login'; // Redirect to login
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return axiosInstance;
};

export default authService;
