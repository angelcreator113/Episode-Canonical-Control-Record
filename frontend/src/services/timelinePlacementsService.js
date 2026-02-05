import api from './api';

/**
 * Timeline Placements Service
 * API calls for timeline placement management
 */

const timelinePlacementsService = {
  /**
   * List all placements for episode
   */
  listPlacements: async (episodeId, params = {}) => {
    const response = await api.get(`/api/v1/episodes/${episodeId}/timeline/placements`, { params });
    return response.data;
  },

  /**
   * Create a placement
   */
  createPlacement: async (episodeId, data) => {
    const response = await api.post(`/api/v1/episodes/${episodeId}/timeline/placements`, data);
    return response.data;
  },

  /**
   * Update a placement
   */
  updatePlacement: async (episodeId, placementId, data) => {
    const response = await api.patch(`/api/v1/episodes/${episodeId}/timeline/placements/${placementId}`, data);
    return response.data;
  },

  /**
   * Delete a placement
   */
  deletePlacement: async (episodeId, placementId) => {
    const response = await api.delete(`/api/v1/episodes/${episodeId}/timeline/placements/${placementId}`);
    return response.data;
  },

  /**
   * Get current wardrobe for character at scene (carry-forward logic)
   */
  getCurrentWardrobe: async (episodeId, params) => {
    const response = await api.get(`/api/v1/episodes/${episodeId}/timeline/wardrobe/current`, { params });
    return response.data;
  },
};

export default timelinePlacementsService;
