/**
 * AssetService
 * Handles asset management, validation, and S3 operations
 */

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const sharp = require('sharp');
const { models } = require('../models');
const { Asset, AssetLabel } = models;
const { processImage } = require('./ImageProcessingService');

// Configure AWS SDK v3 with credential chain
let s3Client = null;
const getS3Client = () => {
  if (!s3Client) {
    const config = {
      region: process.env.AWS_REGION || 'us-east-1',
    };

    // Only add explicit credentials if they're set
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }

    s3Client = new S3Client(config);
  }
  return s3Client;
};

const BUCKET_NAME =
  process.env.AWS_S3_BUCKET || process.env.S3_ASSET_BUCKET || 'episode-metadata-assets-dev';

/**
 * Map asset_role to asset_group folder
 * This determines which folder/tab the asset appears in
 */
const getAssetGroupFromRole = (assetRole) => {
  if (!assetRole) return null;

  if (assetRole.startsWith('CHAR.HOST.LALA')) return 'LALA';
  if (assetRole.startsWith('CHAR.HOST.JUSTAWOMANINHERPRIME')) return 'SHOW';
  if (assetRole.startsWith('CHAR.HOST')) return 'LALA'; // Default host to LALA
  if (assetRole.startsWith('CHAR.GUEST') || assetRole.startsWith('GUEST')) return 'GUEST';
  if (assetRole.startsWith('BG.')) return 'EPISODE'; // Backgrounds
  if (assetRole.startsWith('BRAND.SHOW') || assetRole.startsWith('UI.ICON.SHOW')) return 'SHOW'; // Show branding/icons
  if (assetRole.startsWith('BRAND.') || assetRole.startsWith('UI.ICON')) return 'SHOW'; // Other branding
  if (assetRole.startsWith('TEXT.')) return 'EPISODE'; // Text overlays
  if (assetRole.startsWith('WARDROBE.')) return 'WARDROBE';

  return 'EPISODE'; // Default fallback
};

/**
 * Map asset_type to smart defaults for asset_group, purpose, and allowed_uses
 */
const getAssetOrganizationDefaults = (assetType) => {
  const typeMap = {
    // LALA promotional assets
    PROMO_LALA: {
      asset_group: 'LALA',
      purpose: 'MAIN',
      allowed_uses: ['THUMBNAIL', 'SOCIAL', 'UI'],
      is_global: true,
    },
    // Show/JustAWoman assets
    PROMO_JUSTAWOMANINHERPRIME: {
      asset_group: 'SHOW',
      purpose: 'MAIN',
      allowed_uses: ['THUMBNAIL', 'SOCIAL', 'SCENE'],
      is_global: false,
    },
    // Guest assets
    PROMO_GUEST: {
      asset_group: 'GUEST',
      purpose: 'MAIN',
      allowed_uses: ['THUMBNAIL', 'SCENE'],
      is_global: false,
    },
    // Brand/Logo assets
    BRAND_LOGO: {
      asset_group: 'LALA',
      purpose: 'ICON',
      allowed_uses: ['UI', 'SOCIAL', 'SCENE'],
      is_global: true,
    },
    // Episode frame assets
    EPISODE_FRAME: {
      asset_group: 'EPISODE',
      purpose: 'MAIN',
      allowed_uses: ['THUMBNAIL', 'SOCIAL'],
      is_global: false,
    },
    // Video assets
    PROMO_VIDEO: {
      asset_group: 'LALA',
      purpose: 'MAIN',
      allowed_uses: ['SCENE', 'SOCIAL'],
      is_global: false,
    },
    EPISODE_VIDEO: {
      asset_group: 'EPISODE',
      purpose: 'MAIN',
      allowed_uses: ['SCENE', 'SOCIAL'],
      is_global: false,
    },
    BACKGROUND_VIDEO: {
      asset_group: 'EPISODE',
      purpose: 'BACKGROUND',
      allowed_uses: ['SCENE', 'BACKGROUND_PLATE'],
      is_global: false,
    },
  };

  return (
    typeMap[assetType] || {
      asset_group: 'EPISODE',
      purpose: 'MAIN',
      allowed_uses: ['SCENE', 'THUMBNAIL'],
      is_global: false,
    }
  );
};

