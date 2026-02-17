const { models, sequelize } = require('../models');
const { Scene, Episode, Thumbnail, Asset, SceneAsset, AssetUsageLog } = models;
const { QueryTypes } = require('sequelize');

/**
 * Scene Controller
 * Handles all scene CRUD operations and scene management
 *
 * @module controllers/sceneController
 */

/**
 * @route   GET /api/v1/scenes
 * @desc    List all scenes with optional filters
 * @access  Authenticated
 * @query   {string} episode_id - Filter by episode ID
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 50)
 */
exports.listScenes = async (req, res) => {
  try {
    const { episode_id, sceneType, productionStatus, page = 1, limit = 50 } = req.query;

    const where = {};

    // Apply filters
    if (episode_id) where.episode_id = episode_id;
    if (sceneType) where.scene_type = sceneType;
    if (productionStatus) where.production_status = productionStatus;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Scene.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['scene_number', 'ASC']],
      include: [
        {
          model: Episode,
          as: 'episode',
          attributes: ['id', 'title', 'episode_number', 'status'],
        },
      ],
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error listing scenes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list scenes',
      message: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/scenes/:id
 * @desc    Get single scene by ID with full details
 * @access  Authenticated
 * @param   {string} id - Scene UUID
 */
/**
 * @route   GET /api/v1/scenes/:id
 * @desc    Get single scene by ID with full details
 * @access  Authenticated
 * @param   {string} id - Scene UUID
 */
exports.getScene = async (req, res) => {
  const timestamp = new Date().toISOString();
  console.log('\n🎬 getScene CONTROLLER CALLED! [TIMESTAMP:', timestamp, ']');
  console.log('   Request ID:', req.params.id);
  console.log('   Query params:', req.query);
  
  try {
    const { id } = req.params;
    const { include } = req.query;
    const includeThumbnail = include && include.includes('thumbnail');

    console.log('🔍 Executing RAW SQL query for scene...');

    // Use raw SQL like getEpisodeScenes does (which works)
    const scenes = await sequelize.query(
      `
      SELECT 
        s.*,
        ${includeThumbnail ? `
          json_build_object(
            'id', t.id,
            's3Bucket', t."s3Bucket",
            's3Key', t."s3Key",
            'thumbnailType', t."thumbnailType",
            'url', t."url",
            's3Key', t."s3Key",
            'metadata', t."metadata"
          ) as thumbnail
        ` : 'NULL as thumbnail'},
        json_build_object(
          'id', e.id,
          'title', e.title,
          'episode_number', e.episode_number,
          'status', e.status
        ) as episode
      FROM scenes s
      LEFT JOIN episodes e ON s.episode_id = e.id
      ${includeThumbnail ? 'LEFT JOIN thumbnails t ON s.thumbnail_id = t.id' : ''}
      WHERE s.id = :sceneId::uuid
        AND s.deleted_at IS NULL
      `,
      {
        replacements: { sceneId: id },
        type: QueryTypes.SELECT
      }
    );

    console.log('✅ Raw SQL query completed. Results:', scenes.length, 'scene(s)');

    if (!scenes || scenes.length === 0) {
      console.log('❌ Scene not found in database');
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    res.json({
      success: true,
      data: scenes[0],
    });
  } catch (error) {
    console.error('[getScene] Error:', error.message);
    console.error('[getScene] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to get scene',
      message: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/scenes
 * @desc    Create new scene
 * @access  Editor+
 * @body    {object} Scene data
 */
exports.createScene = async (req, res) => {
  try {
    const {
      episode_id,
      episodeId,
      title,
      description,
      location,
      duration_seconds,
      durationSeconds,
      scene_type,
      sceneType,
      production_status,
      productionStatus,
      mood,
      script_notes,
      scriptNotes,
      start_timecode,
      startTimecode,
      end_timecode,
      endTimecode,
      characters,
    } = req.body;

    const resolvedEpisodeId = episodeId || episode_id;
    const resolvedTitle = title;
    const resolvedDurationSeconds = durationSeconds || duration_seconds;
    const resolvedSceneType = sceneType || scene_type;
    const resolvedProductionStatus = productionStatus || production_status;
    const resolvedScriptNotes = scriptNotes || script_notes;
    const resolvedStartTimecode = startTimecode || start_timecode;
    const resolvedEndTimecode = endTimecode || end_timecode;

    // Validate required fields
    if (!resolvedEpisodeId || !resolvedTitle) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'episodeId and title are required',
      });
    }

    // Validate episode exists
    const episode = await Episode.findByPk(resolvedEpisodeId);
    if (!episode) {
      return res.status(404).json({
        success: false,
        error: 'Episode not found',
      });
    }

    // Get next scene number automatically
    const scene_number = await Scene.getNextSceneNumber(resolvedEpisodeId);

    // Get user ID from request
    const userId = req.user?.id || 'system';

    // Create scene
    const scene = await Scene.create({
      episode_id: resolvedEpisodeId,
      scene_number,
      title: resolvedTitle,
      description,
      location,
      duration_seconds: resolvedDurationSeconds,
      scene_type: resolvedSceneType,
      production_status: resolvedProductionStatus || 'draft',
      mood,
      script_notes: resolvedScriptNotes,
      start_timecode: resolvedStartTimecode,
      end_timecode: resolvedEndTimecode,
      characters: characters || [],
      created_by: userId,
      updated_by: userId,
    });

    res.status(201).json({
      success: true,
      data: scene,
      message: 'Scene created successfully',
    });
  } catch (error) {
    console.error('Error creating scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create scene',
      message: error.message,
    });
  }
};

/**
 * @route   PUT /api/v1/scenes/:id
 * @desc    Update scene
 * @access  Editor+
 * @param   {string} id - Scene UUID
 * @body    {object} Updated scene data
 */
exports.updateScene = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const scene = await Scene.findByPk(id, {
      include: 'episode',
    });

    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    // Reload to get latest is_locked value
    await scene.reload();

    // Check if scene is locked
    if (scene.is_locked) {
      return res.status(400).json({
        success: false,
        error: 'Cannot update locked scene',
        message: 'This scene is locked for editing',
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'title',
      'description',
      'location',
      'duration_seconds',
      'durationSeconds',
      'scene_type',
      'sceneType',
      'production_status',
      'productionStatus',
      'mood',
      'script_notes',
      'scriptNotes',
      'start_timecode',
      'startTimecode',
      'end_timecode',
      'endTimecode',
      'characters',
    ];

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        // Handle camelCase to snake_case mapping
        if (key === 'durationSeconds') {
          scene.duration_seconds = updates[key];
        } else if (key === 'sceneType') {
          scene.scene_type = updates[key];
        } else if (key === 'productionStatus') {
          scene.production_status = updates[key];
        } else if (key === 'scriptNotes') {
          scene.script_notes = updates[key];
        } else if (key === 'startTimecode') {
          scene.start_timecode = updates[key];
        } else if (key === 'endTimecode') {
          scene.end_timecode = updates[key];
        } else {
          scene[key] = updates[key];
        }
      }
    });

    // Track who updated
    scene.updated_by = req.user?.id || 'system';
    await scene.save();

    res.json({
      success: true,
      data: scene,
      message: 'Scene updated successfully',
    });
  } catch (error) {
    console.error('Error updating scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update scene',
      message: error.message,
    });
  }
};

