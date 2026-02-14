const express = require('express');
const router = express.Router();

const episodeController = require('../controllers/episodeController');
const sceneController = require('../controllers/sceneController');
const wardrobeController = require('../controllers/wardrobeController');
const scriptsController = require('../controllers/scriptsController');
const outfitSetsController = require('../controllers/outfitSetsController');
const episodeAssetsController = require('../controllers/episodeAssetsController');
const timelinePlacementsController = require('../controllers/timelinePlacementsController');
const videoCompositionController = require('../controllers/videoCompositionController');
const { _authenticateToken } = require('../middleware/auth');
const { _requirePermission } = require('../middleware/rbac');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateEpisodeQuery, validateUUIDParam } = require('../middleware/requestValidation');

/**
 * Episode Routes
 * Base path: /api/v1/episodes
 *
 * ✅ AUTH TEMPORARILY DISABLED FOR TESTING
 */

// Test endpoint to verify basic functionality
router.get(
  '/test-create',
  asyncHandler(async (req, res) => {
    const { models } = require('../models');
    const { Episode } = models;

    try {
      const testEpisode = await Episode.create({
        title: 'Test Episode ' + Date.now(),
        episode_number: Math.floor(Math.random() * 1000),
        status: 'draft',
        description: 'Test episode for debugging',
        categories: ['test'],
      });

      res.json({
        success: true,
        message: 'Test episode created successfully',
        episode: testEpisode,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        name: error.name,
        sql: error.sql,
      });
    }
  })
);

// List episodes
router.get('/', validateEpisodeQuery, asyncHandler(episodeController.listEpisodes));

// ==================== WARDROBE ROUTES ====================
// These must come BEFORE /:id route to avoid being caught by it

// GET /api/v1/episodes/:id/wardrobe - Get all wardrobe items for episode
router.get(
  '/:id/wardrobe',
  validateUUIDParam('id'),
  asyncHandler(wardrobeController.getEpisodeWardrobe)
);

// POST /api/v1/episodes/:id/wardrobe/:wardrobeId - Link wardrobe item to episode
router.post(
  '/:id/wardrobe/:wardrobeId',
  validateUUIDParam('id'),
  asyncHandler(wardrobeController.linkWardrobeToEpisode)
);

// PATCH /api/v1/episodes/:id/wardrobe/:wardrobeId/favorite - Toggle episode favorite
router.patch(
  '/:id/wardrobe/:wardrobeId/favorite',
  validateUUIDParam('id'),
  asyncHandler(wardrobeController.toggleEpisodeFavorite)
);

// DELETE /api/v1/episodes/:id/wardrobe/:wardrobeId - Unlink wardrobe from episode
router.delete(
  '/:id/wardrobe/:wardrobeId',
  validateUUIDParam('id'),
  asyncHandler(wardrobeController.unlinkWardrobeFromEpisode)
);

// ==================== EPISODE OUTFIT ROUTES ====================
// Outfit instances specific to episodes

// GET /api/v1/episodes/:id/outfits - Get episode outfits
router.get(
  '/:id/outfits',
  validateUUIDParam('id'),
  asyncHandler(outfitSetsController.getEpisodeOutfits)
);

// POST /api/v1/episodes/:id/outfits - Create episode outfit
router.post(
  '/:id/outfits',
  validateUUIDParam('id'),
  asyncHandler(outfitSetsController.createEpisodeOutfit)
);

// DELETE /api/v1/episodes/:episodeId/outfits/:outfitId - Delete episode outfit
router.delete(
  '/:episodeId/outfits/:outfitId',
  validateUUIDParam('episodeId'),
  asyncHandler(outfitSetsController.deleteEpisodeOutfit)
);

// ==================== ASSET ROUTES ====================
// These must come BEFORE /:id route to avoid being caught by it

// GET /api/v1/episodes/:id/assets - Get all assets for episode
router.get(
  '/:id/assets',
  validateUUIDParam('id'),
  asyncHandler(episodeController.getEpisodeAssets)
);

// POST /api/v1/episodes/:id/assets - Add asset(s) to episode
router.post(
  '/:id/assets',
  validateUUIDParam('id'),
  asyncHandler(episodeController.addEpisodeAsset)
);

// DELETE /api/v1/episodes/:id/assets/:assetId - Remove asset from episode
router.delete(
  '/:id/assets/:assetId',
  validateUUIDParam('id'),
  asyncHandler(episodeController.removeEpisodeAsset)
);

