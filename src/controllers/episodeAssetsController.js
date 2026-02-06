const { models } = require('../models');
const { EpisodeAsset, Asset, Episode } = models;
const { Op } = require('sequelize');

/**
 * Episode Assets Controller
 * Manages episode-level asset library (Library → Episode layer)
 */

/**
 * List assets in episode library
 * GET /api/v1/episodes/:episodeId/library-assets
 */
exports.listEpisodeAssets = async (req, res) => {
  try {
    const { id: episodeId } = req.params;
    const { folder, search, tags } = req.query;

    const where = { episode_id: episodeId };
    
    // Filter by folder
    if (folder && folder !== 'all') {
      where.folder = folder;
    }

    // Build query
    const episodeAssets = await EpisodeAsset.findAll({
      where,
      include: [
        {
          model: Asset,
          as: 'asset',
          required: true,
          ...(search && {
            where: {
              [Op.or]: [
                { name: { [Op.iLike]: `%${search}%` } },
                { type: { [Op.iLike]: `%${search}%` } },
              ],
            },
          }),
        },
      ],
      order: [
        ['folder', 'ASC'],
        ['sort_order', 'ASC'],
        ['added_at', 'DESC'],
      ],
    });

    // Group by folder
    const groupedAssets = {};
    episodeAssets.forEach((ea) => {
      const folderName = ea.folder || 'Uncategorized';
      if (!groupedAssets[folderName]) {
        groupedAssets[folderName] = [];
      }
      groupedAssets[folderName].push(ea);
    });

    res.json({
      success: true,
      data: {
        total: episodeAssets.length,
        folders: groupedAssets,
        assets: episodeAssets,
      },
    });
  } catch (error) {
    console.error('❌ Error listing episode assets:', error.message);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to list episode assets',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

/**
 * Add asset to episode library
 * POST /api/v1/episodes/:episodeId/library-assets
 */
exports.addAssetToEpisode = async (req, res) => {
  try {
    const { id: episodeId } = req.params;
    const { assetId, folder, tags, sortOrder, addedBy } = req.body;

    // Validate asset exists
    const asset = await Asset.findByPk(assetId);
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found',
      });
    }

    // Check if already added
    const existing = await EpisodeAsset.findOne({
      where: {
        episode_id: episodeId,
        asset_id: assetId,
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Asset already in episode library',
        data: existing,
      });
    }

    // Create episode asset
    const episodeAsset = await EpisodeAsset.create({
      episode_id: episodeId,
      asset_id: assetId,
      folder: folder || 'Uncategorized',
      tags: tags || [],
      sort_order: sortOrder || 0,
      added_by: addedBy || 'system',
    });

    // Load with asset data
    const result = await EpisodeAsset.findByPk(episodeAsset.id, {
      include: [{ model: Asset, as: 'asset' }],
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error adding asset to episode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add asset to episode',
      message: error.message,
    });
  }
};

/**
 * Remove asset from episode library
 * DELETE /api/v1/episodes/:episodeId/library-assets/:assetId
 */
exports.removeAssetFromEpisode = async (req, res) => {
  try {
    const { id: episodeId, assetId } = req.params;

    const episodeAsset = await EpisodeAsset.findOne({
      where: {
        episode_id: episodeId,
        asset_id: assetId,
      },
    });

    if (!episodeAsset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not in episode library',
      });
    }

    // TODO: Check if asset is used in timeline placements
    // For now, allow deletion (cascade will handle placements)

    await episodeAsset.destroy();

    res.json({
      success: true,
      message: 'Asset removed from episode library',
    });
  } catch (error) {
    console.error('Error removing asset from episode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove asset from episode',
      message: error.message,
    });
  }
};

/**
 * Update episode asset metadata
 * PATCH /api/v1/episodes/:episodeId/library-assets/:assetId
 */
exports.updateEpisodeAsset = async (req, res) => {
  try {
    const { id: episodeId, assetId } = req.params;
    const { folder, tags, sortOrder } = req.body;

    const episodeAsset = await EpisodeAsset.findOne({
      where: {
        episode_id: episodeId,
        asset_id: assetId,
      },
    });

    if (!episodeAsset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not in episode library',
      });
    }

    // Update fields
    if (folder !== undefined) episodeAsset.folder = folder;
    if (tags !== undefined) episodeAsset.tags = tags;
    if (sortOrder !== undefined) episodeAsset.sort_order = sortOrder;

    await episodeAsset.save();

    // Reload with asset data
    const result = await EpisodeAsset.findByPk(episodeAsset.id, {
      include: [{ model: Asset, as: 'asset' }],
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error updating episode asset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update episode asset',
      message: error.message,
    });
  }
};

/**
 * Get available folders for episode assets
 * GET /api/v1/episodes/:episodeId/library-assets/folders
 */
exports.getAssetFolders = async (req, res) => {
  try {
    const { episodeId } = req.params;

    const episodeAssets = await EpisodeAsset.findAll({
      where: { episode_id: episodeId },
      attributes: [
        [models.Sequelize.fn('DISTINCT', models.Sequelize.col('folder')), 'folder'],
        [models.Sequelize.fn('COUNT', '*'), 'count'],
      ],
      group: ['folder'],
      raw: true,
    });

    const folders = episodeAssets.map((ea) => ({
      name: ea.folder || 'Uncategorized',
      count: parseInt(ea.count),
    }));

    res.json({
      success: true,
      data: folders,
    });
  } catch (error) {
    console.error('Error getting asset folders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get asset folders',
      message: error.message,
    });
  }
};