/**
 * @route   DELETE /api/v1/scenes/:id
 * @desc    Delete scene (soft delete with paranoid mode)
 * @access  Editor+
 * @param   {string} id - Scene UUID
 */
exports.deleteScene = async (req, res) => {
  try {
    const { id } = req.params;

    const scene = await Scene.findByPk(id);

    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    // Reload to get latest is_locked value
    await scene.reload();

    // Check if scene is locked
    if (scene.is_locked) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete locked scene',
        message: 'This scene is locked for editing',
      });
    }

    const episode_id = scene.episode_id;

    // Soft delete the scene (paranoid mode)
    await scene.destroy();

    // Renumber remaining scenes to fill gap
    const sequelize = Scene.sequelize;
    const transaction = await sequelize.transaction();

    try {
      // Temporarily drop the unique index to allow renumbering
      await sequelize.query('DROP INDEX IF EXISTS idx_scenes_episode_scene_number', {
        transaction,
        type: sequelize.QueryTypes.RAW,
      });

      // Get all non-deleted scenes for this episode and renumber them
      const scenes = await Scene.findAll({
        where: { episode_id },
        order: [['scene_number', 'ASC']],
        paranoid: true,
        transaction,
      });

      // Update scene numbers to sequential values
      for (let i = 0; i < scenes.length; i++) {
        await sequelize.query('UPDATE scenes SET scene_number = :new_number WHERE id = :id', {
          replacements: { new_number: i + 1, id: scenes[i].id },
          transaction,
          type: sequelize.QueryTypes.UPDATE,
        });
      }

      // Recreate the unique index (partial - only for non-deleted scenes)
      await sequelize.query(
        'CREATE UNIQUE INDEX idx_scenes_episode_scene_number ON scenes (episode_id, scene_number) WHERE deleted_at IS NULL',
        { transaction, type: sequelize.QueryTypes.RAW }
      );

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.json({
      success: true,
      message: 'Scene deleted successfully',
      data: {
        deletedSceneId: id,
        episode_id,
      },
    });
  } catch (error) {
    console.error('Error deleting scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete scene',
      message: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/episodes/:episodeId/scenes
 * @desc    Get all scenes for an episode (ordered) with statistics
 * @access  Authenticated
 * @param   {string} episodeId - Episode UUID
 */
exports.getEpisodeScenes = async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { include } = req.query;
    const includeAssets = include && include.includes('thumbnail');

    // First check if episode exists
    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      return res.status(404).json({
        success: false,
        error: 'Episode not found',
      });
    }

    // Use raw query with explicit UUID casting to avoid type mismatch
    const scenes = await sequelize.query(
      `
      SELECT 
        s.*,
        ${includeAssets ? `
          json_build_object(
            'id', t.id,
            's3Bucket', t."s3Bucket",
            's3Key', t."s3Key",
            'thumbnailType', t."thumbnailType"
          ) as thumbnail
        ` : 'NULL as thumbnail'}
      FROM scenes s
      ${includeAssets ? 'LEFT JOIN thumbnails t ON s.thumbnail_id = t.id' : ''}
      WHERE s.episode_id = :episodeId::uuid
        AND s.deleted_at IS NULL
      ORDER BY s.scene_number ASC
      `,
      {
        replacements: { episodeId },
        type: QueryTypes.SELECT
      }
    );

    // Calculate statistics
    const stats = {
      total: scenes.length,
      totalDuration: scenes.reduce((sum, s) => sum + (parseFloat(s.duration_seconds) || 0), 0),
      byType: {},
      byStatus: {},
    };

    scenes.forEach((scene) => {
      // Count by type
      if (scene.scene_type) {
        stats.byType[scene.scene_type] = (stats.byType[scene.scene_type] || 0) + 1;
      }
      // Count by status
      if (scene.production_status) {
        stats.byStatus[scene.production_status] =
          (stats.byStatus[scene.production_status] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: scenes,
      count: scenes.length,
      stats,
      episodeInfo: {
        id: episode.id,
        title: episode.title,
        episode_number: episode.episode_number,
        status: episode.status,
      },
    });
  } catch (error) {
    console.error('Error getting episode scenes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get episode scenes',
      message: error.message,
    });
  }
};

