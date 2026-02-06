import api from './api';

/**
 * Scene Links Service
 * Handles linking raw footage to AI-detected scenes
 */
const sceneLinksService = {
  /**
   * Create a manual link between footage and scene
   * @param {string} sceneId - AI scene ID
   * @param {string} footageId - Footage ID
   * @param {string} notes - Optional notes about the link
   * @param {string} createdBy - Optional user identifier
   * @returns {Promise<Object>}
   */
  async createLink(sceneId, footageId, notes = null, createdBy = null) {
    const response = await api.post('/api/scene-links', {
      sceneId,
      footageId,
      matchType: 'manual',
      notes,
      createdBy
    });
    return response.data;
  },

  /**
   * Get all scene links for an episode
   * @param {string} episodeId - Episode ID
   * @returns {Promise<Array>}
   */
  async getLinksByEpisode(episodeId) {
    const response = await api.get(`/api/scene-links/episode/${episodeId}`);
    return response.data;
  },

  /**
   * Delete a scene-footage link
   * @param {string} linkId - Link ID
   * @returns {Promise<Object>}
   */
  async deleteLink(linkId) {
    const response = await api.delete(`/api/scene-links/${linkId}`);
    return response.data;
  },

  /**
   * Auto-match footage to scenes
   * @param {string} episodeId - Episode ID
   * @param {string} scriptId - Script ID
   * @returns {Promise<Object>}
   */
  async autoMatch(episodeId, scriptId) {
    const response = await api.post('/api/scene-links/auto-match', {
      episodeId,
      scriptId
    });
    return response.data;
  }
};

export default sceneLinksService;