// PATCH /api/v1/episodes/:id/assets/:assetId - Update asset usage in episode
router.patch(
  '/:id/assets/:assetId',
  validateUUIDParam('id'),
  asyncHandler(episodeController.updateEpisodeAsset)
);

// ==================== PLATFORM CONFIGURATION ROUTES ====================

// GET /api/v1/episodes/:id/platform - Get platform configuration
router.get(
  '/:id/platform',
  validateUUIDParam('id'),
  asyncHandler(async (req, res) => {
    const { Episode } = require('../models');
    const episode = await Episode.findByPk(req.params.id, {
      attributes: ['id', 'platform', 'width', 'height', 'aspect_ratio']
    });
    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    res.json({
      platform: episode.platform || 'youtube',
      width: episode.width || 1920,
      height: episode.height || 1080,
      aspect_ratio: episode.aspect_ratio || '16:9'
    });
  })
);

// PUT /api/v1/episodes/:id/platform - Update platform configuration
router.put(
  '/:id/platform',
  validateUUIDParam('id'),
  asyncHandler(async (req, res) => {
    const { Episode } = require('../models');
    const episode = await Episode.findByPk(req.params.id);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    const { platform, width, height, aspect_ratio } = req.body;
    await episode.update({
      platform: platform || episode.platform,
      width: width || episode.width,
      height: height || episode.height,
      aspect_ratio: aspect_ratio || episode.aspect_ratio
    });
    res.json({
      platform: episode.platform,
      width: episode.width,
      height: episode.height,
      aspect_ratio: episode.aspect_ratio
    });
  })
);

// ==================== UNIFIED SAVE ENDPOINT ====================

// POST /api/v1/episodes/:id/save - Atomic save for Scene Composer & Timeline Editor
router.post(
  '/:id/save',
  validateUUIDParam('id'),
  asyncHandler(async (req, res) => {
    const { Episode, Scene, TimelineData } = require('../models');
    const { id } = req.params;
    const { episode: episodeData, platform: platformData, scenes, timeline } = req.body;

    const result = await Episode.sequelize.transaction(async (t) => {
      // 1. Update episode metadata + platform
      const episodeRecord = await Episode.findByPk(id, { transaction: t });
      if (!episodeRecord) throw new Error('Episode not found');

      const episodeUpdate = {};
      if (episodeData?.title) episodeUpdate.title = episodeData.title;
      if (platformData?.platform) episodeUpdate.platform = platformData.platform;
      if (platformData?.width) episodeUpdate.width = platformData.width;
      if (platformData?.height) episodeUpdate.height = platformData.height;
      if (platformData?.aspect_ratio) episodeUpdate.aspect_ratio = platformData.aspect_ratio;

      if (Object.keys(episodeUpdate).length > 0) {
        await episodeRecord.update(episodeUpdate, { transaction: t });
      }

      // 2. Upsert scenes
      if (scenes && Array.isArray(scenes)) {
        // Delete existing scenes for this episode, then bulk create
        await Scene.destroy({ where: { episode_id: id }, transaction: t, force: true });

        if (scenes.length > 0) {
          await Scene.bulkCreate(
            scenes.map((scene, idx) => ({
              episode_id: id,
              scene_number: scene.scene_number || idx + 1,
              title: scene.title || `Scene ${idx + 1}`,
              duration_seconds: scene.duration_seconds || 5.0,
              background_url: scene.background_url || null,
              characters: scene.characters || [],
              ui_elements: scene.ui_elements || [],
              dialogue_clips: scene.dialogue_clips || [],
            })),
            { transaction: t }
          );
        }
      }

      // 3. Upsert timeline data
      if (timeline) {
        let timelineRecord = await TimelineData.findOne({
          where: { episode_id: id },
          transaction: t
        });

        const tlUpdate = {
          beats: timeline.beats ?? (timelineRecord ? timelineRecord.beats : []),
          markers: timeline.markers ?? (timelineRecord ? timelineRecord.markers : []),
          audio_clips: (timeline.audioClips || timeline.audio_clips) ?? (timelineRecord ? timelineRecord.audio_clips : []),
          character_clips: (timeline.characterClips || timeline.character_clips) ?? (timelineRecord ? timelineRecord.character_clips : []),
        };

        if (timelineRecord) {
          await timelineRecord.update(tlUpdate, { transaction: t });
        } else {
          await TimelineData.create({ episode_id: id, ...tlUpdate }, { transaction: t });
        }
      }

      return { success: true };
    });

    res.json({
      success: true,
      message: 'Saved successfully',
      timestamp: new Date().toISOString()
    });
  })
);