/**
 * @route   PUT /api/v1/episodes/:episodeId/scenes/reorder
 * @desc    Reorder scenes for an episode
 * @access  Editor+
 * @param   {string} episodeId - Episode UUID
 * @body    {array} sceneIds - Ordered array of scene IDs
 */
exports.reorderScenes = async (req, res) => {
  try {
    const { episodeId } = req.params;
    const { sceneIds } = req.body;

    // Validate input
    if (!Array.isArray(sceneIds) || sceneIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'sceneIds must be a non-empty array',
      });
    }

    // Validate episode exists
    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      return res.status(404).json({
        success: false,
        error: 'Episode not found',
      });
    }

    // Use transaction for atomicity
    const sequelize = Scene.sequelize;
    const transaction = await sequelize.transaction();

    try {
      // Fetch all scenes to reorder
      const scenesToReorder = [];
      for (let i = 0; i < sceneIds.length; i++) {
        const scene = await Scene.findByPk(sceneIds[i], { transaction });
        if (scene && scene.episode_id === episodeId) {
          scenesToReorder.push(scene);
        }
      }

      // Two-step renumbering to avoid unique constraint violations:
      // Step 1: Set all to temporary large values (1000+)
      for (let i = 0; i < scenesToReorder.length; i++) {
        scenesToReorder[i].scene_number = 1000 + i;
        await scenesToReorder[i].save({ transaction });
      }

      // Step 2: Set to final sequential values
      for (let i = 0; i < scenesToReorder.length; i++) {
        scenesToReorder[i].scene_number = i + 1;
        await scenesToReorder[i].save({ transaction });
      }

      await transaction.commit();

      res.json({
        success: true,
        data: scenesToReorder,
        message: 'Scenes reordered successfully',
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error reordering scenes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reorder scenes',
      message: error.message,
    });
  }
};

