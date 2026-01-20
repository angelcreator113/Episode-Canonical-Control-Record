/**
 * AssetService
 * Handles asset management, validation, and S3 operations
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { fromIni, fromEnv } = require('@aws-sdk/credential-providers');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { models } = require('../models');
const { Asset, AssetLabel, AssetUsage } = models;

// Configure AWS SDK v3 with credential chain
let s3Client = null;
const getS3Client = async () => {
  if (!s3Client) {
    const credentials = process.env.AWS_PROFILE
      ? await fromIni({ profile: process.env.AWS_PROFILE })()
      : await fromEnv()();

    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials,
    });
  }
  return s3Client;
};

const BUCKET_NAME =
  process.env.AWS_S3_BUCKET || process.env.S3_ASSET_BUCKET || 'episode-metadata-assets-dev';

class AssetService {
  /**
   * Upload asset to S3 and create database record
   * @param {Object} file - Multer file object
   * @param {String} assetType - Asset type enum
   * @param {Object} metadata - Additional metadata
   * @param {String} uploadedBy - User ID
   * @returns {Object} Created asset with URLs
   */
  async uploadAsset(file, assetType, metadata, uploadedBy) {
    try {
      // Validate asset type
      const validTypes = [
        'PROMO_LALA',
        'PROMO_JUSTAWOMANINHERPRIME',
        'PROMO_GUEST',
        'BRAND_LOGO',
        'EPISODE_FRAME',
        'PROMO_VIDEO',
        'EPISODE_VIDEO',
        'BACKGROUND_VIDEO',
      ];

      if (!validTypes.includes(assetType)) {
        throw new Error(`Invalid asset type. Must be one of: ${validTypes.join(', ')}`);
      }

      const assetId = uuidv4();
      const timestamp = Date.now();

      // Determine S3 path based on asset type
      const folderMap = {
        PROMO_LALA: 'promotional/lala/raw',
        PROMO_JUSTAWOMANINHERPRIME: 'promotional/justawomaninherprime/raw',
        PROMO_GUEST: 'promotional/guests/raw',
        BRAND_LOGO: 'promotional/brands',
        EPISODE_FRAME: 'thumbnails/auto',
        PROMO_VIDEO: 'promotional/videos',
        EPISODE_VIDEO: 'episodes/videos',
        BACKGROUND_VIDEO: 'backgrounds/videos',
      };

      const folder = folderMap[assetType];
      const fileExtension = this._getFileExtension(file.mimetype);
      const s3Key = `${folder}/${timestamp}-${assetId}${fileExtension}`;

      // Determine if this is a video file
      const isVideo = file.mimetype.startsWith('video/');
      const mediaType = isVideo ? 'video' : 'image';

      // Generate thumbnail (max 150px) - only for images
      let thumbnailBuffer = null;
      let thumbnailKey = null;
      let imageDimensions = null;

      if (!isVideo) {
        try {
          // Get image dimensions and generate thumbnail
          const imageInfo = await sharp(file.buffer).metadata();
          imageDimensions = {
            width: imageInfo.width,
            height: imageInfo.height,
          };

          thumbnailBuffer = await sharp(file.buffer)
            .resize(150, 150, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .jpeg({ quality: 80 })
            .toBuffer();

          thumbnailKey = `${folder}/thumbnails/${timestamp}-${assetId}-thumb.jpg`;
        } catch (thumbError) {
          console.warn(`⚠️ Thumbnail generation failed: ${thumbError.message}`);
          // Continue without thumbnail
        }
      } else {
        console.log('📹 Video file detected, skipping thumbnail generation');
      }

      // Upload to S3 using AWS SDK v3
      let s3Url = null;
      let thumbnailUrl = null;

      try {
        console.log(`📤 Uploading to S3: ${s3Key}`);
        const client = await getS3Client();

        // Upload original file
        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
          Metadata: {
            assetType: assetType,
            assetId: assetId,
            uploadedAt: new Date().toISOString(),
          },
        });
        await client.send(command);

        s3Url = `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
        console.log(`✅ S3 upload successful: ${s3Key}`);

        // Upload thumbnail if generated
        if (thumbnailBuffer && thumbnailKey) {
          const thumbCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: thumbnailKey,
            Body: thumbnailBuffer,
            ContentType: 'image/jpeg',
            Metadata: {
              assetType: assetType,
              assetId: assetId,
              isThumbnail: 'true',
            },
          });
          await client.send(thumbCommand);
          thumbnailUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${thumbnailKey}`;
          console.log(`✅ Thumbnail uploaded: ${thumbnailKey}`);
        }
      } catch (s3Error) {
        console.warn(`⚠️ S3 upload failed: ${s3Error.message}`);
        // Use mock URLs for development
        s3Url = `https://mock-s3.dev/${s3Key}`;
        thumbnailUrl = this._generateThumbnailDataUri();
      }

      // Fallback thumbnail if not generated
      if (!thumbnailUrl) {
        thumbnailUrl = this._generateThumbnailDataUri();
      }

      // Create database record with new schema
      const asset = await Asset.create({
        id: assetId,
        name: file.originalname || `${assetType}-${timestamp}`,
        asset_type: assetType,
        approval_status: 'APPROVED', // Auto-approve for now

        // Media type field
        media_type: mediaType,

        // Raw image fields
        s3_key_raw: s3Key,
        s3_url_raw: s3Url,
        file_size_bytes: file.size,

        // Dimensions (for images)
        width: imageDimensions?.width || null,
        height: imageDimensions?.height || null,

        // Legacy fields (for backward compatibility)
        s3_key: s3Key,
        url: s3Url,

        // Description (optional)
        description: metadata?.description || null,

        // Metadata
        metadata: {
          ...metadata,
          content_type: file.mimetype,
          uploaded_by: uploadedBy,
          uploaded_at: new Date().toISOString(),
          thumbnail_url: thumbnailUrl,
          thumbnail_key: thumbnailKey,
          original_filename: file.originalname,
        },
      });

      console.log(`✅ Asset created in database: ${assetId}`);

      return {
        ...asset.toJSON(),
        s3_url: s3Url,
        thumbnail: thumbnailUrl,
      };
    } catch (error) {
      console.error('❌ Asset upload failed:', error);
      throw error;
    }
  }

  /**
   * Get all approved assets of a type
   * @param {String} assetType - Asset type to filter by
   * @returns {Array} List of approved assets
   */
  async getApprovedAssets(assetType = null) {
    try {
      const where = {
        approval_status: 'APPROVED',
      };

      if (assetType) {
        where.asset_type = assetType;
      }

      const assets = await Asset.findAll({
        where,
        order: [['created_at', 'DESC']],
        raw: false,
      });

      console.log(
        `✅ AssetService: Found ${assets.length} approved assets (type: ${assetType || 'all'})`
      );

      return assets.map((asset) => this._formatAssetForFrontend(asset));
    } catch (error) {
      // If table doesn't exist (common in development), return empty array
      if (
        error.message &&
        error.message.includes('relation') &&
        error.message.includes('does not exist')
      ) {
        console.warn('⚠️ Assets table does not exist yet, returning empty array');
        return [];
      }
      console.error('❌ AssetService.getApprovedAssets error:', error);
      throw error;
    }
  }

  /**
   * Get asset by ID
   * @param {String} assetId - Asset UUID
   * @returns {Object} Asset details
   */
  async getAsset(assetId) {
    try {
      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      return {
        ...asset.toJSON(),
        s3_url:
          asset.s3_url_raw || asset.url || this._generateS3Url(asset.s3_key_raw || asset.s3_key),
        thumbnail: asset.metadata?.thumbnail_url || asset.s3_url_raw || asset.url,
      };
    } catch (error) {
      console.error('Failed to get asset:', error);
      throw error;
    }
  }

  /**
   * Approve asset
   * @param {String} assetId - Asset UUID
   * @param {String} approvedBy - User ID
   * @returns {Object} Updated asset
   */
  async approveAsset(assetId, approvedBy) {
    try {
      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      const metadata = asset.metadata || {};
      metadata.approved_by = approvedBy;
      metadata.approved_at = new Date().toISOString();

      await asset.update({
        approval_status: 'APPROVED',
        processed_at: new Date(),
        metadata,
        updated_at: new Date(),
      });

      console.log(`✅ Asset approved: ${assetId}`);
      return asset.toJSON();
    } catch (error) {
      console.error('Failed to approve asset:', error);
      throw error;
    }
  }

  /**
   * Reject asset
   * @param {String} assetId - Asset UUID
   * @param {String} reason - Rejection reason
   * @returns {Object} Updated asset
   */
  async rejectAsset(assetId, reason) {
    try {
      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      const metadata = asset.metadata || {};
      metadata.rejected_at = new Date().toISOString();
      metadata.rejection_reason = reason;

      await asset.update({
        approval_status: 'REJECTED',
        processing_error: reason,
        metadata,
        updated_at: new Date(),
      });

      console.log(`✅ Asset rejected: ${assetId}`);
      return asset.toJSON();
    } catch (error) {
      console.error('Failed to reject asset:', error);
      throw error;
    }
  }

  /**
   * List pending assets for approval
   * @returns {Array} List of pending assets
   */
  async getPendingAssets() {
    try {
      const assets = await Asset.findAll({
        where: {
          approval_status: 'PENDING',
        },
        order: [['created_at', 'ASC']],
        raw: true,
      });

      return assets.map((asset) => this._formatAssetForFrontend(asset));
    } catch (error) {
      console.error('Failed to get pending assets:', error);
      throw error;
    }
  }

  /**
   * Process asset with background removal
   * @param {String} assetId - Asset UUID
   * @returns {Object} Updated asset
   */
  async processAssetBackgroundRemoval(assetId) {
    try {
      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      // Check if already processed
      if (asset.s3_url_processed) {
        console.log(`⚠️ Asset ${assetId} already has processed version`);
        return asset.toJSON();
      }

      console.log(`🎨 Processing background removal for ${assetId}`);

      // Download the image from S3
      const getCommand = new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: asset.s3_key_raw,
      });
      
      const response = await this.s3.send(getCommand);
      const imageBuffer = await this.streamToBuffer(response.Body);

      // Call RunwayML API for background removal
      const runwayApiKey = process.env.RUNWAY_ML_API_KEY;
      if (!runwayApiKey) {
        throw new Error('RUNWAY_ML_API_KEY not configured');
      }

      const FormData = require('form-data');
      const axios = require('axios');
      
      const formData = new FormData();
      formData.append('image', imageBuffer, {
        filename: asset.file_name,
        contentType: asset.content_type,
      });

      console.log(`📤 Sending to RunwayML API...`);
      const runwayResponse = await axios.post(
        'https://api.runwayml.com/v1/remove-background',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${runwayApiKey}`,
          },
          responseType: 'arraybuffer',
          timeout: 30000, // 30 second timeout
        }
      );

      // Upload processed image to S3
      const processedKey = asset.s3_key_raw.replace('/raw/', '/processed/');
      const putCommand = new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: processedKey,
        Body: Buffer.from(runwayResponse.data),
        ContentType: 'image/png', // RunwayML returns PNG
      });

      await this.s3.send(putCommand);
      const processedUrl = `https://${this.s3Bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${processedKey}`;

      await asset.update({
        s3_key_processed: processedKey,
        s3_url_processed: processedUrl,
        approval_status: 'APPROVED',
        processed_at: new Date(),
        updated_at: new Date(),
      });

      console.log(`✅ Asset processed: ${assetId}`);
      return asset.toJSON();
    } catch (error) {
      console.error('Failed to process asset:', error);
      
      // If RunwayML fails, still mark as processed but log the error
      if (error.response) {
        console.error('RunwayML API error:', error.response.status, error.response.data);
      }
      
      throw error;
    }
  }

  /**
   * Helper to convert stream to buffer
   */
  async streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  // ==================== LABEL MANAGEMENT ====================

  /**
   * Get all labels
   * @returns {Array} List of all labels
   */
  async getAllLabels() {
    try {
      const labels = await AssetLabel.findAll({
        order: [['name', 'ASC']],
      });
      return labels.map(l => l.toJSON());
    } catch (error) {
      console.error('Failed to get labels:', error);
      throw error;
    }
  }

  /**
   * Create new label
   * @param {String} name - Label name
   * @param {String} color - Hex color code
   * @param {String} description - Optional description
   * @returns {Object} Created label
   */
  async createLabel(name, color = '#6366f1', description = null) {
    try {
      const label = await AssetLabel.create({
        name,
        color,
        description,
      });
      console.log(`✅ Label created: ${name}`);
      return label.toJSON();
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new Error(`Label "${name}" already exists`);
      }
      console.error('Failed to create label:', error);
      throw error;
    }
  }

  /**
   * Add labels to asset
   * @param {String} assetId - Asset UUID
   * @param {Array} labelIds - Array of label UUIDs
   * @returns {Object} Updated asset with labels
   */
  async addLabelsToAsset(assetId, labelIds) {
    try {
      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      // Verify labels exist
      const labels = await AssetLabel.findAll({
        where: { id: labelIds },
      });

      if (labels.length !== labelIds.length) {
        throw new Error('Some labels not found');
      }

      // Add labels to asset
      await asset.addLabels(labels);

      console.log(`✅ Added ${labelIds.length} labels to asset ${assetId}`);

      // Return asset with labels
      return this.getAssetWithLabels(assetId);
    } catch (error) {
      console.error('Failed to add labels:', error);
      throw error;
    }
  }

  /**
   * Remove label from asset
   * @param {String} assetId - Asset UUID
   * @param {String} labelId - Label UUID
   * @returns {Object} Updated asset
   */
  async removeLabelFromAsset(assetId, labelId) {
    try {
      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      const label = await AssetLabel.findByPk(labelId);
      if (!label) {
        throw new Error('Label not found');
      }

      await asset.removeLabel(label);

      console.log(`✅ Removed label ${labelId} from asset ${assetId}`);
      return this.getAssetWithLabels(assetId);
    } catch (error) {
      console.error('Failed to remove label:', error);
      throw error;
    }
  }

  /**
   * Get asset with labels
   * @param {String} assetId - Asset UUID
   * @returns {Object} Asset with labels
   */
  async getAssetWithLabels(assetId) {
    try {
      const asset = await Asset.findByPk(assetId, {
        include: [
          {
            model: AssetLabel,
            as: 'labels',
            through: { attributes: [] }, // Exclude junction table data
          },
        ],
      });

      if (!asset) {
        throw new Error('Asset not found');
      }

      const assetData = asset.toJSON();
      return {
        ...this._formatAssetForFrontend(asset),
        labels: assetData.labels || [],
      };
    } catch (error) {
      console.error('Failed to get asset with labels:', error);
      throw error;
    }
  }

  // ==================== USAGE TRACKING ====================

  /**
   * Track asset usage
   * @param {String} assetId - Asset UUID
   * @param {String} usedInType - Type: 'composition', 'episode', 'template'
   * @param {String} usedInId - ID of the entity using this asset
   * @returns {Object} Usage record
   */
  async trackAssetUsage(assetId, usedInType, usedInId) {
    try {
      const usage = await AssetUsage.create({
        asset_id: assetId,
        used_in_type: usedInType,
        used_in_id: usedInId,
      });
      console.log(`✅ Tracked usage: ${assetId} → ${usedInType}:${usedInId}`);
      return usage.toJSON();
    } catch (error) {
      console.error('Failed to track usage:', error);
      throw error;
    }
  }

  /**
   * Get asset usage information
   * @param {String} assetId - Asset UUID
   * @returns {Array} List of usage records
   */
  async getAssetUsage(assetId) {
    try {
      const usages = await AssetUsage.findAll({
        where: { asset_id: assetId },
        order: [['created_at', 'DESC']],
      });
      return usages.map(u => u.toJSON());
    } catch (error) {
      console.error('Failed to get asset usage:', error);
      throw error;
    }
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Bulk delete assets
   * @param {Array} assetIds - Array of asset UUIDs
   * @returns {Object} Result summary
   */
  async bulkDeleteAssets(assetIds) {
    try {
      const results = await Promise.allSettled(
        assetIds.map(async id => {
          console.log(`Attempting to delete asset: ${id}`);
          const result = await Asset.destroy({ where: { id } });
          console.log(`Delete result for ${id}:`, result);
          if (result === 0) {
            throw new Error(`Asset ${id} not found or already deleted`);
          }
          return result;
        })
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      // Log failures
      results.forEach((r, i) => {
        if (r.status === 'rejected') {
          console.error(`Failed to delete ${assetIds[i]}:`, r.reason);
        }
      });

      console.log(`✅ Bulk delete: ${succeeded} succeeded, ${failed} failed`);
      
      if (failed > 0 && succeeded === 0) {
        throw new Error(`All ${failed} delete operations failed`);
      }
      
      return { succeeded, failed, total: assetIds.length };
    } catch (error) {
      console.error('Bulk delete failed:', error);
      throw error;
    }
  }

  /**
   * Bulk process background removal
   * @param {Array} assetIds - Array of asset UUIDs
   * @returns {Object} Result summary
   */
  async bulkProcessBackground(assetIds) {
    try {
      const results = await Promise.allSettled(
        assetIds.map(id => this.processAssetBackgroundRemoval(id))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`✅ Bulk process: ${succeeded} succeeded, ${failed} failed`);
      return { succeeded, failed, total: assetIds.length };
    } catch (error) {
      console.error('Bulk process failed:', error);
      throw error;
    }
  }

  /**
   * Bulk add labels
   * @param {Array} assetIds - Array of asset UUIDs
   * @param {Array} labelIds - Array of label UUIDs
   * @returns {Object} Result summary
   */
  async bulkAddLabels(assetIds, labelIds) {
    try {
      const results = await Promise.allSettled(
        assetIds.map(assetId => this.addLabelsToAsset(assetId, labelIds))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`✅ Bulk label: ${succeeded} succeeded, ${failed} failed`);
      return { succeeded, failed, total: assetIds.length };
    } catch (error) {
      console.error('Bulk label failed:', error);
      throw error;
    }
  }

  // ==================== UPDATE OPERATIONS ====================

  /**
   * Update asset metadata
   * @param {String} assetId - Asset UUID
   * @param {Object} updates - Fields to update (name, description, metadata)
   * @returns {Object} Updated asset
   */
  async updateAsset(assetId, updates) {
    try {
      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      const allowedFields = ['name', 'description', 'metadata', 'asset_type'];
      const updateData = {};

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          updateData[key] = updates[key];
        }
      });

      updateData.updated_at = new Date();

      await asset.update(updateData);

      console.log(`✅ Asset updated: ${assetId}`);
      return this.getAssetWithLabels(assetId);
    } catch (error) {
      console.error('Failed to update asset:', error);
      throw error;
    }
  }

  // ==================== SEARCH & FILTER ====================

  /**
   * Search assets with advanced filters
   * @param {Object} filters - Search filters
   * @returns {Array} Filtered assets
   */
  async searchAssets(filters = {}) {
    try {
      const {
        query,
        assetType,
        mediaType,
        labelIds,
        approvalStatus = 'APPROVED',
        sortBy = 'created_at',
        sortOrder = 'DESC',
        limit = 100,
      } = filters;

      const where = { approval_status: approvalStatus };

      if (assetType) {
        where.asset_type = assetType;
      }

      if (mediaType) {
        where.media_type = mediaType;
      }

      if (query) {
        const { Op } = require('sequelize');
        where.name = { [Op.iLike]: `%${query}%` };
      }

      const include = [];

      if (labelIds && labelIds.length > 0) {
        include.push({
          model: AssetLabel,
          as: 'labels',
          where: { id: labelIds },
          through: { attributes: [] },
        });
      } else {
        include.push({
          model: AssetLabel,
          as: 'labels',
          through: { attributes: [] },
          required: false,
        });
      }

      const assets = await Asset.findAll({
        where,
        include,
        order: [[sortBy, sortOrder]],
        limit,
      });

      return assets.map(asset => {
        const assetData = asset.toJSON();
        return {
          ...this._formatAssetForFrontend(asset),
          labels: assetData.labels || [],
        };
      });
    } catch (error) {
      console.error('Search assets failed:', error);
      throw error;
    }
  }

  /**
   * Format asset for frontend consumption
   * @private
   */
  /**
   * Format asset for frontend
   */
  _formatAssetForFrontend(asset) {
    const assetData = asset.toJSON ? asset.toJSON() : asset;

    return {
      id: assetData.id,
      name: assetData.name,
      asset_type: assetData.asset_type,
      type: assetData.asset_type, // Alias
      approval_status: assetData.approval_status,
      media_type: assetData.media_type || 'image',
      duration_seconds: assetData.duration_seconds,
      description: assetData.description,
      s3_url: assetData.s3_url_raw || assetData.s3_url,
      s3_url_raw: assetData.s3_url_raw,
      s3_url_processed: assetData.s3_url_processed,
      s3_key_raw: assetData.s3_key_raw,
      s3_key_processed: assetData.s3_key_processed,
      file_size_bytes: assetData.file_size_bytes,
      width: assetData.width,
      height: assetData.height,
      video_codec: assetData.video_codec,
      audio_codec: assetData.audio_codec,
      bitrate: assetData.bitrate,
      thumbnail: assetData.metadata?.thumbnail_url || assetData.s3_url_raw,
      uploadedAt: assetData.created_at,
      created_at: assetData.created_at,
      updated_at: assetData.updated_at,
      processed_at: assetData.processed_at,
      metadata: assetData.metadata || {},
      labels: assetData.labels || [],
    };
  }

  /**
   * Generate S3 URL from key
   * @private
   */
  _generateS3Url(s3Key) {
    if (!s3Key) return null;
    return `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
  }

  /**
   * Generate placeholder thumbnail as data URI
   * @private
   */
  _generateThumbnailDataUri() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect fill="#e0e0e0" width="150" height="150"/><text x="75" y="75" text-anchor="middle" fill="#999" font-size="14" dy=".3em" dominant-baseline="middle">📦</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  /**
   * Get file extension from MIME type
   * @private
   */
  _getFileExtension(mimetype) {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
    };
    return extensions[mimetype] || '.bin';
  }
}

module.exports = new AssetService();