// ==================== STANDARD EPISODE ROUTES ====================
router.get('/:id/status', asyncHandler(episodeController.getEpisodeStatus));

// Get single episode
router.get('/:id', validateUUIDParam('id'), asyncHandler(episodeController.getEpisode));

// ✅ CREATE EPISODE - AUTH DISABLED FOR TESTING
router.post(
  '/',
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requirePermission('episodes', 'create'),  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(episodeController.createEpisode)
);

// ✅ UPDATE EPISODE - AUTH DISABLED FOR TESTING
router.put(
  '/:id',
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requirePermission('episodes', 'edit'),  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(episodeController.updateEpisode)
);

// ✅ DELETE EPISODE - AUTH DISABLED FOR TESTING
router.delete(
  '/:id',
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requirePermission('episodes', 'delete'),  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(episodeController.deleteEpisode)
);

// Enqueue episode for processing
router.post(
  '/:id/enqueue',
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requirePermission('episodes', 'edit'),  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(episodeController.enqueueEpisode)
);

/**
 * Episode Scenes Management
 */

// GET /api/v1/episodes/:episodeId/scenes - Get all scenes for episode
router.get(
  '/:episodeId/scenes',
  validateUUIDParam('episodeId'),
  asyncHandler(sceneController.getEpisodeScenes)
);

