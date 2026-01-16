const { models } = require('../models');
const { Scene, Episode } = models;

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
    const {
      episode_id,
      sceneType,
      productionStatus,
      page = 1,
      limit = 50,
    } = req.query;

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
exports.getScene = async (req, res) => {
  try {
    const { id } = req.params;

    const scene = await Scene.findByPk(id, {
      include: [
        {
          model: Episode,
          as: 'episode',
          attributes: ['id', 'title', 'episode_number', 'status'],
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
      data: scene,
    });
  } catch (error) {
    console.error('Error getting scene:', error);
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

    Object.keys(updates).forEach(key => {
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
      await sequelize.query(
        'DROP INDEX IF EXISTS idx_scenes_episode_scene_number',
        { transaction, type: sequelize.QueryTypes.RAW }
      );

      // Get all non-deleted scenes for this episode and renumber them
      const scenes = await Scene.findAll({
        where: { episode_id },
        order: [['scene_number', 'ASC']],
        paranoid: true,
        transaction
      });

      // Update scene numbers to sequential values
      for (let i = 0; i < scenes.length; i++) {
        await sequelize.query(
          'UPDATE scenes SET scene_number = :new_number WHERE id = :id',
          {
            replacements: { new_number: i + 1, id: scenes[i].id },
            transaction,
            type: sequelize.QueryTypes.UPDATE
          }
        );
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

    const episode = await Episode.findByPk(episodeId);
    if (!episode) {
      return res.status(404).json({
        success: false,
        error: 'Episode not found',
      });
    }

    const scenes = await Scene.getEpisodeScenes(episodeId);

    // Calculate statistics
    const stats = {
      total: scenes.length,
      totalDuration: scenes.reduce((sum, s) => sum + (s.duration_seconds || 0), 0),
      byType: {},
      byStatus: {},
    };

    scenes.forEach(scene => {
      // Count by type
      if (scene.scene_type) {
        stats.byType[scene.scene_type] = (stats.byType[scene.scene_type] || 0) + 1;
      }
      // Count by status
      if (scene.production_status) {
        stats.byStatus[scene.production_status] = (stats.byStatus[scene.production_status] || 0) + 1;
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

    scenes.forEach(scene => {
      if (scene.scene_type) {
        stats.byType[scene.scene_type] = (stats.byType[scene.scene_type] || 0) + 1;
      }
      if (scene.production_status) {
        stats.byStatus[scene.production_status] = (stats.byStatus[scene.production_status] || 0) + 1;
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

module.exports = exports;
