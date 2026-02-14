/**
 * Enhanced Thumbnail Generator Service
 * 
 * Role-based thumbnail generation using templates and Sharp image processing.
 * Generates thumbnails for multiple social media formats from composition assets.
 */

const sharp = require('sharp');
const { ThumbnailTemplate, CompositionAsset, Asset, ThumbnailComposition } = require('../models');
const AssetRoleService = require('./AssetRoleService');
const AWS = require('aws-sdk');
const axios = require('axios');

const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1'
});

/**
 * Social media format specifications
 */
const FORMATS = {
  YOUTUBE: { width: 1920, height: 1080, name: 'YouTube' },
  INSTAGRAM_FEED: { width: 1080, height: 1080, name: 'Instagram Feed' },
  INSTAGRAM_STORY: { width: 1080, height: 1920, name: 'Instagram Story' },
  FACEBOOK: { width: 1200, height: 630, name: 'Facebook' },
  TWITTER: { width: 1200, height: 675, name: 'Twitter' }
};

class ThumbnailGeneratorServiceEnhanced {
  /**
   * Generate thumbnails for a composition using its template
   * @param {string} compositionId - Composition UUID
   * @param {Array} selectedFormats - Array of format names to generate (defaults to all)
   * @returns {Promise<Object>} { success: boolean, generatedFormats: {...}, errors: [] }
   */
  static async generateForComposition(compositionId, selectedFormats = Object.keys(FORMATS)) {
    let composition;
    try {
      // Load composition with template and assets
      composition = await ThumbnailComposition.findByPk(compositionId, {
        include: [
          {
            model: ThumbnailTemplate,
            as: 'template'
          },
          {
            model: CompositionAsset,
            as: 'compositionAssets',
            include: [
              {
                model: Asset,
                as: 'asset'
              }
            ]
          }
        ]
      });

      if (!composition) {
        throw new Error('Composition not found');
      }

      if (!composition.template) {
        throw new Error('Template not found for composition');
      }

      // Update status to generating
      await composition.update({ generation_status: 'GENERATING' });

      // Validate composition
      const validation = composition.template.validateComposition(
        composition.compositionAssets.map(ca => ({
          asset_role: ca.asset_role,
          asset_id: ca.asset_id
        }))
      );

      if (!validation.valid) {
        await composition.update({
          generation_status: 'FAILED',
          validation_errors: validation.errors
        });
        throw new Error(`Composition validation failed: ${validation.errors.join(', ')}`);
      }

      // Store warnings
      if (validation.warnings.length > 0) {
        await composition.update({ validation_warnings: validation.warnings });
      }

      // Generate thumbnails for each format
      const generatedFormats = {};
      const errors = [];

      for (const format of selectedFormats) {
        if (!FORMATS[format]) {
          errors.push(`Unknown format: ${format}`);
          continue;
        }

        try {
          const url = await this.generateFormat(composition, format);
          generatedFormats[format] = url;
        } catch (error) {
          console.error(`Error generating ${format}:`, error);
          errors.push(`${format}: ${error.message}`);
        }
      }

      // Update composition with results
      await composition.update({
        generation_status: errors.length === selectedFormats.length ? 'FAILED' : 'COMPLETED',
        generated_formats: generatedFormats,
        validation_errors: errors.length > 0 ? errors : null
      });

      return {
        success: Object.keys(generatedFormats).length > 0,
        generatedFormats,
        errors,
        warnings: validation.warnings
      };

    } catch (error) {
      console.error('Error generating thumbnails:', error);
      
      if (composition) {
        await composition.update({
          generation_status: 'FAILED',
          validation_errors: [error.message]
        });
      }

      throw error;
    }
  }

