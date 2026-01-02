/**
 * AssetService
 * Handles asset management, validation, and S3 operations
 */

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { models } = require('../models');
const { Asset } = models;

const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1',
});

const BUCKET_NAME = process.env.S3_ASSET_BUCKET || 'episode-metadata-assets-dev';

class AssetService {
  /**
   * Upload asset to S3 and create database record
   */
  async uploadAsset(file, assetType, metadata, uploadedBy) {
    try {
      if (!['PROMO_LALA', 'PROMO_GUEST', 'BRAND_LOGO', 'EPISODE_FRAME'].includes(assetType)) {
        throw new Error('Invalid asset type');
      }

      const assetId = uuidv4();
      const timestamp = Date.now();
      
      // Determine S3 path based on asset type
      const folderMap = {
        PROMO_LALA: 'promotional/lala/raw',
        PROMO_GUEST: 'promotional/guests/raw',
        BRAND_LOGO: 'promotional/brands',
        EPISODE_FRAME: 'thumbnails/auto',
      };

      const folder = folderMap[assetType];
      const s3Key = `${folder}/${timestamp}-${assetId}${this._getFileExtension(file.mimetype)}`;

      // Upload to S3
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          'asset-id': assetId,
          'asset-type': assetType,
        },
      };

      const result = await s3.upload(uploadParams).promise();

      // Create database record
      const asset = await Asset.create({
        id: assetId,
        asset_type: assetType,
        s3_key_raw: s3Key,
        file_size_bytes: file.size,
        content_type: file.mimetype,
        uploaded_by: uploadedBy,
        metadata,
      });

      return {
        ...asset.toJSON(),
        s3_url: result.Location,
      };
    } catch (error) {
      console.error('Asset upload failed:', error);
      throw error;
    }
  }

  /**
   * Get all approved assets of a type
   */
  async getApprovedAssets(assetType) {
    try {
      const assets = await Asset.findAll({
        where: {
          asset_type: assetType,
          approval_status: 'APPROVED',
        },
        order: [['created_at', 'DESC']],
      });

      return assets.map(asset => ({
        ...asset.toJSON(),
        s3_url: this._generateS3Url(asset.s3_key_processed || asset.s3_key_raw),
      }));
    } catch (error) {
      console.error('Failed to get approved assets:', error);
      throw error;
    }
  }

  /**
   * Get asset by ID
   */
  async getAsset(assetId) {
    try {
      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      return {
        ...asset.toJSON(),
        s3_url: this._generateS3Url(asset.s3_key_processed || asset.s3_key_raw),
      };
    } catch (error) {
      console.error('Failed to get asset:', error);
      throw error;
    }
  }

  /**
   * Approve asset
   */
  async approveAsset(assetId, approvedBy) {
    try {
      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      await asset.update({
        approval_status: 'APPROVED',
        updated_at: new Date(),
      });

      return asset.toJSON();
    } catch (error) {
      console.error('Failed to approve asset:', error);
      throw error;
    }
  }

  /**
   * Reject asset
   */
  async rejectAsset(assetId) {
    try {
      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      await asset.update({
        approval_status: 'REJECTED',
        updated_at: new Date(),
      });

      return asset.toJSON();
    } catch (error) {
      console.error('Failed to reject asset:', error);
      throw error;
    }
  }

  /**
   * List pending assets for approval
   */
  async getPendingAssets() {
    try {
      const assets = await Asset.findAll({
        where: {
          approval_status: 'PENDING',
        },
        order: [['created_at', 'ASC']],
      });

      return assets.map(asset => ({
        ...asset.toJSON(),
        s3_url: this._generateS3Url(asset.s3_key_raw),
      }));
    } catch (error) {
      console.error('Failed to get pending assets:', error);
      throw error;
    }
  }

  /**
   * Helper: Generate S3 URL
   */
  _generateS3Url(s3Key) {
    if (!s3Key) return null;
    return `https://${BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
  }

  /**
   * Helper: Get file extension from MIME type
   */
  _getFileExtension(mimetype) {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
    };
    return extensions[mimetype] || '.bin';
  }
}

module.exports = new AssetService();
