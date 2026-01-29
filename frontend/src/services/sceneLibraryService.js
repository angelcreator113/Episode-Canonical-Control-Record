/**
 * Scene Library Service
 * API client for scene library operations
 */

import api from './api';

const sceneLibraryService = {
  /**
   * List all scene library clips
   * @param {Object} params - Query parameters (showId, search, tags, processingStatus, sortBy, limit, offset)
   * @returns {Promise} List of scene library clips
   */
  async listScenes(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const response = await api.get(`/api/v1/scene-library?${queryString}`);
    return response.data;
  },

  /**
   * Get single scene library clip
   * @param {string} id - Scene library ID
   * @returns {Promise} Scene library clip details
   */
  async getScene(id) {
    const response = await api.get(`/api/v1/scene-library/${id}`);
    return response.data;
  },

  /**
   * Upload new video clip to scene library
   * @param {File} file - Video file
   * @param {Object} metadata - {showId, title, description, tags, characters}
   * @param {Function} onProgress - Progress callback
   * @returns {Promise} Created scene library clip
   */
  async uploadScene(file, metadata, onProgress) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('showId', metadata.showId);

    if (metadata.title) formData.append('title', metadata.title);
    if (metadata.description) formData.append('description', metadata.description);
    if (metadata.tags && metadata.tags.length > 0) {
      formData.append('tags', JSON.stringify(metadata.tags));
    }
    if (metadata.characters && metadata.characters.length > 0) {
      formData.append('characters', JSON.stringify(metadata.characters));
    }

    const response = await api.post('/api/v1/scene-library/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });

    return response.data;
  },

  /**
   * Update scene library metadata
   * @param {string} id - Scene library ID
   * @param {Object} data - {title, description, tags, characters}
   * @returns {Promise} Updated scene library clip
   */
  async updateScene(id, data) {
    const response = await api.put(`/api/v1/scene-library/${id}`, data);
    return response.data;
  },

  /**
   * Delete scene library clip (soft delete)
   * @param {string} id - Scene library ID
   * @returns {Promise} Deletion confirmation
   */
  async deleteScene(id) {
    const response = await api.delete(`/api/v1/scene-library/${id}`);
    return response.data;
  },

  /**
   * Get all unique tags from scene library
   * @returns {Promise} Array of tag strings
   */
  async getAllTags() {
    // This would require a new endpoint, for now we'll extract from list
    const response = await this.listScenes({ limit: 1000 });
    const tags = new Set();

    response.data.forEach((scene) => {
      if (scene.tags && Array.isArray(scene.tags)) {
        scene.tags.forEach((tag) => tags.add(tag));
      }
    });

    return Array.from(tags).sort();
  },

  /**
   * Get all unique characters from scene library
   * @returns {Promise} Array of character strings
   */
  async getAllCharacters() {
    // This would require a new endpoint, for now we'll extract from list
    const response = await this.listScenes({ limit: 1000 });
    const characters = new Set();

    response.data.forEach((scene) => {
      if (scene.characters && Array.isArray(scene.characters)) {
        scene.characters.forEach((char) => characters.add(char));
      }
    });

    return Array.from(characters).sort();
  },
};

export default sceneLibraryService;
