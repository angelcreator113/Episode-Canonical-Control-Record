import api from './api';

/**
 * Episode Assets Service
 * API calls for episode-level asset library management
 */

const episodeAssetsService = {
  /**
   * List assets in episode library
   */
  listEpisodeAssets: async (episodeId, params = {}) => {
    const response = await api.get(`/api/v1/episodes/${episodeId}/library-assets`, { params });
    return response.data;
  },

  /**
   * Get asset folders for episode
   */
  getAssetFolders: async (episodeId) => {
    const response = await api.get(`/api/v1/episodes/${episodeId}/library-assets/folders`);
    return response.data;
  },

  /**
   * Add asset to episode library
   */
  addAssetToEpisode: async (episodeId, data) => {
    const response = await api.post(`/api/v1/episodes/${episodeId}/library-assets`, data);
    return response.data;
  },

  /**
   * Update episode asset metadata
   */
  updateEpisodeAsset: async (episodeId, assetId, data) => {
    const response = await api.patch(`/api/v1/episodes/${episodeId}/library-assets/${assetId}`, data);
    return response.data;
  },

  /**
   * Remove asset from episode
   */
  removeAssetFromEpisode: async (episodeId, assetId, deleteTimeline = false) => {
    const response = await api.delete(`/api/v1/episodes/${episodeId}/library-assets/${assetId}`, {
      params: { deleteTimeline },
    });
    return response.data;
  },
};

export default episodeAssetsService;