/**
 * @route   PUT /api/v1/scenes/:id/status
 * @desc    Update scene production status
 * @access  Editor+
 * @param   {string} id - Scene UUID
 * @body    {string} status - New production status
 */
exports.updateSceneStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required',
      });
    }

    const scene = await Scene.findByPk(id);
    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    await scene.updateStatus(status);

    res.json({
      success: true,
      data: scene,
      message: 'Scene status updated successfully',
    });
  } catch (error) {
    console.error('Error updating scene status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update scene status',
      message: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/scenes/:id/characters
 * @desc    Add character to scene
 * @access  Editor+
 * @param   {string} id - Scene UUID
 * @body    {string} characterName - Character name to add
 */
exports.addCharacter = async (req, res) => {
  try {
    const { id } = req.params;
    const { characterName } = req.body;

    if (!characterName) {
      return res.status(400).json({
        success: false,
        error: 'characterName is required',
      });
    }

    const scene = await Scene.findByPk(id);
    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    await scene.addCharacter(characterName);

    res.json({
      success: true,
      data: scene,
      message: 'Character added successfully',
    });
  } catch (error) {
    console.error('Error adding character:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add character',
      message: error.message,
    });
  }
};

/**
 * @route   DELETE /api/v1/scenes/:id/characters/:characterName
 * @desc    Remove character from scene
 * @access  Editor+
 * @param   {string} id - Scene UUID
 * @param   {string} characterName - Character name to remove
 */
exports.removeCharacter = async (req, res) => {
  try {
    const { id, characterName } = req.params;

    const scene = await Scene.findByPk(id);
    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    await scene.removeCharacter(characterName);

    res.json({
      success: true,
      data: scene,
      message: 'Character removed successfully',
    });
  } catch (error) {
    console.error('Error removing character:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove character',
      message: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/episodes/:episodeId/scenes/stats
 * @desc    Get scene statistics for an episode
 * @access  Authenticated
 * @param   {string} episodeId - Episode UUID
 */
exports.getSceneStats = async (req, res) => {
  try {
    const { episodeId } = req.params;

    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      return res.status(404).json({
        success: false,
        error: 'Episode not found',
      });
    }

    const scenes = await Scene.getEpisodeScenes(episodeId);

    const stats = {
      total: scenes.length,
      totalDuration: scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0),
      byType: {},
      byStatus: {},
    };

    scenes.forEach((scene) => {
      if (scene.scene_type) {
        stats.byType[scene.scene_type] = (stats.byType[scene.scene_type] || 0) + 1;
      }
      if (scene.production_status) {
        stats.byStatus[scene.production_status] =
          (stats.byStatus[scene.production_status] || 0) + 1;
      }
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting scene stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scene stats',
      message: error.message,
    });
  }
};

/**
 * @route   PUT /api/v1/scenes/:id/thumbnail
 * @desc    Set scene thumbnail
 * @access  Editor+
 * @param   {string} id - Scene UUID
 * @body    {string} thumbnailId - Thumbnail UUID
 */
exports.setSceneThumbnail = async (req, res) => {
  try {
    const { id } = req.params;
    const { thumbnailId } = req.body;
    const userId = req.user?.id;

    if (!thumbnailId) {
      return res.status(400).json({
        success: false,
        message: 'Thumbnail ID is required',
      });
    }

    const scene = await Scene.findByPk(id);
    if (!scene) {
      return res.status(404).json({
        success: false,
        message: 'Scene not found',
      });
    }

    if (scene.is_locked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify thumbnail on locked scene',
      });
    }

    // Verify thumbnail exists
    const thumbnail = await Thumbnail.findByPk(thumbnailId);
    if (!thumbnail) {
      return res.status(404).json({
        success: false,
        message: 'Thumbnail not found',
      });
    }

    await scene.setThumbnail(thumbnailId, userId);
    await scene.reload({ include: [{ model: Thumbnail, as: 'thumbnail' }] });

    res.json({
      success: true,
      data: scene,
      message: 'Scene thumbnail updated successfully',
    });
  } catch (error) {
    console.error('Set scene thumbnail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set scene thumbnail',
      error: error.message,
    });
  }
};

