/**
 * CompositionService
 * Handles thumbnail composition generation
 */

const { models } = require('../models');
const _AssetService = require('./AssetService');
const s3Service = require('./S3Service');
const { v4: _uuidv4 } = require('uuid');

class CompositionService {
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
          console.log(
            `✅ Updated episode ${composition.episode_id} thumbnail_url to ${primaryOutput.image_url}`
          );
        }
      } else {
        console.log(
          `⚠️ No READY outputs available for composition ${compositionId}, episode thumbnail not updated`
        );
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
      console.log(
        `🎨 Generating thumbnails from Template Studio for composition ${composition.id}`
      );

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

            // Upload to S3 if configured
            let s3Url = null;
            const bucket = process.env.AWS_S3_BUCKET || 'episode-metadata-assets';
            if (process.env.AWS_ACCESS_KEY_ID) {
              try {
                const s3Result = await s3Service.uploadFile(bucket, s3Key, thumbnailBuffer, { ContentType: 'image/png' });
                s3Url = s3Result.Location || `https://${bucket}.s3.amazonaws.com/${s3Key}`;
              } catch (s3Err) {
                console.warn(`  ⚠️  S3 upload failed for ${format.name}:`, s3Err.message);
              }
            }

            thumbnails.push({
              format: format.name,
              width: format.width,
              height: format.height,
              buffer: thumbnailBuffer,
              size: thumbnailBuffer.length,
              s3_key: s3Key,
              s3_url: s3Url,
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
}

module.exports = new CompositionService();
