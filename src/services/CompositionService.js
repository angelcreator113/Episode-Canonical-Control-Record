/**
 * CompositionService
 * Handles thumbnail composition generation
 */

const { models } = require('../models');
const _AssetService = require('./AssetService');
const { v4: _uuidv4 } = require('uuid');
const { 
  shouldRequireIconHolder, 
  getTextRoles,
  getRoleMetadata 
} = require('../constants/canonicalRoles');

class CompositionService {
  /**
   * Create composition config
   */
  async createComposition(episodeId, compositionData, createdBy) {
    try {
      // episodeId is UUID - compositions table uses UUID for episode_id
      const {
        template_id,
        assets, // NEW: role-based asset mapping
        composition_config, // NEW: visibility + text fields
        selected_formats,
        // Legacy fields (backwards compatibility)
        lala_asset_id,
        justawomen_asset_id,
        include_justawomaninherprime,
        justawomaninherprime_position,
        guest_asset_id,
        background_frame_asset_id,
      } = compositionData;

      // Validate template exists
      const template = await models.ThumbnailTemplate.findByPk(template_id);
      if (!template) throw new Error('Template not found');

      // NEW: Validate composition config
      const config = composition_config || { visibility: {}, text_fields: {}, overrides: {} };
      const validationErrors = await this._validateCompositionConfig(
        config,
        template,
        assets,
        episodeId // ✅ Use UUID directly
      );
      
      if (validationErrors.length > 0) {
        throw new Error(`Composition validation failed: ${validationErrors.join('; ')}`);
      }

      // Auto-manage icon holder
      if (shouldRequireIconHolder(config.visibility)) {
        config.visibility['UI.ICON.HOLDER.MAIN'] = true;
      }

      // Legacy validation (backwards compatibility)
      if (lala_asset_id) {
        const lalaAsset = await models.Asset.findByPk(lala_asset_id);
        if (!lalaAsset) throw new Error('Lala asset not found');
      }
      if (guest_asset_id) {
        const guestAsset = await models.Asset.findByPk(guest_asset_id);
        if (!guestAsset) throw new Error('Guest asset not found');
      }
      if (background_frame_asset_id) {
        const frameAsset = await models.Asset.findByPk(background_frame_asset_id);
        if (!frameAsset) throw new Error('Background frame not found');
      }
      if (include_justawomaninherprime && justawomen_asset_id) {
        justawomanAsset = await models.Asset.findByPk(justawomen_asset_id);
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
      const composition = await models.ThumbnailComposition.create({
        episode_id: episodeId, // ✅ Use UUID directly
        template_id,
        composition_config: config, // NEW: Store visibility + text fields
        selected_formats: selected_formats || [],
        // Legacy fields (backwards compatibility)
        lala_asset_id,
        justawomen_asset_id: include_justawomaninherprime ? justawomen_asset_id : null,
        include_justawomaninherprime: include_justawomaninherprime || false,
        justawomaninherprime_position: justawomaninherprime_position || null,
        guest_asset_id: guest_asset_id || null,
        background_frame_asset_id: background_frame_asset_id || null,
        created_by: createdBy,
        approval_status: 'DRAFT',
        status: 'draft',
      });

      // NEW: Create CompositionAsset junction records for role-based assets
      if (assets && typeof assets === 'object') {
        const { CompositionAsset } = models;
        const compositionAssetRecords = Object.entries(assets).map(([role, assetId], index) => ({
          composition_id: composition.id,
          asset_role: role,
          asset_id: assetId,
          layer_order: index,
        }));
        
        if (compositionAssetRecords.length > 0) {
          await models.CompositionAsset.bulkCreate(compositionAssetRecords);
        }
      }

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
      const composition = await models.ThumbnailComposition.findByPk(compositionId, {
        include: [
          {
            model: models.Episode,
            as: 'episode',
            required: false,
          },
          {
            model: models.CompositionOutput,
            as: 'outputs',
            required: false,
          },
        ],
      });

      if (!composition) {
        throw new Error('Composition not found');
      }

      const json = composition.toJSON();
      
      // Get composition assets from junction table
      const compositionAssets = await models.CompositionAsset.findAll({
        where: { composition_id: compositionId },
        include: [
          {
            model: models.Asset,
            as: 'asset',
          },
        ],
      });

      // Add assets to the response
      json.composition_assets = compositionAssets.map((ca) => ca.toJSON());

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
      // episodeId can be the UUID - compositions table uses UUID for episode_id
      const compositions = await models.ThumbnailComposition.findAll({
        where: { episode_id: episodeId },
        include: [
          { model: models.ThumbnailTemplate, as: 'template' },
          {
            model: models.CompositionAsset,
            as: 'compositionAssets',
            include: [{ model: models.Asset, as: 'asset' }],
          },
        ],
        order: [
          ['is_primary', 'DESC'],
          ['created_at', 'DESC'],
        ],
      });

      return compositions.map((c) => {
        const json = c.toJSON();
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
      const composition = await models.ThumbnailComposition.findByPk(compositionId, {
        include: [
          {
            model: models.CompositionOutput,
            as: 'outputs',
            where: { status: 'READY' },
            required: false,
            order: [['created_at', 'ASC']],
          },
          {
            model: models.Episode,
            as: 'episode',
          },
        ],
      });

      if (!composition) {
        throw new Error('Composition not found');
      }

      // Unset other compositions for this episode
      await models.ThumbnailComposition.update(
        { is_primary: false },
        {
          where: {
            episode_id: composition.episode_id,
            id: { [require('sequelize').Op.ne]: compositionId },
          },
        }
      );

      // Set this one as primary
      await composition.update({ is_primary: true });

      // Update episode's thumbnail_url with the first READY output
      if (composition.outputs && composition.outputs.length > 0) {
        const primaryOutput = composition.outputs[0];
        if (composition.episode) {
          await composition.models.Episode.update({
            thumbnail_url: primaryOutput.image_url,
          });
          console.log(`✅ Updated episode ${composition.episode_id} thumbnail_url to ${primaryOutput.image_url}`);
        }
      } else {
        console.log(`⚠️ No READY outputs available for composition ${compositionId}, episode thumbnail not updated`);
      }

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
      const composition = await models.ThumbnailComposition.findByPk(compositionId);
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
      const composition = await models.ThumbnailComposition.findByPk(compositionId);
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
      return await models.ThumbnailTemplate.findAll({
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
      const template = await models.ThumbnailTemplate.findByPk(templateId);
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
      const composition = await models.ThumbnailComposition.findByPk(compositionId, {
        attributes: ['id', 'episode_id', 'template_id', 'template_studio_id', 'composition_config'],
      });

      if (!composition) {
        throw new Error('Composition not found');
      }

      // Check if using Template Studio template
      if (composition.template_studio_id) {
        console.log('🎨 Using Template Studio renderer');
        return await this.generateThumbnailsFromTemplateStudio(composition, selectedFormats);
      }

      // Legacy generator for old templates
      console.log('⚠️  Using legacy thumbnail generator');

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
        { name: 'PINTEREST', width: 1000, height: 1500 },
      ];

      // Filter to only selected formats
      const formatsToGenerate = allFormats.filter((f) => selectedFormats.includes(f.name));

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
   * Generate thumbnails using Template Studio template
   * NEW: Uses template_studio table for pixel-perfect layouts
   */
  async generateThumbnailsFromTemplateStudio(composition, selectedFormats) {
    try {
      console.log(`🎨 Generating thumbnails from Template Studio for composition ${composition.id}`);

      const ThumbnailGeneratorService = require('./ThumbnailGeneratorService');
      const thumbnails = [];

      // Define all available formats
      const allFormats = [
        { name: 'YOUTUBE', width: 1920, height: 1080 },
        { name: 'YOUTUBE_MOBILE', width: 1280, height: 720 },
        { name: 'INSTAGRAM_FEED', width: 1080, height: 1080 },
        { name: 'INSTAGRAM_STORY', width: 1080, height: 1920 },
        { name: 'TIKTOK', width: 1080, height: 1920 },
        { name: 'FACEBOOK', width: 1200, height: 630 },
        { name: 'TWITTER', width: 1200, height: 675 },
        { name: 'PINTEREST', width: 1000, height: 1500 },
      ];

      // Filter to only selected formats
      const formatsToGenerate = allFormats.filter((f) => selectedFormats.includes(f.name));

      for (const format of formatsToGenerate) {
        try {
          console.log(`  📐 Generating ${format.name} (${format.width}×${format.height})...`);
          
          const thumbnailBuffer = await ThumbnailGeneratorService.generateFromTemplateStudio(
            composition, 
            format
          );

          if (thumbnailBuffer) {
            // Save to S3 or local storage
            const s3Key = `thumbnails/${composition.id}/${format.name.toLowerCase()}.png`;
            
            // TODO: Upload to S3 in production
            // For now, just return the buffer
            
            thumbnails.push({
              format: format.name,
              width: format.width,
              height: format.height,
              buffer: thumbnailBuffer,
              size: thumbnailBuffer.length,
              s3_key: s3Key
            });

            console.log(`  ✅ ${format.name} complete (${thumbnailBuffer.length} bytes)`);
          } else {
            console.warn(`  ⚠️  ${format.name} returned null`);
          }
        } catch (formatErr) {
          console.error(`  ❌ Failed to generate ${format.name}:`, formatErr.message);
          // Continue with next format
        }
      }

      console.log(`✅ Generated ${thumbnails.length} thumbnails using Template Studio`);
      return thumbnails;

    } catch (error) {
      console.error('❌ Failed to generate thumbnails from Template Studio:', error);
      throw error;
    }
  }

  /**
   * Update composition assets and regenerate thumbnails
   */
  async updateComposition(compositionId, updateData) {
    try {
      const composition = await models.ThumbnailComposition.findByPk(compositionId);
      if (!composition) {
        throw new Error('Composition not found');
      }

      // Update template if provided (accept both template_id and template_studio_id)
      if (updateData.template_studio_id !== undefined) {
        composition.template_id = updateData.template_studio_id;
      }
      if (updateData.template_id !== undefined) {
        composition.template_id = updateData.template_id;
      }

      // Update assets
      const { lala_asset_id, guest_asset_id, justawomen_asset_id, include_justawomaninherprime } =
        updateData;

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

  /**
   * Validate composition configuration
   * @private
   */
  async _validateCompositionConfig(config, template, assets, episodeId) {
    const errors = [];

    // Validate required text fields
    const textRoles = getTextRoles();
    for (const role of textRoles) {
      const meta = getRoleMetadata(role);
      if (meta.required && !config.text_fields?.[role]) {
        errors.push(`Required text field missing: ${meta.label}`);
      }
    }

    // Validate guest metadata if guest roles are enabled
    const guestRoles = ['CHAR.GUEST.1', 'CHAR.GUEST.2'];
    for (const role of guestRoles) {
      if (config.visibility?.[role] === true) {
        // Check if episode has guest metadata
        const episode = await models.Episode.findByPk(episodeId);
        if (!episode) {
          errors.push('Episode not found');
          continue;
        }

        // Extract guest metadata from episode
        const guestData = models.Episode.metadata?.guests || models.Episode.guest_name;
        if (!guestData) {
          errors.push(`${role} enabled but episode missing guest metadata`);
        }
      }
    }

    // Validate icon holder requirement
    if (shouldRequireIconHolder(config.visibility)) {
      if (!assets || !assets['UI.ICON.HOLDER.MAIN']) {
        errors.push('Icon holder asset required when icons are enabled');
      }
    }

    // Validate all enabled roles have assets
    if (config.visibility) {
      for (const [role, visible] of Object.entries(config.visibility)) {
        if (visible && !getRoleMetadata(role)?.is_text_field) {
          if (!assets || !assets[role]) {
            const meta = getRoleMetadata(role);
            errors.push(`Asset required for enabled role: ${meta?.label || role}`);
          }
        }
      }
    }

    return errors;
  }
}

module.exports = new CompositionService();