/**
 * @route   PUT /api/v1/scenes/:id/assets
 * @desc    Update scene assets
 * @access  Editor+
 * @param   {string} id - Scene UUID
 * @body    {object} assets - Asset data object
 */
exports.updateSceneAssets = async (req, res) => {
  try {
    const { id } = req.params;
    const { assets } = req.body;
    const userId = req.user?.id;

    if (!assets || typeof assets !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Assets object is required',
      });
    }

    const scene = await Scene.findByPk(id);
    if (!scene) {
      return res.status(404).json({
        success: false,
        message: 'Scene not found',
      });
    }

    if (scene.is_locked) {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify assets on locked scene',
      });
    }

    await scene.updateAssets(assets, userId);

    res.json({
      success: true,
      data: scene,
      message: 'Scene assets updated successfully',
    });
  } catch (error) {
    console.error('Update scene assets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update scene assets',
      error: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/scenes/:id/assets
 * @desc    Get all assets linked to a scene
 * @access  Authenticated
 */
exports.getSceneAssets = async (req, res) => {
  try {
    const { id } = req.params;

    const scene = await Scene.findByPk(id, {
      include: [
        {
          model: Asset,
          as: 'linkedAssets',
          through: {
            attributes: [
              'id',
              'usage_type',
              'start_timecode',
              'end_timecode',
              'layer_order',
              'opacity',
              'position',
              'metadata',
              'created_at',
            ],
          },
          attributes: [
            'id',
            'name',
            'asset_type',
            'approval_status',
            's3_url_raw',
            's3_url_processed',
            'media_type',
            'width',
            'height',
            'file_size_bytes',
            'created_at',
          ],
        },
      ],
    });

    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    res.json({
      success: true,
      data: scene.linkedAssets || [],
      count: scene.linkedAssets ? scene.linkedAssets.length : 0,
    });
  } catch (error) {
    console.error('❌ Error getting scene assets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scene assets',
      message: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/scenes/:id/assets
 * @desc    Link asset(s) to a scene
 * @access  Authenticated
 * @body    {string|string[]} assetId(s), {object} options (usage_type, timecodes, etc.)
 */
exports.addSceneAsset = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      assetId,
      assetIds,
      usageType = 'overlay',
      startTimecode,
      endTimecode,
      layerOrder = 0,
      opacity = 1.0,
      position,
      metadata,
    } = req.body;

    // Validate scene exists
    const scene = await Scene.findByPk(id);
    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    if (scene.is_locked) {
      return res.status(403).json({
        success: false,
        error: 'Cannot modify locked scene',
      });
    }

    // Handle both single assetId and array of assetIds
    const idsToLink = assetIds || (assetId ? [assetId] : []);

    if (idsToLink.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No asset IDs provided',
      });
    }

    // Validate all assets exist
    const assets = await Asset.findAll({
      where: {
        id: idsToLink,
      },
    });

    if (assets.length !== idsToLink.length) {
      return res.status(404).json({
        success: false,
        error: 'One or more assets not found',
      });
    }

    // Create scene asset links
    const sceneAssets = [];
    let lastCreated = false;
    for (const id of idsToLink) {
      const [sceneAsset, created] = await SceneAsset.findOrCreate({
        where: {
          scene_id: scene.id,
          asset_id: id,
          usage_type: usageType,
        },
        defaults: {
          start_timecode: startTimecode || null,
          end_timecode: endTimecode || null,
          layer_order: layerOrder,
          opacity,
          position: position || { x: 0, y: 0, width: '100%', height: '100%' },
          metadata: metadata || {},
        },
      });

      lastCreated = created;
      if (!created) {
        // Update existing if not created
        await sceneAsset.update({
          start_timecode: startTimecode || sceneAsset.start_timecode,
          end_timecode: endTimecode || sceneAsset.end_timecode,
          layer_order: layerOrder,
          opacity,
          position: position || sceneAsset.position,
          metadata: metadata || sceneAsset.metadata,
        });
      }

      // Track usage: increment usage_count and log
      try {
        await Asset.increment('usage_count', { where: { id } });
        if (AssetUsageLog) {
          await AssetUsageLog.create({
            asset_id: id,
            episode_id: scene.episode_id,
            scene_id: scene.id,
            context: usageType || 'overlay',
          });
        }
      } catch (logErr) {
        console.warn('⚠️ Usage logging failed (non-blocking):', logErr.message);
      }

      sceneAssets.push(sceneAsset);
    }

    res.status(lastCreated ? 201 : 200).json({
      success: true,
      data: sceneAssets,
      message: `Successfully linked ${sceneAssets.length} asset(s) to scene`,
    });
  } catch (error) {
    console.error('❌ Error adding scene asset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add asset to scene',
      message: error.message,
    });
  }
};