/**
 * Generate S3 folder path based on asset_role (modern) or asset_type (legacy fallback)
 * Role-based paths are more semantic and future-proof
 *
 * Examples:
 * - CHAR.HOST.LALA → characters/host/raw
 * - UI.ICON.CLOSET → ui/icons/raw
 * - BG.MAIN → backgrounds/main/raw
 * - BRAND.SHOW.TITLE_GRAPHIC → branding/show/raw
 */
const getRoleBasedS3Folder = (assetRole, assetType, isProcessed = false) => {
  const suffix = isProcessed ? 'processed' : 'raw';

  // If role is provided, use it for semantic paths
  if (assetRole) {
    const parts = assetRole.split('.');
    const category = parts[0]?.toLowerCase(); // CHAR, UI, BG, BRAND, TEXT, WARDROBE
    const subcategory = parts[1]?.toLowerCase(); // HOST, ICON, etc.

    switch (category) {
      case 'char':
        // CHAR.HOST.LALA → characters/host/raw
        // CHAR.GUEST.1 → characters/guest/raw
        return `characters/${subcategory || 'other'}/${suffix}`;

      case 'ui': {
        // UI.ICON.CLOSET → ui/icons/raw (pluralized)
        // UI.BUTTON.EXIT → ui/buttons/raw (pluralized)
        // UI.MOUSE.CURSOR → ui/mouse/raw (already plural-like)
        const pluralMap = {
          icon: 'icons',
          button: 'buttons',
          mouse: 'mouse',
        };
        const uiFolder = pluralMap[subcategory] || subcategory || 'other';
        return `ui/${uiFolder}/${suffix}`;
      }

      case 'bg':
        // BG.MAIN → backgrounds/main/raw
        // BG.PATTERN → backgrounds/pattern/raw
        return `backgrounds/${subcategory || 'main'}/${suffix}`;

      case 'brand':
        // BRAND.SHOW.TITLE_GRAPHIC → branding/show/raw
        // BRAND.LOGO.PRIMARY → branding/logo/raw
        return `branding/${subcategory || 'logo'}/${suffix}`;

      case 'text':
        // TEXT.SHOW.TITLE → text/show/raw
        // TEXT.EPISODE.SUBTITLE → text/episode/raw
        return `text/${subcategory || 'other'}/${suffix}`;

      case 'wardrobe': {
        // WARDROBE.ITEM.1 → wardrobe/items/raw (pluralized)
        // WARDROBE.OUTFIT.CASUAL → wardrobe/outfits/raw (pluralized)
        const wardrobeFolder =
          subcategory === 'item'
            ? 'items'
            : subcategory === 'outfit'
              ? 'outfits'
              : subcategory || 'items';
        return `wardrobe/${wardrobeFolder}/${suffix}`;
      }

      case 'guest':
        // GUEST.REACTION.1 → characters/guest/raw (legacy role format)
        return `characters/guest/${suffix}`;

      default:
        // Unknown role format, use generic path with category
        return `assets/${category}/${suffix}`;
    }
  }

  // Fallback to legacy assetType-based paths
  const folderMap = {
    PROMO_LALA: 'promotional/lala',
    PROMO_JUSTAWOMANINHERPRIME: 'promotional/justawomaninherprime',
    PROMO_GUEST: 'promotional/guests',
    BRAND_LOGO: 'promotional/brands',
    EPISODE_FRAME: 'thumbnails/auto',
    BACKGROUND_IMAGE: 'backgrounds/images',
    PROMO_VIDEO: 'promotional/videos',
    EPISODE_VIDEO: 'episodes/videos',
    BACKGROUND_VIDEO: 'backgrounds/videos',
  };

  const baseFolder = folderMap[assetType] || 'assets/other';
  return `${baseFolder}/${suffix}`;
};

