/**
 * Show Service
 * Handles all API calls for show management
 *
 * Track 6 CP9: migrated to apiClient. Service contract preserved —
 * each method returns the same shape (result.data || []) per the
 * pre-migration contract. apiClient injects auth via the request
 * interceptor; explicit Content-Type headers removed (axios sets
 * it automatically). Throw-on-error blocks collapsed because
 * apiClient interceptor throws on non-2xx; the surrounding try/catch
 * already routes errors to console.error + re-throw.
 */

import apiClient from './api';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export const showService = {
  /**
   * Get all shows
   */
  async getAllShows() {
    try {
      const response = await apiClient.get(`${API_BASE}/shows`);
      return response.data?.data || [];
    } catch (error) {
      console.error('Error fetching shows:', error);
      throw error;
    }
  },

  /**
   * Get a single show by ID
   */
  async getShowById(id) {
    try {
      const response = await apiClient.get(`${API_BASE}/shows/${id}`);
      return response.data?.data;
    } catch (error) {
      console.error('Error fetching show:', error);
      throw error;
    }
  },

  /**
   * Create a new show
   */
  async createShow(showData) {
    try {
      const response = await apiClient.post(`${API_BASE}/shows`, showData);
      return response.data?.data;
    } catch (error) {
      console.error('Error creating show:', error);
      throw new Error(error.response?.data?.message || error.message || 'Failed to create show');
    }
  },

  /**
   * Update an existing show
   */
  async updateShow(id, showData) {
    try {
      const response = await apiClient.put(`${API_BASE}/shows/${id}`, showData);
      return response.data?.data;
    } catch (error) {
      console.error('Error updating show:', error);
      throw new Error(error.response?.data?.message || error.message || 'Failed to update show');
    }
  },

  /**
   * Delete a show
   */
  async deleteShow(id) {
    try {
      const response = await apiClient.delete(`${API_BASE}/shows/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting show:', error);
      throw new Error(error.response?.data?.message || error.message || 'Failed to delete show');
    }
  },
};

export default showService;