/**
 * @route   DELETE /api/v1/scenes/:id/assets/:assetId
 * @desc    Remove asset from scene
 * @access  Authenticated
 */
exports.removeSceneAsset = async (req, res) => {
  try {
    const { id, assetId } = req.params;
    const { usageType } = req.query;

    // Validate scene exists
    const scene = await Scene.findByPk(id);
    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    if (scene.is_locked) {
      return res.status(403).json({
        success: false,
        error: 'Cannot modify locked scene',
      });
    }

    const where = {
      scene_id: id,
      asset_id: assetId,
    };

    if (usageType) {
      where.usage_type = usageType;
    }

    const deleted = await SceneAsset.destroy({ where });

    if (deleted === 0) {
      return res.status(404).json({
        success: false,
        error: 'Scene asset link not found',
      });
    }

    res.json({
      success: true,
      message: 'Asset removed from scene',
    });
  } catch (error) {
    console.error('❌ Error removing scene asset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove asset from scene',
      message: error.message,
    });
  }
};

/**
 * @route   PATCH /api/v1/scenes/:id/assets/:assetId
 * @desc    Update asset positioning/timing in scene
 * @access  Authenticated
 */
exports.updateSceneAsset = async (req, res) => {
  try {
    const { id, assetId } = req.params;
    const { usageType, startTimecode, endTimecode, layerOrder, opacity, position, metadata } =
      req.body;

    // Validate scene exists
    const scene = await Scene.findByPk(id);
    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    if (scene.is_locked) {
      return res.status(403).json({
        success: false,
        error: 'Cannot modify locked scene',
      });
    }

    const where = {
      scene_id: id,
      asset_id: assetId,
    };

    if (usageType) {
      where.usage_type = usageType;
    }

    const sceneAsset = await SceneAsset.findOne({ where });

    if (!sceneAsset) {
      return res.status(404).json({
        success: false,
        error: 'Scene asset link not found',
      });
    }

    const updates = {};
    if (startTimecode !== undefined) updates.start_timecode = startTimecode;
    if (endTimecode !== undefined) updates.end_timecode = endTimecode;
    if (layerOrder !== undefined) updates.layer_order = layerOrder;
    if (opacity !== undefined) updates.opacity = opacity;
    if (position !== undefined) updates.position = position;
    if (metadata !== undefined) updates.metadata = metadata;

    await sceneAsset.update(updates);

    res.json({
      success: true,
      data: sceneAsset,
      message: 'Scene asset updated successfully',
    });
  } catch (error) {
    console.error('❌ Error updating scene asset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update scene asset',
      message: error.message,
    });
  }
};

/**
 * Duplicate a scene with a new scene number
 * POST /api/v1/scenes/:id/duplicate
 */