class AssetService {
  /**
   * Upload asset to S3 and create database record
   * @param {Object} file - Multer file object
   * @param {String} assetType - Asset type enum
   * @param {String} assetRole - Asset role (e.g., BG.MAIN, CHAR.HOST.PRIMARY)
   * @param {Object} metadata - Additional metadata
   * @param {String} uploadedBy - User ID
   * @returns {Object} Created asset with URLs
   */
  async uploadAsset(file, assetType, assetRole, metadata, uploadedBy) {
    try {
      // Calculate file hash for duplicate detection
      const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
      console.log(`🔢 File hash: ${fileHash}`);

      // Check for existing asset with same hash
      const existingAsset = await Asset.findOne({
        where: {
          file_hash: fileHash,
          deleted_at: null,
        },
      });

      if (existingAsset) {
        console.log(`⚠️ Duplicate file detected! Reusing existing asset ${existingAsset.id}`);

        // Update episode linkage if provided
        if (metadata?.episodeId && existingAsset.episode_id !== metadata.episodeId) {
          await existingAsset.update({
            episode_id: metadata.episodeId,
            metadata: {
              ...existingAsset.metadata,
              linked_episodes: [
                ...(existingAsset.metadata?.linked_episodes || [existingAsset.episode_id]).filter(
                  Boolean
                ),
                metadata.episodeId,
              ],
              last_reused: new Date().toISOString(),
              reused_by: uploadedBy,
            },
          });
        }

        return {
          ...existingAsset.toJSON(),
          s3_url: existingAsset.s3_url_raw || existingAsset.url,
          thumbnail: existingAsset.metadata?.thumbnail_url || existingAsset.s3_url_raw,
          isDuplicate: true,
          warning: `This file already exists in the system. The existing asset has been linked to this episode.`,
          originalAssetId: existingAsset.id,
        };
      }

      // Validate asset type
      const validTypes = [
        'PROMO_LALA',
        'PROMO_JUSTAWOMANINHERPRIME',
        'PROMO_GUEST',
        'BRAND_LOGO',
        'EPISODE_FRAME',
        'BACKGROUND_IMAGE',
        'PROMO_VIDEO',
        'EPISODE_VIDEO',
        'BACKGROUND_VIDEO',
      ];

      if (!validTypes.includes(assetType)) {
        throw new Error(`Invalid asset type. Must be one of: ${validTypes.join(', ')}`);
      }

      const assetId = uuidv4();
      const timestamp = Date.now();

      // ✅ NEW: Use role-based S3 folder path (falls back to type-based if no role)
      const folder = getRoleBasedS3Folder(assetRole, assetType, false);
      const fileExtension = this._getFileExtension(file.mimetype);
      const s3Key = `${folder}/${timestamp}-${assetId}${fileExtension}`;

      console.log('📂 S3 folder path:', {
        assetRole: assetRole || '(none)',
        assetType,
        resolvedFolder: folder,
        fullKey: s3Key,
      });

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
        const client = getS3Client();

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

      // Get smart defaults based on asset_type
      const orgDefaults = getAssetOrganizationDefaults(assetType);

      // Override asset_group if assetRole is provided (role is more specific than type)
      const assetGroup = assetRole ? getAssetGroupFromRole(assetRole) : orgDefaults.asset_group;

      console.log('📁 Asset folder assignment:', {
        assetRole,
        assetType,
        derivedGroup: assetGroup,
        defaultGroup: orgDefaults.asset_group,
      });

      // Create database record with new schema
      const asset = await Asset.create({
        id: assetId,
        name: file.originalname || `${assetType}-${timestamp}`,
        asset_type: assetType,
        asset_role: assetRole || null,
        approval_status: 'APPROVED', // Auto-approve for now

        // Asset organization fields (new)
        asset_group: assetGroup,
        asset_scope: orgDefaults.is_global ? 'GLOBAL' : 'EPISODE',
        show_id: null,
        episode_id: metadata?.episodeId || null,
        purpose: orgDefaults.purpose,
        allowed_uses: orgDefaults.allowed_uses,
        is_global: orgDefaults.is_global,

        // Media type field
        media_type: mediaType,

        // Duplicate detection
        file_hash: fileHash,

        // Raw image fields - CRITICAL: both must be set!
        s3_key_raw: s3Key,
        s3_url_raw: s3Url,
        file_size_bytes: file.size,
        file_name: file.originalname,
        content_type: file.mimetype,

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

      // Queue async image processing for thumbnails
      if (!isVideo && file.buffer) {
        try {
          console.log(`📋 Queueing image processing for ${assetId}`);
          // Process immediately with buffer (async, don't wait)
          setImmediate(async () => {
            try {
              await processImage(assetId, file.buffer, s3Key);
            } catch (procError) {
              console.error(`Image processing failed for ${assetId}:`, procError);
            }
          });
        } catch (queueError) {
          console.warn(`⚠️ Failed to queue image processing: ${queueError.message}`);
        }
      }

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
        paranoid: true, // Exclude soft-deleted assets
        raw: false,
      });

      console.log(
        `✅ AssetService: Found ${assets.length} approved assets (type: ${assetType || 'all'}), excluding deleted`
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
        paranoid: true, // Exclude soft-deleted assets
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

      // Check if it's a video - can't remove background from videos
      if (asset.media_type === 'video') {
        throw new Error(
          'Background removal is not supported for video files. Only images can be processed.'
        );
      }

      // Check if already processed
      if (asset.s3_url_processed) {
        console.log(`⚠️ Asset ${assetId} already has processed version`);
        return asset.toJSON();
      }

      console.log(`🎨 Processing background removal for ${assetId}`);
      console.log(`📁 Asset S3 key: ${asset.s3_key_raw}`);
      console.log(`📁 Asset S3 URL: ${asset.s3_url_raw}`);

      // Download the image from S3
      const s3 = getS3Client();
      const getCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: asset.s3_key_raw,
      });

      console.log(`🔍 Attempting to download from S3: ${BUCKET_NAME}/${asset.s3_key_raw}`);
      console.log(`🔑 AWS Credentials configured: ${!!process.env.AWS_ACCESS_KEY_ID}`);
      console.log(`🔑 AWS Region: ${process.env.AWS_REGION}`);

      let response;
      try {
        response = await s3.send(getCommand);
      } catch (s3Error) {
        console.error('❌ S3 Download Error:', s3Error.message);
        console.error('❌ S3 Error Code:', s3Error.Code || s3Error.name);
        console.error('❌ S3 Error Details:', JSON.stringify(s3Error, null, 2));

        if (s3Error.Code === 'SignatureDoesNotMatch' || s3Error.name === 'SignatureDoesNotMatch') {
          throw new Error(
            'AWS credential error: Invalid access key or secret. Please check your AWS configuration.'
          );
        } else if (s3Error.Code === 'NoSuchKey' || s3Error.name === 'NoSuchKey') {
          throw new Error(`Asset file not found in S3: ${asset.s3_key_raw}`);
        } else if (s3Error.Code === 'AccessDenied' || s3Error.name === 'AccessDenied') {
          throw new Error(
            'AWS permission error: Access denied to S3 bucket. Check IAM permissions.'
          );
        } else if (s3Error.Code === 'InvalidAccessKeyId' || s3Error.name === 'InvalidAccessKeyId') {
          throw new Error('AWS credential error: Access key ID is invalid or does not exist.');
        } else if (
          s3Error.Code === 'SignatureDoesNotMatch' ||
          s3Error.message?.includes('signature')
        ) {
          throw new Error(
            'AWS signature error: The request signature does not match. Check your secret access key.'
          );
        }
        throw new Error(`S3 download failed: ${s3Error.message}`);
      }

      const imageBuffer = await this.streamToBuffer(response.Body);

      const FormData = require('form-data');
      const axios = require('axios');
      let processedImageBuffer = null;

      // Try RunwayML first
      const runwayApiKey = process.env.RUNWAY_ML_API_KEY;
      if (runwayApiKey) {
        try {
          const formData = new FormData();
          formData.append('image', imageBuffer, {
            filename: asset.file_name,
            contentType: asset.content_type,
          });

          console.log(`📤 Trying RunwayML API...`);
          const runwayResponse = await axios.post(
            'https://api.runwayml.com/v1/remove-background',
            formData,
            {
              headers: {
                ...formData.getHeaders(),
                Authorization: `Bearer ${runwayApiKey}`,
              },
              responseType: 'arraybuffer',
              timeout: 30000,
            }
          );
          processedImageBuffer = Buffer.from(runwayResponse.data);
          console.log(`✅ RunwayML processing successful`);
        } catch (runwayError) {
          console.warn('⚠️ RunwayML failed:', runwayError.message);
          if (runwayError.response) {
            console.warn(
              'RunwayML error details:',
              runwayError.response.status,
              runwayError.response.statusText
            );
          }
        }
      }

      // Fallback to remove.bg if RunwayML failed or not configured
      if (!processedImageBuffer) {
        const removebgApiKey = process.env.REMOVEBG_API_KEY;
        if (!removebgApiKey) {
          throw new Error(
            'No background removal API configured. Please set RUNWAY_ML_API_KEY or REMOVEBG_API_KEY.'
          );
        }

        try {
          const formData = new FormData();
          formData.append('image_file', imageBuffer, {
            filename: asset.file_name,
            contentType: asset.content_type,
          });
          formData.append('size', 'auto');

          console.log(`📤 Using remove.bg API as fallback...`);
          const removebgResponse = await axios.post(
            'https://api.remove.bg/v1.0/removebg',
            formData,
            {
              headers: {
                ...formData.getHeaders(),
                'X-Api-Key': removebgApiKey,
              },
              responseType: 'arraybuffer',
              timeout: 30000,
            }
          );
          processedImageBuffer = Buffer.from(removebgResponse.data);
          console.log(`✅ remove.bg processing successful`);
        } catch (removebgError) {
          console.error('❌ remove.bg failed:', removebgError.message);
          if (removebgError.response) {
            console.error(
              'remove.bg error:',
              removebgError.response.status,
              removebgError.response.data
            );
          }
          throw new Error('All background removal services failed');
        }
      }

      // Upload processed image to S3
      // Replace /raw/ with /processed/ in the S3 key, or append _processed if no /raw/ found
      let processedKey;
      if (asset.s3_key_raw.includes('/raw/')) {
        processedKey = asset.s3_key_raw.replace('/raw/', '/processed/');
      } else {
        // Fallback: add _processed suffix before file extension
        const lastDot = asset.s3_key_raw.lastIndexOf('.');
        if (lastDot > 0) {
          processedKey = asset.s3_key_raw.substring(0, lastDot) + '_processed.png';
        } else {
          processedKey = asset.s3_key_raw + '_processed.png';
        }
      }

      const putCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: processedKey,
        Body: processedImageBuffer,
        ContentType: 'image/png',
      });

      console.log(`📤 Uploading processed image to S3: ${BUCKET_NAME}/${processedKey}`);
      try {
        await s3.send(putCommand);
      } catch (uploadError) {
        console.error('❌ S3 Upload Error:', uploadError.message);
        if (uploadError.Code === 'SignatureDoesNotMatch') {
          throw new Error('AWS credential error during upload: Invalid access key or secret.');
        } else if (uploadError.Code === 'AccessDenied') {
          throw new Error(
            'AWS permission error: Cannot write to S3 bucket. Check IAM permissions.'
          );
        }
        throw new Error(`Failed to upload processed image to S3: ${uploadError.message}`);
      }

      const processedUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${processedKey}`;

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
      return labels.map((l) => l.toJSON());
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

  // NOTE: asset_usage table doesn't exist, so these methods are commented out
  // /**
  //  * Track asset usage
  //  * @param {String} assetId - Asset UUID
  //  * @param {String} usedInType - Type: 'composition', 'episode', 'template'
  //  * @param {String} usedInId - ID of the entity using this asset
  //  * @returns {Object} Usage record
  //  */
  // async trackAssetUsage(assetId, usedInType, usedInId) {
  //   try {
  //     const usage = await AssetUsage.create({
  //       asset_id: assetId,
  //       used_in_type: usedInType,
  //       used_in_id: usedInId,
  //     });
  //     console.log(`✅ Tracked usage: ${assetId} → ${usedInType}:${usedInId}`);
  //     return usage.toJSON();
  //   } catch (error) {
  //     console.error('Failed to track usage:', error);
  //     throw error;
  //   }
  // }

  // /**
  //  * Get asset usage information
  //  * @param {String} assetId - Asset UUID
  //  * @returns {Array} List of usage records
  //  */
  /**
   * Get asset usage information - which episodes use this asset
   * @param {String} assetId - Asset UUID
   * @returns {Array} List of episodes using this asset
   */
  async getAssetUsage(assetId) {
    try {
      const { EpisodeAsset, Episode } = require('../models');

      const usages = await EpisodeAsset.findAll({
        where: { asset_id: assetId },
        include: [
          {
            model: Episode,
            as: 'episode',
            attributes: ['id', 'episode_number', 'title'],
          },
        ],
        order: [['created_at', 'DESC']],
      });

      return usages.map((u) => ({
        episode_id: u.episode_id,
        episode_number: u.episode?.episode_number,
        episode_title: u.episode?.title,
        usage_type: u.usage_type,
        created_at: u.created_at,
      }));
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
        assetIds.map(async (id) => {
          console.log(`Attempting to delete asset: ${id}`);
          const result = await Asset.destroy({ where: { id } });
          console.log(`Delete result for ${id}:`, result);
          if (result === 0) {
            throw new Error(`Asset ${id} not found or already deleted`);
          }
          return result;
        })
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

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
        assetIds.map((id) => this.processAssetBackgroundRemoval(id))
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

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
        assetIds.map((assetId) => this.addLabelsToAsset(assetId, labelIds))
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      console.log(`✅ Bulk label: ${succeeded} succeeded, ${failed} failed`);
      return { succeeded, failed, total: assetIds.length };
    } catch (error) {
      console.error('Bulk label failed:', error);
      throw error;
    }
  }

  /**
   * Bulk change asset type
   * @param {Array} assetIds - Array of asset UUIDs
   * @param {String} assetType - New asset type
   * @returns {Object} Result summary
   */
  async bulkChangeAssetType(assetIds, assetType) {
    try {
      const results = await Promise.allSettled(
        assetIds.map((assetId) => this.updateAsset(assetId, { asset_type: assetType }))
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      console.log(`✅ Bulk type change: ${succeeded} succeeded, ${failed} failed`);
      return { succeeded, failed, total: assetIds.length };
    } catch (error) {
      console.error('Bulk type change failed:', error);
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

      const allowedFields = [
        'name',
        'description',
        'metadata',
        'asset_type',
        'asset_group',
        'purpose',
        'allowed_uses',
        'is_global',
      ];
      const updateData = {};

      Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
          updateData[key] = updates[key];
        }
      });

      updateData.updated_at = new Date();

      await asset.update(updateData);

      console.log(`✅ Asset updated: ${assetId}`);

      // Return formatted asset without labels to avoid querying non-existent junction table
      return this._formatAssetForFrontend(asset);
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
        labelIds: _labelIds,
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

      // Don't include labels - junction table doesn't exist
      const assets = await Asset.findAll({
        where,
        order: [[sortBy, sortOrder]],
        paranoid: true, // Exclude soft-deleted assets
        limit,
      });

      return assets.map((asset) => {
        const assetData = asset.toJSON();
        return {
          id: assetData.id,
          name: assetData.name,
          asset_type: assetData.asset_type,
          asset_group: assetData.asset_group,
          purpose: assetData.purpose,
          allowed_uses: assetData.allowed_uses,
          is_global: assetData.is_global,
          s3_url_raw: assetData.s3_url_raw,
          s3_url_processed: assetData.s3_url_processed,
          media_type: assetData.media_type,
          width: assetData.width,
          height: assetData.height,
          file_size_bytes: assetData.file_size_bytes,
          approval_status: assetData.approval_status,
          metadata: assetData.metadata,
          created_at: assetData.created_at,
          updated_at: assetData.updated_at,
          labels: assetData.labels || [],
        };
      });
    } catch (error) {
      console.error('Search assets failed:', error);
      throw error;
    }
  }

  /**
   * Generate pre-signed download URL for asset
   * @param {String} assetId - Asset UUID
   * @param {String} type - 'raw' or 'processed'
   * @returns {String} Pre-signed download URL
   */
  async generateDownloadUrl(assetId, type = 'raw') {
    try {
      console.log(`🔗 Generating download URL for asset ${assetId}, type: ${type}`);

      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        throw new Error(`Asset ${assetId} not found`);
      }

      // Get the appropriate S3 key
      let s3Key;
      if (type === 'processed') {
        // Use processed key if available
        s3Key = asset.s3_key_processed || asset.s3_key_raw;
        if (!s3Key && asset.s3_url_processed) {
          // Extract key from URL
          s3Key = asset.s3_url_processed.split('.com/')[1];
        }
      } else {
        // Use raw key
        s3Key = asset.s3_key_raw || asset.s3_key;
        if (!s3Key && asset.s3_url_raw) {
          // Extract key from URL
          s3Key = asset.s3_url_raw.split('.com/')[1];
        }
      }

      if (!s3Key) {
        throw new Error(`No S3 key found for asset ${assetId} (${type})`);
      }

      console.log(`📁 S3 key for download: ${s3Key}`);

      // Generate pre-signed URL with 1 hour expiration
      const client = getS3Client();
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        ResponseContentDisposition: `attachment; filename="${asset.file_name || asset.name}"`,
      });

      const signedUrl = await getSignedUrl(client, command, {
        expiresIn: 3600, // 1 hour
      });

      console.log(`✅ Download URL generated successfully`);
      return signedUrl;
    } catch (error) {
      console.error('❌ Failed to generate download URL:', error);
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
