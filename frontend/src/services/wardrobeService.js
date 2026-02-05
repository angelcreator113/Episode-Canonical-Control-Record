import api from './api';

/**
 * Wardrobe Service - API calls for wardrobe management
 */
const wardrobeService = {
  /**
   * Get all wardrobe items for a show
   */
  getShowWardrobe: async (showId) => {
    return api.get(`/api/v1/shows/${showId}/wardrobe`);
  },

  /**
   * Get wardrobe items for an episode
   */
  getEpisodeWardrobe: async (episodeId) => {
    return api.get(`/api/v1/episodes/${episodeId}/wardrobe`);
  },

  /**
   * Get wardrobe item by ID
   */
  getWardrobeItem: async (itemId) => {
    return api.get(`/api/v1/wardrobe/${itemId}`);
  },

  /**
   * Create new wardrobe item
   */
  createWardrobeItem: async (data) => {
    return api.post('/api/v1/wardrobe', data);
  },

  /**
   * Update wardrobe item
   */
  updateWardrobeItem: async (itemId, data) => {
    return api.put(`/api/v1/wardrobe/${itemId}`, data);
  },

  /**
   * Delete wardrobe item
   */
  deleteWardrobeItem: async (itemId) => {
    return api.delete(`/api/v1/wardrobe/${itemId}`);
  },

  /**
   * Get wardrobe items grouped by character
   */
  getWardrobeByCharacter: async (showId) => {
    const response = await api.get(`/api/v1/shows/${showId}/wardrobe`);
    const items = response.data || [];
    
    // Group by character
    const grouped = items.reduce((acc, item) => {
      const character = item.character || 'Unassigned';
      if (!acc[character]) {
        acc[character] = [];
      }
      acc[character].push(item);
      return acc;
    }, {});
    
    return { data: grouped };
  },
};

export default wardrobeService;
