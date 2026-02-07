import api from './api';

/**
 * Decision Logging Service
 * Handles all decision tracking API calls
 */

/**
 * Log a user decision
 * @param {Object} decisionData - Decision details
 * @returns {Promise<Object>} Created decision
 */
export const logDecision = async (decisionData) => {
  const {
    episode_id,
    scene_id,
    decision_type,
    decision_category,
    chosen_option,
    rejected_options,
    was_ai_suggestion,
    ai_confidence_score,
    user_rating,
    user_notes,
    context_data,
  } = decisionData;

  const response = await api.post('/api/v1/decisions', {
    episode_id,
    scene_id,
    decision_type,
    decision_category,
    chosen_option,
    rejected_options,
    was_ai_suggestion: was_ai_suggestion || false,
    ai_confidence_score,
    user_rating,
    user_notes,
    context_data,
  });

  return response.data;
};

/**
 * Get decisions with optional filters
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Object>} Decisions list
 */
export const getDecisions = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.episode_id) params.append('episode_id', filters.episode_id);
  if (filters.scene_id) params.append('scene_id', filters.scene_id);
  if (filters.decision_type) params.append('decision_type', filters.decision_type);
  if (filters.decision_category) params.append('decision_category', filters.decision_category);
  if (filters.was_ai_suggestion !== undefined) {
    params.append('was_ai_suggestion', filters.was_ai_suggestion);
  }
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);

  const response = await api.get(`/api/v1/decisions?${params.toString()}`);
  return response.data;
};

/**
 * Get single decision by ID
 * @param {string} decisionId - Decision ID
 * @returns {Promise<Object>} Decision details
 */
export const getDecision = async (decisionId) => {
  const response = await api.get(`/api/v1/decisions/${decisionId}`);
  return response.data;
};

/**
 * Get decision statistics for an episode
 * @param {string} episodeId - Episode ID
 * @returns {Promise<Object>} Statistics
 */
export const getEpisodeStats = async (episodeId) => {
  const response = await api.get(`/api/v1/decisions/episode/${episodeId}/stats`);
  return response.data;
};

/**
 * Get learned patterns
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Object>} Patterns list
 */
export const getPatterns = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.pattern_type) params.append('pattern_type', filters.pattern_type);
  if (filters.pattern_category) params.append('pattern_category', filters.pattern_category);
  if (filters.min_confidence) params.append('min_confidence', filters.min_confidence);

  const response = await api.get(`/api/v1/decisions/patterns?${params.toString()}`);
  return response.data;
};

/**
 * Helper: Create decision data object
 */
export const createDecisionData = {
  sceneDuration: (episodeId, sceneId, duration, previousDuration = null) => ({
    episode_id: episodeId,
    scene_id: sceneId,
    decision_type: 'scene_duration',
    decision_category: 'timing',
    chosen_option: { duration, unit: 'seconds' },
    rejected_options: previousDuration ? [{ duration: previousDuration }] : null,
    context_data: { changed_from: previousDuration },
  }),

  assetSelection: (episodeId, sceneId, assetId, assetType, rejectedAssets = []) => ({
    episode_id: episodeId,
    scene_id: sceneId,
    decision_type: 'asset_selection',
    decision_category: 'content',
    chosen_option: { asset_id: assetId, asset_type: assetType },
    rejected_options: rejectedAssets.map(id => ({ asset_id: id })),
    context_data: { total_options: rejectedAssets.length + 1 },
  }),

  sceneLink: (episodeId, scriptMetadataId, footageId, matchType, confidence) => ({
    episode_id: episodeId,
    scene_id: footageId, // Reference the actual footage scene
    decision_type: 'scene_linking',
    decision_category: 'content',
    chosen_option: { 
      script_metadata_id: scriptMetadataId, 
      footage_id: footageId, 
      match_type: matchType 
    },
    was_ai_suggestion: matchType === 'auto',
    ai_confidence_score: confidence,
    context_data: { 
      script_metadata_id: scriptMetadataId,
      match_type: matchType 
    },
  }),

  aiSuggestionFeedback: (episodeId, decisionType, suggestion, accepted, rating) => ({
    episode_id: episodeId,
    decision_type: decisionType,
    decision_category: 'ai_feedback',
    chosen_option: { accepted, suggestion },
    was_ai_suggestion: true,
    user_rating: rating,
    context_data: { suggestion_details: suggestion },
  }),
};

export default {
  logDecision,
  getDecisions,
  getDecision,
  getEpisodeStats,
  getPatterns,
  createDecisionData,
};
