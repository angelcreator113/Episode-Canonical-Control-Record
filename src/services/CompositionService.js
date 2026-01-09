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
      const { 
        template_id, 
        lala_asset_id, 
        justawomen_asset_id,
        include_justawomaninherprime,
        justawomaninherprime_position,
        guest_asset_id, 
        background_frame_asset_id,
        selected_formats // Add this
      } = compositionData;

      // Validate assets exist
      const [template, lalaAsset, guestAsset, frameAsset] = await Promise.all([
        ThumbnailTemplate.findByPk(template_id),
        Asset.findByPk(lala_asset_id),
        guest_asset_id ? Asset.findByPk(guest_asset_id) : null,
        background_frame_asset_id ? Asset.findByPk(background_frame_asset_id) : null,
      ]);

      if (!template) throw new Error('Template not found');
      if (!lalaAsset) throw new Error('Lala asset not found');
      if (guest_asset_id && !guestAsset) throw new Error('Guest asset not found');
      if (background_frame_asset_id && !frameAsset) throw new Error('Background frame not found');

      // Verify JustAWoman asset if including it
      let justawomanAsset = null;
      if (include_justawomaninherprime && justawomen_asset_id) {
        justawomanAsset = await Asset.findByPk(justawomen_asset_id);
        if (!justawomanAsset) throw new Error('JustAWoman asset not found');
      }

      // Parse layout_config if it's a string (from JSONB)
      let layoutConfig = template.layout_config;
      if (typeof layoutConfig === 'string') {
        layoutConfig = JSON.parse(layoutConfig);
      }

      if (!layoutConfig || !layoutConfig.lala) {
        throw new Error('Template missing layout_config or lala configuration');
      }

      // Create composition record
      const composition = await ThumbnailComposition.create({
        episode_id: episodeId,
        template_id,
        lala_asset_id,
        justawomen_asset_id: include_justawomaninherprime ? justawomen_asset_id : null,
        include_justawomaninherprime: include_justawomaninherprime || false,
        justawomaninherprime_position: justawomaninherprime_position || null,
        guest_asset_id: guest_asset_id || null,
        background_frame_asset_id: background_frame_asset_id || null,
        composition_config: {
          template_id,
          selected_formats: selected_formats || [], // Store the formats
          layers: {
            lala: { asset_id: lala_asset_id, ...layoutConfig.lala },
            justawoman: include_justawomaninherprime && justawomanAsset 
              ? { asset_id: justawomen_asset_id, ...layoutConfig.justawomaninherprime } 
              : null,
            guest: guest_asset_id ? { asset_id: guest_asset_id, ...layoutConfig.guest } : null,
            background: background_frame_asset_id ? { asset_id: background_frame_asset_id, ...layoutConfig.background } : null,
            text: layoutConfig.text,
          },
        },
        created_by: createdBy,
        approval_status: 'DRAFT',
      });

      const json = composition.toJSON();
      
      // Add episode info for UI
      if (template && template.dataValues) {
        json.episodeName = 'Composition';
      }
      
      // Add selected formats for UI
      json.selected_formats = selected_formats || [];
      
      return json;
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
          { model: Asset, as: 'justawomanAsset' },
          { model: Asset, as: 'backgroundAsset' },
        ],
      });

      if (!composition) {
        throw new Error('Composition not found');
      }

      const json = composition.toJSON();
      // Extract selected_formats from composition_config JSONB
      if (json.composition_config && json.composition_config.selected_formats) {
        json.selected_formats = json.composition_config.selected_formats;
      } else {
        json.selected_formats = [];
      }
      return json;
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
      // Handle both integer IDs and UUID format
      // If UUID, look for an episode with that ID first
      // If integer, use directly
      let queryEpisodeId = episodeId;
      
      // If it looks like a UUID, try to find the actual episode
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(episodeId)) {
        // This is a UUID - but our Episode table uses integer IDs
        // Return empty array since we can't match UUIDs
        console.log(`Episode UUID received but database uses integer IDs: ${episodeId}`);
        return [];
      }
      
      // Try to parse as integer
      const parsedId = parseInt(episodeId, 10);
      if (!isNaN(parsedId) && parsedId > 0) {
        queryEpisodeId = parsedId;
      }
      
      const compositions = await ThumbnailComposition.findAll({
        where: { episode_id: queryEpisodeId },
        include: [
          { model: ThumbnailTemplate, as: 'template' },
          { 
            model: models.Episode, 
            as: 'episode',
            attributes: ['id', 'episodeTitle', 'episodeNumber', 'seasonNumber']
          }
        ],
        order: [['is_primary', 'DESC'], ['created_at', 'DESC']],
      });

      return compositions.map(c => {
        const json = c.toJSON();
        // Add episodeName for UI
        if (c.episode) {
          json.episodeName = c.episode.episodeTitle || `Episode ${c.episode.episodeNumber}`;
        }
        // Extract selected_formats from composition_config JSONB
        if (json.composition_config && json.composition_config.selected_formats) {
          json.selected_formats = json.composition_config.selected_formats;
        } else {
          json.selected_formats = [];
        }
        return json;
      });
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

  /**
   * Generate thumbnails for selected formats
   */
  async generateThumbnails(compositionId, selectedFormats) {
    try {
      const composition = await ThumbnailComposition.findByPk(compositionId, {
        attributes: ['id', 'episode_id', 'template_id', 'composition_config', 'approval_status']
      });

      if (!composition) {
        throw new Error('Composition not found');
      }

      // Skip YouTube check for Phase 2.5 (admin manual triggers)
      // TODO: Re-enable after production validation

      // Define all available formats
      const allFormats = [
        { name: 'YOUTUBE', width: 1920, height: 1080 },
        { name: 'YOUTUBE_MOBILE', width: 1280, height: 720 },
        { name: 'INSTAGRAM_FEED', width: 1080, height: 1080 },
        { name: 'INSTAGRAM_STORY', width: 1080, height: 1920 },
        { name: 'TIKTOK', width: 1080, height: 1920 },
        { name: 'FACEBOOK', width: 1200, height: 630 },
        { name: 'TWITTER', width: 1200, height: 675 },
        { name: 'PINTEREST', width: 1000, height: 1500 }
      ];

      // Filter to only selected formats
      const formatsToGenerate = allFormats.filter(f => 
        selectedFormats.includes(f.name)
      );

      const ThumbnailGeneratorService = require('./ThumbnailGeneratorService');
      const thumbnails = [];

      for (const format of formatsToGenerate) {
        try {
          const thumbnail = await ThumbnailGeneratorService.generateThumbnail(composition, format);
          if (thumbnail) {
            thumbnails.push(thumbnail);
          }
        } catch (formatErr) {
          console.warn(`⚠️ Failed to generate ${format.name} thumbnail:`, formatErr.message);
          // Continue with next format
        }
      }

      console.log(`✅ Generated ${thumbnails.length} thumbnails for composition ${compositionId}`);
      return thumbnails;

    } catch (error) {
      console.error('❌ Failed to generate thumbnails:', error);
      throw error;
    }
  }

  /**
   * Update composition assets and regenerate thumbnails
   */
  async updateComposition(compositionId, updateData) {
    try {
      const composition = await ThumbnailComposition.findByPk(compositionId);
      if (!composition) {
        throw new Error('Composition not found');
      }

      // Update assets
      const { lala_asset_id, guest_asset_id, justawomen_asset_id, include_justawomaninherprime } = updateData;

      if (lala_asset_id) composition.lala_asset_id = lala_asset_id;
      if (guest_asset_id !== undefined) composition.guest_asset_id = guest_asset_id;
      if (justawomen_asset_id !== undefined) {
        composition.justawomen_asset_id = justawomen_asset_id;
      }
      if (include_justawomaninherprime !== undefined) {
        composition.include_justawomaninherprime = include_justawomaninherprime;
      }

      // Increment version
      composition.version = (composition.version || 1) + 1;

      await composition.save();

      console.log(`✅ Composition updated: ${compositionId} (version ${composition.version})`);
      return composition;

    } catch (error) {
      console.error('❌ Failed to update composition:', error);
      throw error;
    }
  }
}

module.exports = new CompositionService();