exports.duplicateScene = async (req, res) => {
  try {
    const { id } = req.params;

    const originalScene = await Scene.findByPk(id, {
      include: [
        {
          model: Asset,
          as: 'linkedAssets',
          through: {
            attributes: [
              'usage_type',
              'start_timecode',
              'end_timecode',
              'layer_order',
              'opacity',
              'position',
              'metadata',
            ],
          },
        },
      ],
    });

    if (!originalScene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    // Find the highest scene number in this episode
    const maxSceneNumber = await Scene.max('scene_number', {
      where: { episode_id: originalScene.episode_id },
    });

    const newSceneNumber = (maxSceneNumber || 0) + 1;

    // Clone the scene data
    const sceneData = {
      episode_id: originalScene.episode_id,
      scene_number: newSceneNumber,
      title: `${originalScene.title} (Copy)`,
      description: originalScene.description,
      duration_seconds: originalScene.duration_seconds,
      location: originalScene.location,
      scene_type: originalScene.scene_type,
      production_status: 'draft', // Reset to draft for new copy
      mood: originalScene.mood,
      script_notes: originalScene.script_notes,
      start_timecode: null, // Will be set when scene is placed in timeline
      end_timecode: null,
      is_locked: false,
      characters: originalScene.characters,
      thumbnail_id: originalScene.thumbnail_id,
    };

    const duplicatedScene = await Scene.create(sceneData);

    // Duplicate scene-asset links
    if (originalScene.linkedAssets && originalScene.linkedAssets.length > 0) {
      const assetLinks = originalScene.linkedAssets.map((asset) => ({
        scene_id: duplicatedScene.id,
        asset_id: asset.id,
        usage_type: asset.SceneAsset.usage_type,
        start_timecode: asset.SceneAsset.start_timecode,
        end_timecode: asset.SceneAsset.end_timecode,
        layer_order: asset.SceneAsset.layer_order,
        opacity: asset.SceneAsset.opacity,
        position: asset.SceneAsset.position,
        metadata: asset.SceneAsset.metadata,
      }));

      await SceneAsset.bulkCreate(assetLinks);
    }

    // Reload with associations
    const newScene = await Scene.findByPk(duplicatedScene.id, {
      include: [
        {
          model: Asset,
          as: 'linkedAssets',
          through: {
            attributes: [
              'usage_type',
              'start_timecode',
              'end_timecode',
              'layer_order',
              'opacity',
              'position',
            ],
          },
        },
        {
          model: Episode,
          attributes: ['id', 'title'],
        },
      ],
    });

    res.status(201).json({
      success: true,
      data: newScene,
      message: 'Scene duplicated successfully',
    });
  } catch (error) {
    console.error('❌ Error duplicating scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to duplicate scene',
      message: error.message,
    });
  }
};

// ==========================================
// SCENE COMPOSER ENDPOINTS
// ==========================================

/**
 * @route   POST /api/v1/scenes/:scene_id/calculate-duration
 * @desc    Auto-calculate scene duration from video clips
 * @access  Editor+
 */
exports.calculateDuration = async (req, res) => {
  try {
    const { scene_id } = req.params;

    // Validate scene exists
    const scene = await Scene.findByPk(scene_id);
    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    // Use database function to calculate duration
    const [result] = await Scene.sequelize.query(
      'SELECT calculate_scene_duration(:scene_id) as duration',
      {
        replacements: { scene_id },
        type: Scene.sequelize.QueryTypes.SELECT,
      }
    );

    const duration = result.duration;

    // Update scene if duration_auto is true
    let updated = false;
    if (scene.duration_auto && duration !== null) {
      await scene.update({ duration_seconds: duration });
      updated = true;
    }

    res.json({
      success: true,
      duration_seconds: duration,
      updated,
      message: updated 
        ? 'Duration calculated and updated' 
        : duration === null
          ? 'No video clips found in scene'
          : 'Duration calculated (not updated - manual mode)',
    });
  } catch (error) {
    console.error('Error calculating scene duration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate duration',
      message: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/scenes/:scene_id/completeness
 * @desc    Check if scene has all required elements
 * @access  Viewer+
 */
exports.checkCompleteness = async (req, res) => {
  try {
    const { scene_id } = req.params;

    // Validate scene exists
    const scene = await Scene.findByPk(scene_id, {
      include: [
        {
          model: SceneAsset,
          as: 'sceneAssets',
          include: [
            {
              model: Asset,
              as: 'asset',
            },
          ],
        },
      ],
    });

    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    // Check for required elements
    const assets = scene.sceneAssets || [];
    const has_background = assets.some(a => a.role && a.role.startsWith('BG.'));
    const has_clips = assets.some(a => a.role && a.role.startsWith('CLIP.'));
    const has_duration = scene.duration_seconds !== null && scene.duration_seconds > 0;

    // Build warnings list
    const warnings = [];
    if (!has_background) warnings.push('Scene has no background');
    if (!has_clips) warnings.push('Scene has no video clips assigned');
    if (!has_duration) warnings.push('Duration not set');

    const complete = has_background && has_clips && has_duration;

    res.json({
      success: true,
      complete,
      missing: {
        background: !has_background,
        clips: !has_clips,
        duration: !has_duration,
      },
      warnings,
      details: {
        background_count: assets.filter(a => a.role && a.role.startsWith('BG.')).length,
        clip_count: assets.filter(a => a.role && a.role.startsWith('CLIP.')).length,
        duration_seconds: scene.duration_seconds,
      },
    });
  } catch (error) {
    console.error('Error checking scene completeness:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check completeness',
      message: error.message,
    });
  }
};

/**
 * @route   POST /api/v1/scenes/:scene_id/assets
 * @desc    Add or update asset binding to scene
 * @access  Editor+
 * @body    {asset_id, role, metadata}
 */
exports.addAssetToScene = async (req, res) => {
  try {
    const { scene_id } = req.params;
    const { asset_id, role, metadata = {} } = req.body;

    // Validate scene exists
    const scene = await Scene.findByPk(scene_id);
    if (!scene) {
      return res.status(404).json({
        success: false,
        error: 'Scene not found',
      });
    }

    // Validate asset exists
    const asset = await Asset.findByPk(asset_id);
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found',
      });
    }

    // Check if role already exists for this scene
    const existing = await SceneAsset.findOne({
      where: { scene_id, role },
    });

    let scene_asset;
    if (existing) {
      // Update existing binding
      await existing.update({ asset_id, metadata });
      scene_asset = existing;
    } else {
      // Create new binding
      scene_asset = await SceneAsset.create({
        scene_id,
        asset_id,
        role,
        metadata,
      });
    }

    // Reload with asset details
    await scene_asset.reload({
      include: [{ model: Asset, as: 'asset' }],
    });

    res.status(existing ? 200 : 201).json({
      success: true,
      data: scene_asset,
      message: existing ? 'Asset binding updated' : 'Asset added to scene',
    });
  } catch (error) {
    console.error('Error adding asset to scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add asset',
      message: error.message,
    });
  }
};

