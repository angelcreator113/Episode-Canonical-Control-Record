const { models } = require('../models');
const { EpisodeWardrobe, Wardrobe, WardrobeLibrary, WardrobeUsageHistory, Episode } = models;
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');

/**
 * Wardrobe Approval Controller
 * Handles approval workflow for episode wardrobe items
 */

module.exports = {
  /**
   * PUT /api/v1/episodes/:episodeId/wardrobe/:wardrobeId/approve
   * Approve a wardrobe item for an episode
   */
  async approveWardrobeItem(req, res) {
    try {
      const { episodeId, wardrobeId } = req.params;
      const { approvedBy, notes } = req.body;

      // Find the episode-wardrobe link
      const episodeWardrobe = await EpisodeWardrobe.findOne({
        where: {
          episode_id: episodeId,
          wardrobe_id: wardrobeId,
        },
        include: [
          {
            model: Wardrobe,
            as: 'wardrobe',
            include: [
              {
                model: WardrobeLibrary,
                as: 'libraryItem',
              },
            ],
          },
          {
            model: Episode,
            as: 'episode',
          },
        ],
      });

      if (!episodeWardrobe) {
        throw new NotFoundError('Wardrobe item not found for this episode');
      }

      // Check if already approved
      if (episodeWardrobe.approval_status === 'approved') {
        return res.json({
          success: true,
          data: episodeWardrobe,
          message: 'Item already approved',
        });
      }

      // Update approval status
      await episodeWardrobe.update({
        approval_status: 'approved',
        approved_by: approvedBy || req.user?.id || 'system',
        approved_at: new Date(),
        rejection_reason: null, // Clear any previous rejection
      });

      // Record in usage history
      if (episodeWardrobe.wardrobe?.library_item_id) {
        await WardrobeUsageHistory.create({
          libraryItemId: episodeWardrobe.wardrobe.library_item_id,
          episodeId: episodeId,
          showId: episodeWardrobe.episode?.showId,
          usageType: 'approved',
          userId: approvedBy || req.user?.id || 'system',
          notes: notes || 'Item approved',
        });
      }

      // Reload with associations
      await episodeWardrobe.reload({
        include: [
          {
            model: Wardrobe,
            as: 'wardrobe',
            include: [
              {
                model: WardrobeLibrary,
                as: 'libraryItem',
              },
            ],
          },
        ],
      });

      res.json({
        success: true,
        data: episodeWardrobe,
        message: 'Wardrobe item approved successfully',
      });
    } catch (error) {
      console.error('Error approving wardrobe item:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * PUT /api/v1/episodes/:episodeId/wardrobe/:wardrobeId/reject
   * Reject a wardrobe item for an episode
   */
  async rejectWardrobeItem(req, res) {
    try {
      const { episodeId, wardrobeId } = req.params;
      const { rejectedBy, reason } = req.body;

      if (!reason) {
        throw new ValidationError('Rejection reason is required');
      }

      // Find the episode-wardrobe link
      const episodeWardrobe = await EpisodeWardrobe.findOne({
        where: {
          episode_id: episodeId,
          wardrobe_id: wardrobeId,
        },
        include: [
          {
            model: Wardrobe,
            as: 'wardrobe',
            include: [
              {
                model: WardrobeLibrary,
                as: 'libraryItem',
              },
            ],
          },
          {
            model: Episode,
            as: 'episode',
          },
        ],
      });

      if (!episodeWardrobe) {
        throw new NotFoundError('Wardrobe item not found for this episode');
      }

      // Update rejection status
      await episodeWardrobe.update({
        approval_status: 'rejected',
        approved_by: null,
        approved_at: null,
        rejection_reason: reason,
      });

      // Record in usage history
      if (episodeWardrobe.wardrobe?.library_item_id) {
        await WardrobeUsageHistory.create({
          libraryItemId: episodeWardrobe.wardrobe.library_item_id,
          episodeId: episodeId,
          showId: episodeWardrobe.episode?.showId,
          usageType: 'rejected',
          userId: rejectedBy || req.user?.id || 'system',
          notes: reason,
        });
      }

      // Reload with associations
      await episodeWardrobe.reload({
        include: [
          {
            model: Wardrobe,
            as: 'wardrobe',
            include: [
              {
                model: WardrobeLibrary,
                as: 'libraryItem',
              },
            ],
          },
        ],
      });

      res.json({
        success: true,
        data: episodeWardrobe,
        message: 'Wardrobe item rejected',
      });
    } catch (error) {
      console.error('Error rejecting wardrobe item:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * GET /api/v1/episodes/:episodeId/wardrobe/approval-status
   * Get approval status for all wardrobe items in an episode
   */
  async getApprovalStatus(req, res) {
    try {
      const { episodeId } = req.params;

      // Verify episode exists
      const episode = await Episode.findByPk(episodeId);
      if (!episode) {
        throw new NotFoundError('Episode not found');
      }

      // Get all wardrobe items for the episode
      const wardrobeItems = await EpisodeWardrobe.findAll({
        where: { episode_id: episodeId },
        include: [
          {
            model: Wardrobe,
            as: 'wardrobe',
            include: [
              {
                model: WardrobeLibrary,
                as: 'libraryItem',
                attributes: ['id', 'name', 'type', 'itemType', 'imageUrl', 'thumbnailUrl', 'color'],
              },
            ],
          },
        ],
        order: [['created_at', 'DESC']],
      });

      // Group by approval status
      const grouped = {
        pending: [],
        approved: [],
        rejected: [],
      };

      wardrobeItems.forEach((item) => {
        const status = item.approval_status || 'pending';
        if (grouped[status]) {
          grouped[status].push({
            id: item.id,
            wardrobeId: item.wardrobe_id,
            scene: item.scene,
            wornAt: item.worn_at,
            notes: item.notes,
            approvalStatus: item.approval_status,
            approvedBy: item.approved_by,
            approvedAt: item.approved_at,
            rejectionReason: item.rejection_reason,
            wardrobe: item.wardrobe,
          });
        }
      });

      res.json({
        success: true,
        data: grouped,
        summary: {
          total: wardrobeItems.length,
          pending: grouped.pending.length,
          approved: grouped.approved.length,
          rejected: grouped.rejected.length,
        },
      });
    } catch (error) {
      console.error('Error getting approval status:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * PUT /api/v1/episodes/:episodeId/wardrobe/bulk-approve
   * Bulk approve multiple wardrobe items
   */
  async bulkApprove(req, res) {
    try {
      const { episodeId } = req.params;
      const { wardrobeIds, approvedBy, notes } = req.body;

      if (!wardrobeIds || !Array.isArray(wardrobeIds) || wardrobeIds.length === 0) {
        throw new ValidationError('wardrobeIds array is required');
      }

      const transaction = await models.sequelize.transaction();

      try {
        let approvedCount = 0;
        const errors = [];

        for (const wardrobeId of wardrobeIds) {
          try {
            const episodeWardrobe = await EpisodeWardrobe.findOne({
              where: {
                episode_id: episodeId,
                wardrobe_id: wardrobeId,
              },
              include: [
                {
                  model: Wardrobe,
                  as: 'wardrobe',
                },
                {
                  model: Episode,
                  as: 'episode',
                },
              ],
              transaction,
            });

            if (!episodeWardrobe) {
              errors.push({
                wardrobeId,
                error: 'Not found',
              });
              continue;
            }

            // Skip if already approved
            if (episodeWardrobe.approval_status === 'approved') {
              continue;
            }

            // Update approval status
            await episodeWardrobe.update(
              {
                approval_status: 'approved',
                approved_by: approvedBy || req.user?.id || 'system',
                approved_at: new Date(),
                rejection_reason: null,
              },
              { transaction }
            );

            // Record in usage history
            if (episodeWardrobe.wardrobe?.library_item_id) {
              await WardrobeUsageHistory.create(
                {
                  libraryItemId: episodeWardrobe.wardrobe.library_item_id,
                  episodeId: episodeId,
                  showId: episodeWardrobe.episode?.showId,
                  usageType: 'approved',
                  userId: approvedBy || req.user?.id || 'system',
                  notes: notes || 'Bulk approval',
                },
                { transaction }
              );
            }

            approvedCount++;
          } catch (error) {
            errors.push({
              wardrobeId,
              error: error.message,
            });
          }
        }

        await transaction.commit();

        res.json({
          success: true,
          message: `Bulk approval completed: ${approvedCount} item(s) approved`,
          approvedCount,
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error in bulk approve:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message,
      });
    }
  },
};
