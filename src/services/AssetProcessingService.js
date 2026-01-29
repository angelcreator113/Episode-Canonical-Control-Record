const axios = require('axios');
const AWS = require('aws-sdk');
const sharp = require('sharp');
const { logger } = require('../middleware/auditLog');

const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * AssetProcessingService
 * Handles background removal, image enhancement, and asset processing
 * for Template Studio compositions
 */
class AssetProcessingService {
  /**
   * Process an asset with specified transformations
   * @param {string} assetUrl - S3 URL of the original asset
   * @param {object} options - Processing options
   * @returns {Promise<object>} Processed asset details
   */
  async processAsset(assetUrl, options = {}) {
    const {
      removeBackground = false,
      smoothSkin = false,
      autoEnhance = false,
      provider = 'runway', // 'runway' or 'removebg'
    } = options;

    try {
      let processedUrl = assetUrl;
      const processingSteps = [];

      // Step 1: Remove background if requested
      if (removeBackground) {
        processedUrl = await this.removeBackground(processedUrl, provider);
        processingSteps.push('background_removed');
      }

      // Step 2: Smooth skin if requested
      if (smoothSkin) {
        processedUrl = await this.smoothSkin(processedUrl);
        processingSteps.push('skin_smoothed');
      }

      // Step 3: Auto enhance if requested
      if (autoEnhance) {
        processedUrl = await this.autoEnhance(processedUrl);
        processingSteps.push('auto_enhanced');
      }

      return {
        originalUrl: assetUrl,
        processedUrl,
        processingSteps,
        provider,
      };
    } catch (error) {
      logger.error('Asset processing failed', { error: error.message, assetUrl });
      throw error;
    }
  }

