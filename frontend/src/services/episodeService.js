/**
 * Episode Service
 * API calls for episode management
 */

import api from './api';

export const episodeService = {
  // Get all episodes
  getEpisodes: async (page = 1, limit = 10, filters = {}) => {
    try {
      const params = new URLSearchParams({
        page,
        limit,
        ...filters,
      });
      const response = await api.get(`/api/v1/episodes?${params}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get episodes:', error);
      throw error;
    }
  },

  // Get single episode
  getEpisode: async (id) => {
    try {
      const response = await api.get(`/api/v1/episodes/${id}`);
      // Handle different response formats
      return response.data.data || response.data;
    } catch (error) {
      console.error('Failed to get episode:', error);
      throw error;
    }
  },

  // Create episode
  createEpisode: async (data) => {
    try {
      const response = await api.post('/api/v1/episodes', data);
      return response.data;
    } catch (error) {
      console.error('Failed to create episode:', error);
      throw error;
    }
  },

  // Update episode
  updateEpisode: async (id, data) => {
    try {
      const response = await api.put(`/api/v1/episodes/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to update episode:', error);
      throw error;
    }
  },

  // Delete episode
  deleteEpisode: async (id) => {
    try {
      const response = await api.delete(`/api/v1/episodes/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete episode:', error);
      throw error;
    }
  },

  // Search episodes
  searchEpisodes: async (query, page = 1) => {
    try {
      const response = await api.get(`/api/v1/search?q=${encodeURIComponent(query)}&page=${page}`);
      return response.data;
    } catch (error) {
      console.error('Failed to search episodes:', error);
      throw error;
    }
  },

  // Get metadata
  getMetadata: async (id) => {
    try {
      const response = await api.get(`/api/v1/metadata/${id}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get metadata:', error);
      // Return empty metadata instead of failing
      return { data: {} };
    }
  },

  // Update metadata
  updateMetadata: async (id, data) => {
    try {
      const response = await api.post(`/api/v1/metadata/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Failed to update metadata:', error);
      throw error;
    }
  },

  // Get templates (with fallback)
  getTemplates: async () => {
    try {
      const response = await api.get('/api/v1/templates');
      return response.data;
    } catch (error) {
      console.warn('Templates not available:', error.message);
      // Return empty array instead of failing
      return { data: [], count: 0 };
    }
  },

  // Get episode stats
  getStats: async () => {
    try {
      const response = await api.get('/api/v1/episodes/stats');
      return response.data;
    } catch (error) {
      console.warn('Stats not available:', error.message);
      return { data: {} };
    }
  },
};

export default episodeService;