/**
 * @route   GET /api/v1/scenes/:scene_id/assets
 * @desc    List all assets in scene
 * @access  Viewer+
 * @query   {string} role_filter - Filter by role pattern (e.g., "CLIP.%")
 */
exports.listSceneAssets = async (req, res) => {
  try {
    const { scene_id } = req.params;
    const { role_filter } = req.query;

    const where_clause = { scene_id };

    if (role_filter) {
      where_clause.role = { [Scene.sequelize.Sequelize.Op.like]: role_filter };
    }

    const assets = await SceneAsset.findAll({
      where: where_clause,
      include: [
        {
          model: Asset,
          as: 'asset',
        },
      ],
      order: [['role', 'ASC']],
    });

    res.json({
      success: true,
      data: assets,
      count: assets.length,
    });
  } catch (error) {
    console.error('Error listing scene assets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list assets',
      message: error.message,
    });
  }
};

/**
 * @route   PUT /api/v1/scenes/:scene_id/assets/:scene_asset_id
 * @desc    Update scene asset metadata
 * @access  Editor+
 * @body    {metadata}
 */
exports.updateSceneAsset = async (req, res) => {
  try {
    const { scene_asset_id } = req.params;
    const { metadata } = req.body;

    const scene_asset = await SceneAsset.findByPk(scene_asset_id);
    if (!scene_asset) {
      return res.status(404).json({
        success: false,
        error: 'Scene asset not found',
      });
    }

    // Merge metadata (don't replace entirely)
    const updated_metadata = {
      ...scene_asset.metadata,
      ...metadata,
    };

    await scene_asset.update({ metadata: updated_metadata });

    res.json({
      success: true,
      data: scene_asset,
      message: 'Scene asset updated',
    });
  } catch (error) {
    console.error('Error updating scene asset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update asset',
      message: error.message,
    });
  }
};

/**
 * @route   DELETE /api/v1/scenes/:scene_id/assets/:scene_asset_id
 * @desc    Remove asset from scene
 * @access  Editor+
 */
exports.removeAssetFromScene = async (req, res) => {
  try {
    const { scene_asset_id } = req.params;

    const scene_asset = await SceneAsset.findByPk(scene_asset_id);
    if (!scene_asset) {
      return res.status(404).json({
        success: false,
        error: 'Scene asset not found',
      });
    }

    await scene_asset.destroy();

    res.json({
      success: true,
      message: 'Asset removed from scene',
      deleted_id: scene_asset_id,
    });
  } catch (error) {
    console.error('Error removing asset from scene:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove asset',
      message: error.message,
    });
  }
};

module.exports = exports;

