/**
 * Script Parse Service (Frontend)
 * 
 * API client for the Script → Scene Plan bridge.
 * Used by Scene Composer to pre-populate scenes from episode scripts.
 * 
 * Location: frontend/src/services/scriptParseService.js
 */

import api from './api';

const scriptParseService = {
  /**
   * Parse raw script text into a Scene Plan (no episode required)
   * Good for preview/testing
   * 
   * @param {string} content - Raw script text with ## BEAT: tags
   * @param {string} [title] - Optional episode title
   * @returns {Promise<object>} Scene Plan
   */
  async parseRaw(content, title = null) {
    const response = await api.post('/api/v1/scripts/parse', { content, title });
    return response.data;
  },

  /**
   * Parse an episode's saved script into a Scene Plan
   * Reads from episode.script_content or episode_scripts table
   * Does NOT create scenes — preview only
   * 
   * @param {string} episodeId - Episode UUID
   * @param {string} [content] - Optional override script text
   * @returns {Promise<object>} Scene Plan
   */
  async parseEpisodeScript(episodeId, content = null) {
    const body = content ? { content } : {};
    const response = await api.post(`/api/v1/episodes/${episodeId}/parse-script`, body);
    return response.data;
  },

  /**
   * Parse script AND create scene records in the database
   * This is what Scene Composer calls to pre-populate scenes
   * 
   * @param {string} episodeId - Episode UUID
   * @param {object} [options]
   * @param {string} [options.content] - Override script text
   * @param {boolean} [options.clearExisting] - Delete existing scenes first
   * @returns {Promise<object>} Created scenes + Scene Plan
   */
  async applyScenePlan(episodeId, options = {}) {
    const response = await api.post(`/api/v1/episodes/${episodeId}/apply-scene-plan`, {
      content: options.content || undefined,
      clearExisting: options.clearExisting || false,
    });
    return response.data;
  },
};

export default scriptParseService;
