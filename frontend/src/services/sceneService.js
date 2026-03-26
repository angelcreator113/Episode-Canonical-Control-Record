/**
 * Scene Service
 * API calls for scene management
 */

import api from './api';

const sceneService = {
  // List scenes for an episode (from episode_scenes table)
  async getScenes(episodeId, params = {}) {
    const { data } = await api.get(`/api/v1/episodes/${episodeId}/scenes`, { 
      params: {
        ...params,
        include: 'thumbnail' // ← ADD THIS to fetch thumbnail data
      }
    });
    return data;
  },

  // Alias for getScenes (used by Timeline component)
  async getEpisodeScenes(episodeId, params = {}) {
    return this.getScenes(episodeId, params);
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

  // ============================================================================
  // PHASE 1: SCENE COMPOSER API METHODS
  // ============================================================================

  /**
   * Calculate scene duration from video clips
   * POST /api/v1/scenes/:id/calculate-duration
   */
  calculateDuration: async (sceneId) => {
    const { data } = await api.post(`/api/v1/scenes/${sceneId}/calculate-duration`);
    return data;
  },

  /**
   * Check scene completeness (has required assets)
   * GET /api/v1/scenes/:id/completeness
   */
  checkCompleteness: async (sceneId) => {
    const { data } = await api.get(`/api/v1/scenes/${sceneId}/completeness`);
    return data;
  },

  /**
   * Add asset to scene with role and metadata
   * POST /api/v1/scenes/:id/assets
   * @param {string} sceneId
   * @param {object} assetData - { assetId, roleKey, metadata }
   */
  addAssetToScene: async (sceneId, assetData) => {
    const { data } = await api.post(`/api/v1/scenes/${sceneId}/assets`, assetData);
    return data;
  },

  /**
   * List scene assets with optional role filtering
   * GET /api/v1/scenes/:id/assets?role=BG.MAIN
   */
  listSceneAssets: async (sceneId, role = null) => {
    const params = role ? { role } : {};
    const { data } = await api.get(`/api/v1/scenes/${sceneId}/assets`, { params });
    return data;
  },

  /**
   * Update scene asset metadata
   * PUT /api/v1/scenes/:id/assets/:asset_id
   * @param {string} sceneId
   * @param {string} assetId
   * @param {object} updates - { metadata: { x, y, scale, etc } }
   */
  updateSceneAssetMetadata: async (sceneId, assetId, updates) => {
    const { data } = await api.put(`/api/v1/scenes/${sceneId}/assets/${assetId}`, updates);
    return data;
  },

  /**
   * Remove asset from scene
   * DELETE /api/v1/scenes/:id/assets/:asset_id
   */
  removeSceneAssetFromScene: async (sceneId, assetId) => {
    const { data } = await api.delete(`/api/v1/scenes/${sceneId}/assets/${assetId}`);
    return data;
  },
  // ============================================================================
  // SCENE STUDIO API METHODS (Canvas-based editor)
  // ============================================================================

  /**
   * Load canvas state — objects + canvas settings + variant groups
   * GET /api/v1/scenes/:id/canvas
   */
  getCanvas: async (sceneId) => {
    const { data } = await api.get(`/api/v1/scenes/${sceneId}/canvas`);
    return data;
  },

  /**
   * Bulk save canvas state — all objects + canvas settings
   * PUT /api/v1/scenes/:id/canvas
   * @param {string} sceneId
   * @param {object} payload - { objects: [...], canvas_settings: {...} }
   */
  saveCanvas: async (sceneId, payload) => {
    const { data } = await api.put(`/api/v1/scenes/${sceneId}/canvas`, payload);
    return data;
  },

  /**
   * Add a new object to the canvas
   * POST /api/v1/scenes/:id/objects
   * @param {string} sceneId
   * @param {object} objectData - { asset_id, object_type, object_label, x, y, width, height, ... }
   */
  addCanvasObject: async (sceneId, objectData) => {
    const { data } = await api.post(`/api/v1/scenes/${sceneId}/objects`, objectData);
    return data;
  },

  /**
   * Update a single canvas object
   * PATCH /api/v1/scenes/:id/objects/:objectId
   */
  updateCanvasObject: async (sceneId, objectId, updates) => {
    const { data } = await api.patch(`/api/v1/scenes/${sceneId}/objects/${objectId}`, updates);
    return data;
  },

  /**
   * Delete a canvas object
   * DELETE /api/v1/scenes/:id/objects/:objectId
   */
  deleteCanvasObject: async (sceneId, objectId) => {
    const { data } = await api.delete(`/api/v1/scenes/${sceneId}/objects/${objectId}`);
    return data;
  },

  /**
   * Duplicate a canvas object
   * POST /api/v1/scenes/:id/objects/:objectId/duplicate
   */
  duplicateCanvasObject: async (sceneId, objectId) => {
    const { data } = await api.post(`/api/v1/scenes/${sceneId}/objects/${objectId}/duplicate`);
    return data;
  },

  /**
   * Create a variant of an object
   * POST /api/v1/scenes/:id/objects/:objectId/variants
   * @param {object} variantData - { variant_label, variant_group_name, new_asset_id }
   */
  createObjectVariant: async (sceneId, objectId, variantData) => {
    const { data } = await api.post(
      `/api/v1/scenes/${sceneId}/objects/${objectId}/variants`,
      variantData
    );
    return data;
  },

  /**
   * Switch active variant in a group
   * PATCH /api/v1/scenes/:id/variant-groups/:groupId/activate
   * @param {object} body - { variant_id }
   */
  activateVariant: async (sceneId, groupId, variantId) => {
    const { data } = await api.patch(
      `/api/v1/scenes/${sceneId}/variant-groups/${groupId}/activate`,
      { variant_id: variantId }
    );
    return data;
  },

  /**
   * Get variant group details with all variants
   * GET /api/v1/scenes/:id/variant-groups/:groupId
   */
  getVariantGroup: async (sceneId, groupId) => {
    const { data } = await api.get(`/api/v1/scenes/${sceneId}/variant-groups/${groupId}`);
    return data;
  },
  // ============================================================================
  // SCENE SET STUDIO API METHODS
  // ============================================================================

  /**
   * Update a scene set (name, notes, etc.)
   * PUT /api/v1/scene-sets/:id
   */
  updateSceneSet: async (sceneSetId, updates) => {
    const { data } = await api.put(`/api/v1/scene-sets/${sceneSetId}`, updates);
    return data;
  },

  /**
   * Load canvas state for a scene set
   * GET /api/v1/scene-sets/:id/canvas
   */
  getSceneSetCanvas: async (sceneSetId, angleId = null) => {
    const params = angleId ? { angle_id: angleId } : {};
    const { data } = await api.get(`/api/v1/scene-sets/${sceneSetId}/canvas`, { params });
    return data;
  },

  /**
   * Bulk save canvas state for a scene set
   * PUT /api/v1/scene-sets/:id/canvas
   */
  saveSceneSetCanvas: async (sceneSetId, payload) => {
    const { data } = await api.put(`/api/v1/scene-sets/${sceneSetId}/canvas`, payload);
    return data;
  },

  /**
   * Add object to scene set canvas
   * POST /api/v1/scene-sets/:id/objects
   */
  addSceneSetObject: async (sceneSetId, objectData) => {
    const { data } = await api.post(`/api/v1/scene-sets/${sceneSetId}/objects`, objectData);
    return data;
  },

  /**
   * Update object on scene set canvas
   * PATCH /api/v1/scene-sets/:id/objects/:objectId
   */
  updateSceneSetObject: async (sceneSetId, objectId, updates) => {
    const { data } = await api.patch(`/api/v1/scene-sets/${sceneSetId}/objects/${objectId}`, updates);
    return data;
  },

  /**
   * Delete object from scene set canvas
   * DELETE /api/v1/scene-sets/:id/objects/:objectId
   */
  deleteSceneSetObject: async (sceneSetId, objectId) => {
    const { data } = await api.delete(`/api/v1/scene-sets/${sceneSetId}/objects/${objectId}`);
    return data;
  },

  /**
   * Generate depth map for a scene background
   * POST /api/v1/scenes/:id/generate-depth
   */
  generateDepth: async (sceneId, imageUrl) => {
    const { data } = await api.post(`/api/v1/scenes/${sceneId}/generate-depth`, {
      image_url: imageUrl || undefined,
    });
    return data;
  },

  /**
   * Generate depth map for a scene set angle
   * POST /api/v1/scene-sets/:id/angles/:angleId/generate-depth
   */
  generateAngleDepth: async (sceneSetId, angleId) => {
    const { data } = await api.post(`/api/v1/scene-sets/${sceneSetId}/angles/${angleId}/generate-depth`);
    return data;
  },

  /**
   * Regenerate background variation with mood/time-of-day
   * POST /api/v1/scenes/:id/regenerate-background
   */
  regenerateBackground: async (sceneId, { mood, timeOfDay, currentBackgroundUrl } = {}) => {
    const { data } = await api.post(`/api/v1/scenes/${sceneId}/regenerate-background`, {
      mood,
      time_of_day: timeOfDay,
      current_background_url: currentBackgroundUrl,
    });
    return data;
  },

  /**
   * Get smart object suggestions for a scene
   * POST /api/v1/scenes/:id/suggest-objects
   */
  suggestObjects: async (sceneId) => {
    const { data } = await api.post(`/api/v1/scenes/${sceneId}/suggest-objects`);
    return data;
  },

  /**
   * Inpaint (remove/fill) an area of the scene background
   * POST /api/v1/scenes/:id/inpaint
   */
  inpaintScene: async (sceneId, {
    imageUrl,
    maskDataUrl,
    prompt,
    strength,
    mode,
    strictRemove,
    maskExpand,
    maskFeather,
  } = {}) => {
    const { data } = await api.post(`/api/v1/scenes/${sceneId}/inpaint`, {
      image_url: imageUrl,
      mask_data_url: maskDataUrl,
      prompt,
      strength,
      mode,
      strict_remove: strictRemove,
      mask_expand: maskExpand,
      mask_feather: maskFeather,
    });
    return data;
  },

  /**
   * Smart Select — SAM click-to-segment
   * POST /api/v1/scenes/:id/segment
   */
  segmentObject: async (sceneId, { imageUrl, pointX, pointY } = {}) => {
    const { data } = await api.post(`/api/v1/scenes/${sceneId}/segment`, {
      image_url: imageUrl,
      point_x: pointX,
      point_y: pointY,
    });
    return data;
  },

  /**
   * Animate scene via Runway image-to-video
   * POST /api/v1/scenes/:id/animate
   */
  animateScene: async (sceneId, { imageUrl, prompt, duration, cameraMotion } = {}) => {
    const { data } = await api.post(`/api/v1/scenes/${sceneId}/animate`, {
      image_url: imageUrl,
      prompt,
      duration,
      camera_motion: cameraMotion,
    });
    return data;
  },
};

export default sceneService;