  /**
   * Remove background from image
   * @param {string} assetUrl - S3 URL of the image
   * @param {string} provider - 'runway' or 'removebg'
   * @returns {Promise<string>} URL of processed image
   */
  async removeBackground(assetUrl, provider = 'runway') {
    if (provider === 'runway') {
      return await this.runwayRemoveBackground(assetUrl);
    } else if (provider === 'removebg') {
      return await this.removeBgRemoveBackground(assetUrl);
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Remove background using Runway ML API
   * @param {string} assetUrl - Image URL
   * @returns {Promise<string>} Processed image URL
   */
  async runwayRemoveBackground(assetUrl) {
    try {
      if (!process.env.RUNWAY_API_KEY) {
        throw new Error('RUNWAY_API_KEY not configured');
      }

      const response = await axios.post(
        'https://api.runwayml.com/v1/remove-background',
        {
          image_url: assetUrl,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.RUNWAY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      return response.data.output_url;
    } catch (error) {
      logger.error('Runway background removal failed', { error: error.message });
      throw new Error(`Runway processing failed: ${error.message}`);
    }
  }

  /**
   * Remove background using Remove.bg API
   * @param {string} assetUrl - Image URL
   * @returns {Promise<string>} S3 URL of processed image
   */
  async removeBgRemoveBackground(assetUrl) {
    try {
      if (!process.env.REMOVEBG_API_KEY) {
        throw new Error('REMOVEBG_API_KEY not configured');
      }

      const response = await axios.post(
        'https://api.remove.bg/v1.0/removebg',
        {
          image_url: assetUrl,
          size: 'auto',
          format: 'png',
        },
        {
          headers: {
            'X-Api-Key': process.env.REMOVEBG_API_KEY,
          },
          responseType: 'arraybuffer',
          timeout: 30000,
        }
      );

      // Upload processed image to S3
      const buffer = Buffer.from(response.data);
      const key = `processed-assets/removebg/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;

      await s3
        .putObject({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: 'image/png',
          ACL: 'public-read',
        })
        .promise();

      return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    } catch (error) {
      logger.error('Remove.bg processing failed', { error: error.message });
      throw new Error(`Remove.bg processing failed: ${error.message}`);
    }
  }

  /**
   * Smooth skin using image processing
   * @param {string} assetUrl - Image URL
   * @returns {Promise<string>} S3 URL of processed image
   */
  async smoothSkin(assetUrl) {
    try {
      // Download image
      const imageResponse = await axios.get(assetUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);

      // Apply skin smoothing using Sharp
      const processedBuffer = await sharp(imageBuffer)
        .modulate({
          brightness: 1.05,
          saturation: 0.95,
        })
        .blur(0.5) // Gentle blur for smoothing
        .sharpen(0.5) // Re-sharpen to maintain detail
        .toBuffer();

      // Upload to S3
      const key = `processed-assets/smoothed/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;

      await s3
        .putObject({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: processedBuffer,
          ContentType: 'image/png',
          ACL: 'public-read',
        })
        .promise();

      return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    } catch (error) {
      logger.error('Skin smoothing failed', { error: error.message });
      throw new Error(`Skin smoothing failed: ${error.message}`);
    }
  }

  /**
   * Auto enhance image (brightness, contrast, saturation)
   * @param {string} assetUrl - Image URL
   * @returns {Promise<string>} S3 URL of enhanced image
   */
  async autoEnhance(assetUrl) {
    try {
      // Download image
      const imageResponse = await axios.get(assetUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);

      // Auto enhance using Sharp
      const processedBuffer = await sharp(imageBuffer)
        .normalize() // Auto adjust brightness/contrast
        .modulate({
          brightness: 1.1,
          saturation: 1.15,
        })
        .sharpen()
        .toBuffer();

      // Upload to S3
      const key = `processed-assets/enhanced/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.png`;

      await s3
        .putObject({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: processedBuffer,
          ContentType: 'image/png',
          ACL: 'public-read',
        })
        .promise();

      return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    } catch (error) {
      logger.error('Auto enhance failed', { error: error.message });
      throw new Error(`Auto enhance failed: ${error.message}`);
    }
  }

  /**
   * Save processed asset to Template Studio storage with caching
   * @param {string} templateId - Template ID
   * @param {string} assetId - Asset ID
   * @param {Buffer|string} processedImage - Image buffer or URL
   * @param {string} processingType - Type of processing (bg-removed, smoothed, etc.)
   * @returns {Promise<string>} S3 URL of saved asset
   */
  async saveProcessedAsset(templateId, assetId, processedImage, processingType) {
    try {
      const key = `template-studio-assets/${templateId}/${assetId}/${processingType}.png`;

      let body;
      if (Buffer.isBuffer(processedImage)) {
        body = processedImage;
      } else if (typeof processedImage === 'string') {
        // Download from URL
        const response = await axios.get(processedImage, { responseType: 'arraybuffer' });
        body = Buffer.from(response.data);
      } else {
        throw new Error('Invalid processedImage type');
      }

      await s3
        .putObject({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: body,
          ContentType: 'image/png',
          ACL: 'public-read',
          Metadata: {
            templateId: String(templateId),
            assetId: String(assetId),
            processingType,
            processedAt: new Date().toISOString(),
          },
        })
        .promise();

      return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    } catch (error) {
      logger.error('Failed to save processed asset', {
        error: error.message,
        templateId,
        assetId,
        processingType,
      });
      throw error;
    }
  }

  /**
   * Check if processed asset exists in S3 cache
   * @param {string} templateId - Template ID
   * @param {string} assetId - Asset ID
   * @param {string} processingType - Type of processing
   * @returns {Promise<string|null>} URL if cached, null otherwise
   */
  async checkCache(templateId, assetId, processingType) {
    try {
      const key = `template-studio-assets/${templateId}/${assetId}/${processingType}.png`;

      await s3
        .headObject({
          Bucket: process.env.S3_BUCKET,
          Key: key,
        })
        .promise();

      // If headObject succeeds, the file exists
      return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    } catch (error) {
      if (error.code === 'NotFound') {
        return null;
      }
      throw error;
    }
  }
}

module.exports = new AssetProcessingService();
