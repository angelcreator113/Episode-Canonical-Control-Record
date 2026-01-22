/**
 * Scripts Service
 * API calls for episode scripts management
 */

import api from './api';

export const scriptsService = {
  // Get all scripts for an episode
  getScriptsByEpisode: async (episodeId, options = {}) => {
    try {
      const params = new URLSearchParams();
      if (options.includeAllVersions) {
        params.append('includeAllVersions', 'true');
      }
      if (options.includeContent) {
        params.append('includeContent', 'true');
      }
      if (options.scriptType) {
        params.append('scriptType', options.scriptType);
      }

      const queryString = params.toString();
      const url = `/api/v1/episodes/${episodeId}/scripts${queryString ? `?${queryString}` : ''}`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Failed to get scripts:', error);
      throw error;
    }
  },

  // Get single script by ID
  getScriptById: async (scriptId, includeContent = true) => {
    try {
      const params = includeContent ? '?includeContent=true' : '';
      const response = await api.get(`/api/v1/scripts/${scriptId}${params}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get script:', error);
      throw error;
    }
  },

  // Get all versions of a script type
  getScriptVersions: async (episodeId, scriptType) => {
    try {
      const response = await api.get(`/api/v1/episodes/${episodeId}/scripts/${scriptType}/versions`);
      return response.data;
    } catch (error) {
      console.error('Failed to get script versions:', error);
      throw error;
    }
  },

  // Create new script
  createScript: async (episodeId, scriptData) => {
    try {
      const response = await api.post(`/api/v1/episodes/${episodeId}/scripts`, scriptData);
      return response.data;
    } catch (error) {
      console.error('Failed to create script:', error);
      throw error;
    }
  },

  // Update script
  updateScript: async (scriptId, updates) => {
    try {
      const response = await api.patch(`/api/v1/scripts/${scriptId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Failed to update script:', error);
      throw error;
    }
  },

  // Set script as primary
  setPrimary: async (scriptId) => {
    try {
      const response = await api.post(`/api/v1/scripts/${scriptId}/set-primary`);
      return response.data;
    } catch (error) {
      console.error('Failed to set primary script:', error);
      throw error;
    }
  },

  // Restore old version as current
  restoreVersion: async (scriptId) => {
    try {
      const response = await api.post(`/api/v1/scripts/${scriptId}/restore`);
      return response.data;
    } catch (error) {
      console.error('Failed to restore script version:', error);
      throw error;
    }
  },

  // Delete script
  deleteScript: async (scriptId) => {
    try {
      const response = await api.delete(`/api/v1/scripts/${scriptId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to delete script:', error);
      throw error;
    }
  },

  // Bulk delete scripts
  bulkDelete: async (scriptIds) => {
    try {
      const response = await api.post('/api/v1/scripts/bulk-delete', { scriptIds });
      return response.data;
    } catch (error) {
      console.error('Failed to bulk delete scripts:', error);
      throw error;
    }
  },

  // Search/filter scripts (library page)
  searchScripts: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      Object.keys(filters).forEach((key) => {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      });

      const queryString = params.toString();
      const url = `/api/v1/scripts/search${queryString ? `?${queryString}` : ''}`;
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('Failed to search scripts:', error);
      throw error;
    }
  },

  // Get edit history
  getEditHistory: async (scriptId) => {
    try {
      const response = await api.get(`/api/v1/scripts/${scriptId}/history`);
      return response.data;
    } catch (error) {
      console.error('Failed to get edit history:', error);
      throw error;
    }
  },

  // Upload script file
  uploadScript: async (episodeId, file, metadata) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      Object.keys(metadata).forEach((key) => {
        formData.append(key, metadata[key]);
      });

      const response = await api.post(`/api/v1/episodes/${episodeId}/scripts/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to upload script:', error);
      throw error;
    }
  },

  // Format duration (seconds to readable time)
  formatDuration: (seconds) => {
    if (!seconds) return '—';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  },

  // Parse duration (readable time to seconds)
  parseDuration: (timeString) => {
    if (!timeString) return null;
    const parts = timeString.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10);
      const seconds = parseInt(parts[1], 10);
      return minutes * 60 + seconds;
    }
    return null;
  },

  // Get script type label
  getScriptTypeLabel: (type) => {
    const labels = {
      trailer: 'Trailer',
      main: 'Main Script',
      shorts: 'Shorts',
      teaser: 'Teaser',
      'behind-the-scenes': 'Behind-the-Scenes',
      'bonus-content': 'Bonus Content',
    };
    return labels[type] || type;
  },

  // Get status badge color
  getStatusColor: (status) => {
    const colors = {
      draft: 'neutral',
      final: 'success',
      approved: 'success',
    };
    return colors[status] || 'neutral';
  },
};

export default scriptsService;
