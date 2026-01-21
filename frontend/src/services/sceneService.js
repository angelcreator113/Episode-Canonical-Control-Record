/**
 * Scene Service
 * API calls for scene management
 */

import api from './api';

const sceneService = {
  // List scenes for an episode
  async getScenes(episodeId, params = {}) {
    const { data } = await api.get(`/api/v1/episodes/${episodeId}/scenes`, { 
      params: {
        ...params,
        include: 'thumbnail' // ← ADD THIS to fetch thumbnail data
      }
    });
    return data;
  },

  // Get single scene
  async getScene(sceneId) {
    const { data } = await api.get(`/api/v1/scenes/${sceneId}`, {
      params: { include: 'thumbnail' } // ← ADD THIS
    });
    return data;
  },

  // Create new scene
  async createScene(sceneData) {
    const { data } = await api.post('/api/v1/scenes', sceneData);
    return data;
  },

  // Update scene
  async updateScene(sceneId, sceneData) {
    const { data } = await api.put(`/api/v1/scenes/${sceneId}`, sceneData);
    return data;
  },

  // Delete scene
  async deleteScene(sceneId) {
    const { data } = await api.delete(`/api/v1/scenes/${sceneId}`);
    return data;
  },

  // Reorder scenes
  async reorderScenes(episodeId, sceneIds) {
    const { data } = await api.put(`/api/v1/episodes/${episodeId}/scenes/reorder`, {
      sceneIds
    });
    return data;
  },

  // Update scene status
  async updateSceneStatus(sceneId, status) {
    const { data } = await api.put(`/api/v1/scenes/${sceneId}/status`, { status });
    return data;
  },

  // Add character to scene
  async addCharacter(sceneId, characterName) {
    const { data } = await api.post(`/api/v1/scenes/${sceneId}/characters`, {
      characterName
    });
    return data;
  },

  // Remove character from scene
  async removeCharacter(sceneId, characterName) {
    const { data } = await api.delete(`/api/v1/scenes/${sceneId}/characters/${characterName}`);
    return data;
  },

  // Get scene statistics
  async getSceneStats(episodeId) {
    const { data } = await api.get(`/api/v1/episodes/${episodeId}/scenes/stats`);
    return data;
  },

  // NEW: Set scene thumbnail
  async setSceneThumbnail(sceneId, thumbnailId) {
    const { data } = await api.put(`/api/v1/scenes/${sceneId}/thumbnail`, {
      thumbnailId
    });
    return data;
  },

  // NEW: Update scene assets
  async updateSceneAssets(sceneId, assets) {
    const { data } = await api.put(`/api/v1/scenes/${sceneId}/assets`, {
      assets
    });
    return data;
  },

  // NEW: Get scene assets
  async getSceneAssets(sceneId) {
    const { data } = await api.get(`/api/v1/scenes/${sceneId}/assets`);
    return data;
  },

  // NEW: Add asset to scene
  async addSceneAsset(sceneId, assetData) {
    const { data } = await api.post(`/api/v1/scenes/${sceneId}/assets`, assetData);
    return data;
  },

  // NEW: Remove asset from scene
  async removeSceneAsset(sceneId, assetId, usageType = null) {
    const params = usageType ? { usageType } : {};
    const { data } = await api.delete(`/api/v1/scenes/${sceneId}/assets/${assetId}`, { params });
    return data;
  },

  // NEW: Update scene asset positioning/timing
  async updateSceneAssetDetails(sceneId, assetId, updates) {
    const { data } = await api.patch(`/api/v1/scenes/${sceneId}/assets/${assetId}`, updates);
    return data;
  },

  /**
   * Duplicate a scene
   */
  duplicateScene: async (sceneId) => {
    const response = await api.post(`/scenes/${sceneId}/duplicate`);
    return response.data;
  },
};

export default sceneService;
