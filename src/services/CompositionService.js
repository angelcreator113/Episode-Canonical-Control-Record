/**
 * CompositionService
 * Handles thumbnail composition generation
 */

const { models } = require('../models');
const { ThumbnailComposition, ThumbnailTemplate, Asset, Thumbnail } = models;
const AssetService = require('./AssetService');
const { v4: uuidv4 } = require('uuid');

class CompositionService {
  /**
   * Create composition config
   */
  async createComposition(episodeId, compositionData, createdBy) {
    try {
      const { template_id, lala_asset_id, guest_asset_id, background_frame_asset_id } = compositionData;

      // Validate assets exist
      const [template, lalaAsset, guestAsset, frameAsset] = await Promise.all([
        ThumbnailTemplate.findByPk(template_id),
        Asset.findByPk(lala_asset_id),
        Asset.findByPk(guest_asset_id),
        Asset.findByPk(background_frame_asset_id),
      ]);

      if (!template) throw new Error('Template not found');
      if (!lalaAsset) throw new Error('Lala asset not found');
      if (!guestAsset) throw new Error('Guest asset not found');
      if (!frameAsset) throw new Error('Background frame not found');

      // Create composition record
      const composition = await ThumbnailComposition.create({
        episode_id: episodeId,
        template_id,
        lala_asset_id,
        guest_asset_id,
        background_frame_asset_id,
        composition_config: {
          template_id,
          layers: {
            lala: { asset_id: lala_asset_id, ...template.layout_config.lala },
            guest: { asset_id: guest_asset_id, ...template.layout_config.guest },
            background: { asset_id: background_frame_asset_id, ...template.layout_config.background },
            text: template.layout_config.text,
          },
        },
        created_by: createdBy,
        approval_status: 'DRAFT',
      });

      return composition.toJSON();
    } catch (error) {
      console.error('Failed to create composition:', error);
      throw error;
    }
  }

  /**
   * Get composition by ID
   */
  async getComposition(compositionId) {
    try {
      const composition = await ThumbnailComposition.findByPk(compositionId, {
        include: [
          { model: ThumbnailTemplate, as: 'template' },
          { model: Asset, as: 'lalaAsset' },
          { model: Asset, as: 'guestAsset' },
          { model: Asset, as: 'backgroundFrameAsset' },
        ],
      });

      if (!composition) {
        throw new Error('Composition not found');
      }

      return composition.toJSON();
    } catch (error) {
      console.error('Failed to get composition:', error);
      throw error;
    }
  }

  /**
   * List compositions for episode
   */
  async getEpisodeCompositions(episodeId) {
    try {
      const compositions = await ThumbnailComposition.findAll({
        where: { episode_id: episodeId },
        include: [{ model: ThumbnailTemplate, as: 'template' }],
        order: [['is_primary', 'DESC'], ['created_at', 'DESC']],
      });

      return compositions.map(c => c.toJSON());
    } catch (error) {
      console.error('Failed to get episode compositions:', error);
      throw error;
    }
  }

  /**
   * Mark composition as primary (only one per episode)
   */
  async setPrimary(compositionId) {
    try {
      const composition = await ThumbnailComposition.findByPk(compositionId);
      if (!composition) {
        throw new Error('Composition not found');
      }

      // Unset other compositions for this episode
      await ThumbnailComposition.update(
        { is_primary: false },
        { where: { episode_id: composition.episode_id, id: { [require('sequelize').Op.ne]: compositionId } } }
      );

      // Set this one as primary
      await composition.update({ is_primary: true });

      return composition.toJSON();
    } catch (error) {
      console.error('Failed to set primary composition:', error);
      throw error;
    }
  }

  /**
   * Update composition config (increments version)
   */
  async updateComposition(compositionId, compositionData) {
    try {
      const composition = await ThumbnailComposition.findByPk(compositionId);
      if (!composition) {
        throw new Error('Composition not found');
      }

      // Increment version and update config
      await composition.update({
        composition_config: compositionData,
        version: composition.version + 1,
        updated_at: new Date(),
      });

      return composition.toJSON();
    } catch (error) {
      console.error('Failed to update composition:', error);
      throw error;
    }
  }

  /**
   * Approve composition
   */
  async approveComposition(compositionId, approvedBy) {
    try {
      const composition = await ThumbnailComposition.findByPk(compositionId);
      if (!composition) {
        throw new Error('Composition not found');
      }

      await composition.update({
        approval_status: 'APPROVED',
        approved_by: approvedBy,
        approved_at: new Date(),
      });

      return composition.toJSON();
    } catch (error) {
      console.error('Failed to approve composition:', error);
      throw error;
    }
  }

  /**
   * Queue composition for generation (S3 event trigger)
   * In production: Lambda processes this and generates all formats
   */
  async queueForGeneration(compositionId) {
    try {
      const composition = await ThumbnailComposition.findByPk(compositionId);
      if (!composition) {
        throw new Error('Composition not found');
      }

      // Update status
      await composition.update({
        approval_status: 'PENDING',
      });

      // TODO: Trigger S3 event or SQS message for Lambda
      // This will invoke async thumbnail generation
      console.log(`📸 Queued composition ${compositionId} for Lambda processing`);

      return {
        status: 'QUEUED',
        compositionId,
        message: 'Composition queued for generation. Check back in a few moments.',
      };
    } catch (error) {
      console.error('Failed to queue composition:', error);
      throw error;
    }
  }

  /**
   * Get all templates
   */
  async getTemplates() {
    try {
      return await ThumbnailTemplate.findAll({
        order: [['platform', 'ASC']],
      });
    } catch (error) {
      console.error('Failed to get templates:', error);
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId) {
    try {
      const template = await ThumbnailTemplate.findByPk(templateId);
      if (!template) {
        throw new Error('Template not found');
      }
      return template.toJSON();
    } catch (error) {
      console.error('Failed to get template:', error);
      throw error;
    }
  }
}

module.exports = new CompositionService();
