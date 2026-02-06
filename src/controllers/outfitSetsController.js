const db = require('../models');
const { models, sequelize, Sequelize } = db;
const { Op } = require('sequelize');

/**
 * Outfit Sets Controller
 * Handles default outfit sets (show-level) and episode outfit instances
 */

module.exports = {
  /**
   * GET /api/v1/outfit-sets - List default outfit sets
   */
  async listOutfitSets(req, res) {
    try {
      const { showId, character } = req.query;

      const where = { deleted_at: null };
      if (showId) where.show_id = showId;
      if (character) where.character = character;

      // Query outfit_sets with items count
      const query = `
        SELECT 
          os.*,
          COUNT(DISTINCT osi.id) as items_count,
          json_agg(
            json_build_object(
              'id', w.id,
              'name', w.name,
              'image_url', w.s3_url,
              'category', w.clothing_category,
              'position', osi.position,
              'required', osi.required_flag
            ) ORDER BY osi.position
          ) FILTER (WHERE w.id IS NOT NULL) as items
        FROM outfit_sets os
        LEFT JOIN outfit_set_items osi ON osi.outfit_set_id = os.id
        LEFT JOIN wardrobe w ON w.id = osi.wardrobe_item_id AND w.deleted_at IS NULL
        WHERE os.deleted_at IS NULL
        ${showId ? 'AND os.show_id = :showId' : ''}
        ${character ? 'AND os.character = :character' : ''}
        GROUP BY os.id
        ORDER BY os.created_at DESC
      `;

      const outfitSets = await sequelize.query(query, {
        replacements: { showId, character },
        type: Sequelize.QueryTypes.SELECT,
      });

      res.json({
        success: true,
        data: outfitSets,
        count: outfitSets.length,
      });
    } catch (error) {
      console.error('❌ Error listing outfit sets:', error);
      res.status(500).json({
        error: 'Failed to list outfit sets',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/outfit-sets - Create default outfit set
   */
  async createOutfitSet(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const {
        name,
        description,
        showId,
        character,
        occasion,
        season,
        items, // Array of { wardrobeItemId, position, required }
      } = req.body;

      if (!name || !items || items.length === 0) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['name', 'items (array with at least one item)'],
        });
      }

      // Create outfit set
      const [outfitSet] = await sequelize.query(
        `INSERT INTO outfit_sets (name, description, show_id, character, occasion, season, created_at, updated_at)
         VALUES (:name, :description, :showId, :character, :occasion, :season, NOW(), NOW())
         RETURNING *`,
        {
          replacements: {
            name,
            description: description || null,
            showId: showId || null,
            character: character || null,
            occasion: occasion || null,
            season: season || null,
          },
          type: Sequelize.QueryTypes.INSERT,
          transaction,
        }
      );

      const outfitSetId = outfitSet[0].id;

      // Create outfit set items
      for (const item of items) {
        await sequelize.query(
          `INSERT INTO outfit_set_items 
           (outfit_set_id, wardrobe_item_id, position, required_flag, notes, created_at)
           VALUES (:outfitSetId, :wardrobeItemId, :position, :required, :notes, NOW())`,
          {
            replacements: {
              outfitSetId,
              wardrobeItemId: item.wardrobeItemId,
              position: item.position || 0,
              required: item.required !== undefined ? item.required : true,
              notes: item.notes || null,
            },
            type: Sequelize.QueryTypes.INSERT,
            transaction,
          }
        );
      }

      await transaction.commit();

      // Fetch complete outfit set with items
      const complete = await this.getOutfitSetById(outfitSetId);

      res.status(201).json({
        success: true,
        data: complete,
        message: 'Outfit set created successfully',
      });
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error creating outfit set:', error);
      res.status(500).json({
        error: 'Failed to create outfit set',
        message: error.message,
      });
    }
  },

  /**
   * GET /api/v1/outfit-sets/:id - Get single outfit set
   */
  async getOutfitSet(req, res) {
    try {
      const { id } = req.params;
      const outfitSet = await this.getOutfitSetById(id);

      if (!outfitSet) {
        return res.status(404).json({
          error: 'Outfit set not found',
        });
      }

      res.json({
        success: true,
        data: outfitSet,
      });
    } catch (error) {
      console.error('❌ Error fetching outfit set:', error);
      res.status(500).json({
        error: 'Failed to fetch outfit set',
        message: error.message,
      });
    }
  },

  /**
   * Helper: Get outfit set by ID with items
   */
  async getOutfitSetById(id) {
    const [outfitSets] = await sequelize.query(
      `SELECT 
        os.*,
        json_agg(
          json_build_object(
            'id', osi.id,
            'wardrobe_item_id', w.id,
            'name', w.name,
            'image_url', w.s3_url,
            'image_url_processed', w.s3_url_processed,
            'category', w.clothing_category,
            'character', w.character,
            'position', osi.position,
            'required', osi.required_flag,
            'notes', osi.notes
          ) ORDER BY osi.position
        ) FILTER (WHERE w.id IS NOT NULL) as items
      FROM outfit_sets os
      LEFT JOIN outfit_set_items osi ON osi.outfit_set_id = os.id
      LEFT JOIN wardrobe w ON w.id = osi.wardrobe_item_id AND w.deleted_at IS NULL
      WHERE os.id = :id AND os.deleted_at IS NULL
      GROUP BY os.id`,
      {
        replacements: { id },
        type: Sequelize.QueryTypes.SELECT,
      }
    );

    return outfitSets[0] || null;
  },

  /**
   * DELETE /api/v1/outfit-sets/:id - Delete outfit set
   */
  async deleteOutfitSet(req, res) {
    try {
      const { id } = req.params;

      const [result] = await sequelize.query(
        `UPDATE outfit_sets SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL RETURNING id`,
        {
          replacements: { id },
          type: Sequelize.QueryTypes.UPDATE,
        }
      );

      if (!result || result.length === 0) {
        return res.status(404).json({
          error: 'Outfit set not found',
        });
      }

      res.json({
        success: true,
        message: 'Outfit set deleted successfully',
      });
    } catch (error) {
      console.error('❌ Error deleting outfit set:', error);
      res.status(500).json({
        error: 'Failed to delete outfit set',
        message: error.message,
      });
    }
  },

  // ==========================================
  // EPISODE OUTFIT INSTANCES
  // ==========================================

  /**
   * GET /api/v1/episodes/:id/outfits - Get episode outfits
   */
  async getEpisodeOutfits(req, res) {
    try {
      const { id: episodeId } = req.params;

      const query = `
        SELECT 
          eo.*,
          json_agg(
            json_build_object(
              'id', eoi.id,
              'wardrobe_item_id', w.id,
              'name', w.name,
              'image_url', w.s3_url,
              'image_url_processed', w.s3_url_processed,
              'category', w.clothing_category,
              'position', eoi.position,
              'required', eoi.required,
              'notes', eoi.notes
            ) ORDER BY eoi.position
          ) FILTER (WHERE w.id IS NOT NULL) as items,
          os.name as source_set_name
        FROM episode_outfits eo
        LEFT JOIN episode_outfit_items eoi ON eoi.episode_outfit_id = eo.id
        LEFT JOIN wardrobe w ON w.id = eoi.wardrobe_item_id AND w.deleted_at IS NULL
        LEFT JOIN outfit_sets os ON os.id = eo.source_outfit_set_id
        WHERE eo.episode_id = :episodeId AND eo.deleted_at IS NULL
        GROUP BY eo.id, os.name
        ORDER BY eo.created_at DESC
      `;

      const episodeOutfits = await sequelize.query(query, {
        replacements: { episodeId },
        type: Sequelize.QueryTypes.SELECT,
      });

      res.json({
        success: true,
        data: episodeOutfits,
        count: episodeOutfits.length,
      });
    } catch (error) {
      console.error('❌ Error fetching episode outfits:', error);
      res.status(500).json({
        error: 'Failed to fetch episode outfits',
        message: error.message,
      });
    }
  },

  /**
   * POST /api/v1/episodes/:id/outfits - Create episode outfit
   * Can copy from default set or create custom
   */
  async createEpisodeOutfit(req, res) {
    const transaction = await sequelize.transaction();

    try {
      const { id: episodeId } = req.params;
      const {
        name,
        description,
        sourceOutfitSetId, // Optional: copy from default set
        character,
        occasion,
        notes,
        items, // If custom, provide items array
      } = req.body;

      if (!name || !character) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['name', 'character'],
        });
      }

      let itemsToAdd = items || [];

      // If copying from default set, get its items
      if (sourceOutfitSetId && (!items || items.length === 0)) {
        const sourceSet = await this.getOutfitSetById(sourceOutfitSetId);
        if (!sourceSet || !sourceSet.items) {
          return res.status(404).json({
            error: 'Source outfit set not found',
          });
        }
        itemsToAdd = sourceSet.items.map((item, index) => ({
          wardrobeItemId: item.wardrobe_item_id,
          position: item.position !== undefined ? item.position : index,
          required: item.required !== undefined ? item.required : true,
          notes: item.notes,
        }));
      }

      if (itemsToAdd.length === 0) {
        return res.status(400).json({
          error: 'No items provided',
          message: 'Either provide items array or sourceOutfitSetId',
        });
      }

      // Create episode outfit
      const [episodeOutfit] = await sequelize.query(
        `INSERT INTO episode_outfits 
         (episode_id, name, description, source_outfit_set_id, character, occasion, notes, created_at, updated_at)
         VALUES (:episodeId, :name, :description, :sourceOutfitSetId, :character, :occasion, :notes, NOW(), NOW())
         RETURNING *`,
        {
          replacements: {
            episodeId,
            name,
            description: description || null,
            sourceOutfitSetId: sourceOutfitSetId || null,
            character,
            occasion: occasion || null,
            notes: notes || null,
          },
          type: Sequelize.QueryTypes.INSERT,
          transaction,
        }
      );

      const episodeOutfitId = episodeOutfit[0].id;

      // Add items to episode outfit
      for (const item of itemsToAdd) {
        await sequelize.query(
          `INSERT INTO episode_outfit_items 
           (episode_outfit_id, wardrobe_item_id, position, required, notes, created_at)
           VALUES (:episodeOutfitId, :wardrobeItemId, :position, :required, :notes, NOW())`,
          {
            replacements: {
              episodeOutfitId,
              wardrobeItemId: item.wardrobeItemId,
              position: item.position || 0,
              required: item.required !== undefined ? item.required : true,
              notes: item.notes || null,
            },
            type: Sequelize.QueryTypes.INSERT,
            transaction,
          }
        );
      }

      await transaction.commit();

      res.status(201).json({
        success: true,
        data: episodeOutfit[0],
        message: `Episode outfit created ${sourceOutfitSetId ? 'from default set' : 'successfully'}`,
      });
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Error creating episode outfit:', error);
      res.status(500).json({
        error: 'Failed to create episode outfit',
        message: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/episodes/:episodeId/outfits/:outfitId - Delete episode outfit
   */
  async deleteEpisodeOutfit(req, res) {
    try {
      const { episodeId, outfitId } = req.params;

      const [result] = await sequelize.query(
        `UPDATE episode_outfits 
         SET deleted_at = NOW() 
         WHERE id = :outfitId AND episode_id = :episodeId AND deleted_at IS NULL
         RETURNING id`,
        {
          replacements: { outfitId, episodeId },
          type: Sequelize.QueryTypes.UPDATE,
        }
      );

      if (!result || result.length === 0) {
        return res.status(404).json({
          error: 'Episode outfit not found',
        });
      }

      res.json({
        success: true,
        message: 'Episode outfit deleted successfully',
      });
    } catch (error) {
      console.error('❌ Error deleting episode outfit:', error);
      res.status(500).json({
        error: 'Failed to delete episode outfit',
        message: error.message,
      });
    }
  },
};
