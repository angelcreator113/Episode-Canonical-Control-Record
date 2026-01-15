/**
 * AssetService
 * Handles asset management, validation, and S3 operations
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { fromIni, fromEnv } = require('@aws-sdk/credential-providers');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { models } = require('../models');
const { Asset } = models;

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
      };

      const folder = folderMap[assetType];
      const fileExtension = this._getFileExtension(file.mimetype);
      const s3Key = `${folder}/${timestamp}-${assetId}${fileExtension}`;

      // Generate thumbnail (max 150px)
      let thumbnailBuffer = null;
      let thumbnailKey = null;
      let imageDimensions = null;

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

        // Raw image fields
        s3_key_raw: s3Key,
        s3_url_raw: s3Url,
        file_size_bytes: file.size,

        // Dimensions
        width: imageDimensions?.width || null,
        height: imageDimensions?.height || null,

        // Legacy fields (for backward compatibility)
        s3_key: s3Key,
        url: s3Url,

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

      // Mock processing - replace with actual Runway ML integration
      const processedKey = asset.s3_key_raw.replace('/raw/', '/processed/');
      const processedUrl = asset.s3_url_raw.replace('/raw/', '/processed/');

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
      s3_url: assetData.s3_url_raw || assetData.s3_url,
      s3_url_raw: assetData.s3_url_raw,
      s3_url_processed: assetData.s3_url_processed,
      s3_key_raw: assetData.s3_key_raw,
      s3_key_processed: assetData.s3_key_processed,
      file_size_bytes: assetData.file_size_bytes,
      width: assetData.width,
      height: assetData.height,
      thumbnail: assetData.metadata?.thumbnail_url || assetData.s3_url_raw,
      uploadedAt: assetData.created_at,
      created_at: assetData.created_at,
      updated_at: assetData.updated_at,
      metadata: assetData.metadata || {},
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