  /**
   * Generate a single format thumbnail
   * @param {Object} composition - ThumbnailComposition instance
   * @param {string} format - Format name (YOUTUBE, INSTAGRAM_FEED, etc.)
   * @returns {Promise<string>} S3 URL of generated thumbnail
   */
  static async generateFormat(composition, format) {
    const template = composition.template;
    const formatSpec = FORMATS[format];
    
    // Get format-specific layout or use base layout
    const layout = template.getLayoutForFormat(format);
    const { baseWidth, baseHeight } = layout;

    // Create base canvas
    const canvas = sharp({
      create: {
        width: formatSpec.width,
        height: formatSpec.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    // Build layer composites
    const composites = [];

    // Sort composition assets by layer order
    const sortedAssets = composition.compositionAssets.sort((a, b) => a.layer_order - b.layer_order);

    for (const compAsset of sortedAssets) {
      const asset = compAsset.asset;
      const roleLayout = layout.layers[compAsset.asset_role];

      if (!roleLayout) {
        console.warn(`No layout defined for role: ${compAsset.asset_role}`);
        continue;
      }

      // Apply custom config overrides
      const effectiveConfig = compAsset.getEffectiveConfig(roleLayout);

      // Download asset if needed
      let assetBuffer;
      try {
        assetBuffer = await this.downloadAsset(asset.s3_url_processed || asset.s3_url_raw);
      } catch (error) {
        console.error(`Failed to download asset ${asset.asset_id}:`, error);
        continue;
      }

      // Process asset for composition
      const processedBuffer = await this.processAssetForLayer(
        assetBuffer,
        effectiveConfig,
        formatSpec,
        { baseWidth, baseHeight }
      );

      composites.push({
        input: processedBuffer,
        top: effectiveConfig.y,
        left: effectiveConfig.x
      });
    }

    // Add text layers
    for (const textLayerDef of template.text_layers || []) {
      // TODO: Implement text rendering using SVG or external text library
      // For now, skip text layers (requires additional setup)
      console.warn('Text layers not yet implemented');
    }

    // Composite layers
    const outputBuffer = await canvas
      .composite(composites)
      .png({ quality: 95 })
      .toBuffer();

    // Upload to S3
    const s3Key = `thumbnails/${composition.episode_id}/${composition.composition_id}/${format.toLowerCase()}.png`;
    const s3Params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: outputBuffer,
      ContentType: 'image/png',
      ACL: 'public-read'
    };

    await s3.upload(s3Params).promise();
    
    const s3Url = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    return s3Url;
  }

  /**
   * Process asset for layering
   * @param {Buffer} assetBuffer - Raw asset buffer
   * @param {Object} config - Layer configuration
   * @param {Object} formatSpec - Target format specs
   * @param {Object} baseSize - Base canvas size
   * @returns {Promise<Buffer>}
   */
  static async processAssetForLayer(assetBuffer, config, formatSpec, baseSize) {
    const { x, y, width, height, rotation, opacity } = config;
    const { baseWidth, baseHeight } = baseSize;

    // Scale positions and sizes from base to target format
    const scaleX = formatSpec.width / baseWidth;
    const scaleY = formatSpec.height / baseHeight;

    const targetWidth = Math.round(width * scaleX);
    const targetHeight = Math.round(height * scaleY);

    let processor = sharp(assetBuffer)
      .resize(targetWidth, targetHeight, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      });

    if (rotation) {
      processor = processor.rotate(rotation, {
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      });
    }

    if (opacity !== undefined && opacity < 1) {
      processor = processor.composite([{
        input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: 'dest-in'
      }]);
    }

    return await processor.png().toBuffer();
  }

  /**
   * Download asset from S3 URL
   * @param {string} s3Url - S3 URL
   * @returns {Promise<Buffer>}
   */
  static async downloadAsset(s3Url) {
    try {
      const response = await axios.get(s3Url, {
        responseType: 'arraybuffer'
      });
      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading asset:', error);
      throw new Error(`Failed to download asset: ${error.message}`);
    }
  }

  /**
   * Preview template layout without generating
   * @param {string} templateId - Template UUID
   * @param {string} format - Format name
   * @returns {Promise<Object>} Layout preview data
   */
  static async previewTemplateLayout(templateId, format = 'YOUTUBE') {
    try {
      const template = await ThumbnailTemplate.findByPk(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      const layout = template.getLayoutForFormat(format);
      const formatSpec = FORMATS[format];

      return {
        format: formatSpec,
        layout,
        requiredRoles: template.required_roles,
        optionalRoles: template.optional_roles
      };
    } catch (error) {
      console.error('Error previewing template:', error);
      throw error;
    }
  }

  /**
   * Get generation progress
   * @param {string} compositionId - Composition UUID
   * @returns {Promise<Object>}
   */
  static async getGenerationStatus(compositionId) {
    try {
      const composition = await ThumbnailComposition.findByPk(compositionId, {
        attributes: [
          'composition_id',
          'generation_status',
          'validation_errors',
          'validation_warnings',
          'generated_formats'
        ]
      });

      if (!composition) {
        throw new Error('Composition not found');
      }

      return {
        status: composition.generation_status,
        errors: composition.validation_errors,
        warnings: composition.validation_warnings,
        generatedFormats: composition.generated_formats
          ? Object.keys(composition.generated_formats)
          : []
      };
    } catch (error) {
      console.error('Error getting generation status:', error);
      throw error;
    }
  }

  /**
   * Regenerate failed thumbnails
   * @param {string} compositionId - Composition UUID
   * @returns {Promise<Object>}
   */
  static async regenerate(compositionId) {
    try {
      const composition = await ThumbnailComposition.findByPk(compositionId);
      if (!composition) {
        throw new Error('Composition not found');
      }

      // Reset status
      await composition.update({
        generation_status: 'DRAFT',
        validation_errors: null,
        validation_warnings: null
      });

      // Regenerate all selected formats
      return await this.generateForComposition(
        compositionId,
        composition.selected_formats || Object.keys(FORMATS)
      );
    } catch (error) {
      console.error('Error regenerating thumbnails:', error);
      throw error;
    }
  }
}

module.exports = ThumbnailGeneratorServiceEnhanced;
