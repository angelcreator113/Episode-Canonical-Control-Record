/**
 * Marker Service
 * API calls for timeline marker management (Phase 2)
 */

import api from './api';

const markerService = {
  /**
   * Get all markers for an episode
   * @param {string} episodeId - Episode UUID
   * @param {object} params - Query parameters (marker_type, category, start_time, end_time, include)
   * @returns {Promise} Marker list with metadata
   */
  async getEpisodeMarkers(episodeId, params = {}) {
    const { data } = await api.get(`/api/v1/episodes/${episodeId}/markers`, { params });
    return data;
  },

  /**
   * Get single marker by ID
   * @param {string} markerId - Marker UUID
   * @param {object} params - Query parameters (include)
   * @returns {Promise} Marker data
   */
  async getMarker(markerId, params = {}) {
    const { data } = await api.get(`/api/v1/markers/${markerId}`, { params });
    return data;
  },

  /**
   * Create new marker
   * @param {string} episodeId - Episode UUID
   * @param {object} markerData - Marker properties
   * @param {number} markerData.timecode - Position in seconds (required)
   * @param {string} markerData.title - Marker title
   * @param {string} markerData.marker_type - Type (note, chapter, cue, script, deliverable)
   * @param {string} markerData.category - Category
   * @param {string} markerData.color - Hex color code
   * @param {string} markerData.description - Description
   * @param {string[]} markerData.tags - Array of tags
   * @param {string} markerData.scene_id - Optional scene reference
   * @returns {Promise} Created marker
   */
  async createMarker(episodeId, markerData) {
    const { data } = await api.post(`/api/v1/episodes/${episodeId}/markers`, markerData);
    return data;
  },

  /**
   * Update marker
   * @param {string} markerId - Marker UUID
   * @param {object} updates - Fields to update
   * @returns {Promise} Updated marker
   */
  async updateMarker(markerId, updates) {
    const { data } = await api.put(`/api/v1/markers/${markerId}`, updates);
    return data;
  },

  /**
   * Delete marker
   * @param {string} markerId - Marker UUID
   * @returns {Promise} Success confirmation
   */
  async deleteMarker(markerId) {
    const { data } = await api.delete(`/api/v1/markers/${markerId}`);
    return data;
  },

  /**
   * Auto-link marker to containing scene
   * @param {string} markerId - Marker UUID
   * @returns {Promise} Updated marker with scene link
   */
  async autoLinkScene(markerId) {
    const { data } = await api.post(`/api/v1/markers/${markerId}/auto-scene-link`);
    return data;
  },

  /**
   * Get markers by type
   * @param {string} episodeId - Episode UUID
   * @param {string} markerType - Type (note, chapter, cue, script, deliverable)
   * @returns {Promise} Filtered marker list
   */
  async getMarkersByType(episodeId, markerType) {
    const { data } = await api.get(`/api/v1/episodes/${episodeId}/markers/by-type/${markerType}`);
    return data;
  },

  /**
   * Get markers within time range
   * @param {string} episodeId - Episode UUID
   * @param {number} startTime - Start time in seconds
   * @param {number} endTime - End time in seconds
   * @returns {Promise} Markers within range
   */
  async getMarkersInRange(episodeId, startTime, endTime) {
    const { data } = await api.get(`/api/v1/episodes/${episodeId}/markers`, {
      params: {
        start_time: startTime,
        end_time: endTime,
      },
    });
    return data;
  },

  /**
   * Batch create markers
   * @param {string} episodeId - Episode UUID
   * @param {object[]} markers - Array of marker data objects
   * @returns {Promise} Array of created markers
   */
  async batchCreateMarkers(episodeId, markers) {
    const promises = markers.map((marker) => this.createMarker(episodeId, marker));
    return Promise.all(promises);
  },

  /**
   * Batch update markers
   * @param {object[]} updates - Array of {id, ...updates} objects
   * @returns {Promise} Array of updated markers
   */
  async batchUpdateMarkers(updates) {
    const promises = updates.map(({ id, ...markerUpdates }) =>
      this.updateMarker(id, markerUpdates)
    );
    return Promise.all(promises);
  },

  /**
   * Batch delete markers
   * @param {string[]} markerIds - Array of marker UUIDs
   * @returns {Promise} Array of deletion confirmations
   */
  async batchDeleteMarkers(markerIds) {
    const promises = markerIds.map((id) => this.deleteMarker(id));
    return Promise.all(promises);
  },
};

export default markerService;