// PUT /api/v1/episodes/:episodeId/scenes/reorder - Reorder scenes
router.put(
  '/:episodeId/scenes/reorder',
  validateUUIDParam('episodeId'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  asyncHandler(sceneController.reorderScenes)
);

// GET /api/v1/episodes/:episodeId/scenes/stats - Get scene statistics
router.get(
  '/:episodeId/scenes/stats',
  validateUUIDParam('episodeId'),
  asyncHandler(sceneController.getSceneStats)
);

// ==========================================
// SCENE COMPOSER ENDPOINTS
// ==========================================

// POST /api/v1/episodes/:episodeId/scenes - Create new scene
router.post(
  '/:episodeId/scenes',
  validateUUIDParam('episodeId'),
  asyncHandler(sceneController.createScene)
);

// POST /api/v1/scenes/:scene_id/calculate-duration - Auto-calculate scene duration
router.post(
  '/scenes/:scene_id/calculate-duration',
  asyncHandler(sceneController.calculateDuration)
);

// GET /api/v1/scenes/:scene_id/completeness - Check scene completeness
router.get(
  '/scenes/:scene_id/completeness',
  asyncHandler(sceneController.checkCompleteness)
);

// POST /api/v1/scenes/:scene_id/assets - Add asset to scene
router.post(
  '/scenes/:scene_id/assets',
  asyncHandler(sceneController.addAssetToScene)
);

// GET /api/v1/scenes/:scene_id/assets - List scene assets
router.get(
  '/scenes/:scene_id/assets',
  asyncHandler(sceneController.listSceneAssets)
);

// PUT /api/v1/scenes/:scene_id/assets/:scene_asset_id - Update scene asset
router.put(
  '/scenes/:scene_id/assets/:scene_asset_id',
  asyncHandler(sceneController.updateSceneAsset)
);

// DELETE /api/v1/scenes/:scene_id/assets/:scene_asset_id - Remove asset from scene
router.delete(
  '/scenes/:scene_id/assets/:scene_asset_id',
  asyncHandler(sceneController.removeAssetFromScene)
);

/**
 * Episode Scripts Management
 */

// GET /api/v1/episodes/:episodeId/scripts - Get all scripts for episode
router.get(
  '/:episodeId/scripts',
  validateUUIDParam('episodeId'),
  asyncHandler(scriptsController.getScriptsByEpisode)
);

// POST /api/v1/episodes/:episodeId/scripts - Create new script
router.post(
  '/:episodeId/scripts',
  validateUUIDParam('episodeId'),
  // authenticateToken,  // ✅ COMMENTED OUT FOR TESTING
  // requireAdmin,
  asyncHandler(scriptsController.createScript)
);

// GET /api/v1/episodes/:episodeId/scripts/:scriptType/versions - Get versions
router.get(
  '/:episodeId/scripts/:scriptType/versions',
  validateUUIDParam('episodeId'),
  asyncHandler(scriptsController.getScriptVersions)
);

/**
 * Episode Scene Library Management
 * New routes for scene library integration
 */

// GET /api/v1/episodes/:id/library-scenes - List scenes from library assigned to episode
router.get(
  '/:id/library-scenes',
  validateUUIDParam('id'),
  asyncHandler(episodeController.listEpisodeScenes)
);

// POST /api/v1/episodes/:id/library-scenes - Add scene from library to episode
router.post(
  '/:id/library-scenes',
  validateUUIDParam('id'),
  asyncHandler(episodeController.addSceneToEpisode)
);

// PUT /api/v1/episodes/:id/library-scenes/:sceneId - Update episode scene (trim, notes, order)
router.put(
  '/:id/library-scenes/:sceneId',
  validateUUIDParam('id'),
  asyncHandler(episodeController.updateEpisodeScene)
);

// DELETE /api/v1/episodes/:id/library-scenes/:sceneId - Remove scene from episode
router.delete(
  '/:id/library-scenes/:sceneId',
  validateUUIDParam('id'),
  asyncHandler(episodeController.removeSceneFromEpisode)
);

/**
 * Episode Assets Library Management
 * Routes for episode-level asset library (3-layer timeline architecture)
 */

// GET /api/v1/episodes/:id/library-assets - List assets in episode library
router.get(
  '/:id/library-assets',
  validateUUIDParam('id'),
  asyncHandler(require('../controllers/episodeAssetsController').listEpisodeAssets)
);

// POST /api/v1/episodes/:id/library-assets - Add asset to episode library
router.post(
  '/:id/library-assets',
  validateUUIDParam('id'),
  asyncHandler(require('../controllers/episodeAssetsController').addAssetToEpisode)
);

// PATCH /api/v1/episodes/:id/library-assets/:assetId - Update episode asset
router.patch(
  '/:id/library-assets/:assetId',
  validateUUIDParam('id'),
  asyncHandler(require('../controllers/episodeAssetsController').updateEpisodeAsset)
);

// DELETE /api/v1/episodes/:id/library-assets/:assetId - Remove asset from episode
router.delete(
  '/:id/library-assets/:assetId',
  validateUUIDParam('id'),
  asyncHandler(require('../controllers/episodeAssetsController').removeAssetFromEpisode)
);

/**
 * Timeline Placements Management
 * Routes for timeline placement system (Track 2: assets/wardrobe on timeline)
 */

// GET /api/v1/episodes/:id/timeline/placements - List all placements
router.get(
  '/:id/timeline/placements',
  validateUUIDParam('id'),
  asyncHandler(require('../controllers/timelinePlacementsController').listPlacements)
);

// POST /api/v1/episodes/:id/timeline/placements - Create placement
router.post(
  '/:id/timeline/placements',
  validateUUIDParam('id'),
  asyncHandler(require('../controllers/timelinePlacementsController').createPlacement)
);

// PATCH /api/v1/episodes/:id/timeline/placements/:placementId - Update placement
router.patch(
  '/:id/timeline/placements/:placementId',
  validateUUIDParam('id'),
  asyncHandler(require('../controllers/timelinePlacementsController').updatePlacement)
);

// DELETE /api/v1/episodes/:id/timeline/placements/:placementId - Delete placement
router.delete(
  '/:id/timeline/placements/:placementId',
  validateUUIDParam('id'),
  asyncHandler(require('../controllers/timelinePlacementsController').deletePlacement)
);

// GET /api/v1/episodes/:id/timeline/wardrobe/current - Get current wardrobe (carry-forward)
router.get(
  '/:id/timeline/wardrobe/current',
  validateUUIDParam('id'),
  asyncHandler(require('../controllers/timelinePlacementsController').getCurrentWardrobe)
);

// PUT /api/v1/episodes/:id/sequence-items/reorder - Batch reorder sequence items
router.put(
  '/:id/sequence-items/reorder',
  validateUUIDParam('id'),
  asyncHandler(episodeController.reorderSequenceItems)
);

// POST /api/v1/episodes/:id/sequence-items/note - Add a note to the sequence
router.post(
  '/:id/sequence-items/note',
  validateUUIDParam('id'),
  asyncHandler(episodeController.addNoteToEpisode)
);

/**
 * Episode Assets Routes (Library → Episode layer)
 */

// GET /api/v1/episodes/:episodeId/library-assets - List assets in episode library
router.get(
  '/:episodeId/library-assets',
  validateUUIDParam('episodeId'),
  asyncHandler(episodeAssetsController.listEpisodeAssets)
);

// GET /api/v1/episodes/:episodeId/library-assets/folders - Get asset folders
router.get(
  '/:episodeId/library-assets/folders',
  validateUUIDParam('episodeId'),
  asyncHandler(episodeAssetsController.getAssetFolders)
);

// POST /api/v1/episodes/:episodeId/library-assets - Add asset to episode
router.post(
  '/:episodeId/library-assets',
  validateUUIDParam('episodeId'),
  asyncHandler(episodeAssetsController.addAssetToEpisode)
);

// PATCH /api/v1/episodes/:episodeId/library-assets/:assetId - Update episode asset metadata
router.patch(
  '/:episodeId/library-assets/:assetId',
  validateUUIDParam('episodeId'),
  validateUUIDParam('assetId'),
  asyncHandler(episodeAssetsController.updateEpisodeAsset)
);

// DELETE /api/v1/episodes/:episodeId/library-assets/:assetId - Remove asset from episode
router.delete(
  '/:episodeId/library-assets/:assetId',
  validateUUIDParam('episodeId'),
  validateUUIDParam('assetId'),
  asyncHandler(episodeAssetsController.removeAssetFromEpisode)
);

/**
 * Timeline Placements Routes (Timeline layer)
 */

// GET /api/v1/episodes/:episodeId/timeline/placements - List all placements
router.get(
  '/:episodeId/timeline/placements',
  validateUUIDParam('episodeId'),
  asyncHandler(timelinePlacementsController.listPlacements)
);

// POST /api/v1/episodes/:episodeId/timeline/placements - Create placement
router.post(
  '/:episodeId/timeline/placements',
  validateUUIDParam('episodeId'),
  asyncHandler(timelinePlacementsController.createPlacement)
);

// PATCH /api/v1/episodes/:episodeId/timeline/placements/:placementId - Update placement
router.patch(
  '/:episodeId/timeline/placements/:placementId',
  validateUUIDParam('episodeId'),
  asyncHandler(timelinePlacementsController.updatePlacement)
);

// DELETE /api/v1/episodes/:episodeId/timeline/placements/:placementId - Delete placement
router.delete(
  '/:episodeId/timeline/placements/:placementId',
  validateUUIDParam('episodeId'),
  asyncHandler(timelinePlacementsController.deletePlacement)
);

// GET /api/v1/episodes/:episodeId/timeline/wardrobe/current - Get current wardrobe (carry-forward)
router.get(
  '/:episodeId/timeline/wardrobe/current',
  validateUUIDParam('episodeId'),
  asyncHandler(timelinePlacementsController.getCurrentWardrobe)
);

/**
 * Video Compositions Management → Scene Templates
 * 
 * Mental model: These are LAYOUT TEMPLATES, not video compositions.
 * They define spatial arrangement, not timeline.
 */

// GET /api/v1/episodes/:episodeId/video-compositions - Get all scene templates for episode
router.get(
  '/:episodeId/video-compositions',
  validateUUIDParam('episodeId'),
  asyncHandler(videoCompositionController.list)
);

// POST /api/v1/episodes/:episodeId/video-compositions - Create new scene template
router.post(
  '/:episodeId/video-compositions',
  validateUUIDParam('episodeId'),
  asyncHandler(videoCompositionController.create)
);

// POST /api/v1/episodes/:episodeId/video-compositions/:id/duplicate - Duplicate a scene template
router.post(
  '/:episodeId/video-compositions/:id/duplicate',
  validateUUIDParam('episodeId'),
  asyncHandler(videoCompositionController.duplicate)
);

// GET /api/v1/episodes/:episodeId/video-compositions/:id - Get single scene template
router.get(
  '/:episodeId/video-compositions/:id',
  validateUUIDParam('episodeId'),
  asyncHandler(videoCompositionController.get)
);

// PUT /api/v1/episodes/:episodeId/video-compositions/:id - Update scene template (increments version)
router.put(
  '/:episodeId/video-compositions/:id',
  validateUUIDParam('episodeId'),
  asyncHandler(videoCompositionController.update)
);

// DELETE /api/v1/episodes/:episodeId/video-compositions/:id - Delete scene template
router.delete(
  '/:episodeId/video-compositions/:id',
  validateUUIDParam('episodeId'),
  asyncHandler(videoCompositionController.remove)
);

module.exports = router;
