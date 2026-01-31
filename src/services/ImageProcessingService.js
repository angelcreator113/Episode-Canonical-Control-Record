/**
 * Image Processing Service
 * Handles async thumbnail generation and image optimization
 * Uses Sharp for high-performance image processing
 */

const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { models } = require('../models');
const { Asset } = models;

// Configure S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'episode-metadata-storage-dev';

/**
 * Thumbnail sizes to generate
 */
const THUMBNAIL_SIZES = {
  small: { width: 150, height: 150, fit: 'cover' },
  medium: { width: 300, height: 300, fit: 'cover' },
  large: { width: 800, height: null, fit: 'inside' }, // Maintain aspect ratio
};

/**
 * Process image and generate thumbnails
 * @param {string} assetId - Asset UUID
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {string} originalKey - Original S3 key
 * @returns {Object} Processing results with S3 URLs
 */
async function processImage(assetId, imageBuffer, originalKey) {
  console.log(`🖼️ Processing image for asset ${assetId}`);

  const results = {
    thumbnails: {},
    webp: {},
    processedUrl: null,
  };

  try {
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    console.log(`  📐 Original: ${metadata.width}x${metadata.height} ${metadata.format}`);

    // Generate thumbnails in multiple sizes
    for (const [size, config] of Object.entries(THUMBNAIL_SIZES)) {
      const { width, height, fit } = config;

      // Generate JPEG thumbnail
      const jpegBuffer = await sharp(imageBuffer)
        .resize(width, height, { fit, withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();

      const jpegKey = `thumbnails/${size}/${assetId}.jpg`;
      await uploadToS3(jpegKey, jpegBuffer, 'image/jpeg');
      results.thumbnails[size] = getS3Url(jpegKey);

      // Generate WebP version (better compression)
      const webpBuffer = await sharp(imageBuffer)
        .resize(width, height, { fit, withoutEnlargement: true })
        .webp({ quality: 80, effort: 4 })
        .toBuffer();

      const webpKey = `thumbnails/${size}/${assetId}.webp`;
      await uploadToS3(webpKey, webpBuffer, 'image/webp');
      results.webp[size] = getS3Url(webpKey);

      console.log(`  ✅ Generated ${size} (${width}${height ? 'x' + height : 'w'}): JPEG + WebP`);
    }

    // Generate optimized processed version (800px max width)
    const processedBuffer = await sharp(imageBuffer)
      .resize(800, null, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    const processedKey = `processed/${path.dirname(originalKey)}/${assetId}.jpg`;
    await uploadToS3(processedKey, processedBuffer, 'image/jpeg');
    results.processedUrl = getS3Url(processedKey);

    console.log(`  ✅ Generated processed version: ${results.processedUrl}`);

    // Update asset in database
    await Asset.update(
      {
        s3_url_processed: results.processedUrl,
        metadata: models.sequelize.literal(`
          metadata || jsonb_build_object(
            'thumbnails', '${JSON.stringify(results.thumbnails)}'::jsonb,
            'webp', '${JSON.stringify(results.webp)}'::jsonb,
            'processing_status', 'completed',
            'processed_at', NOW()
          )
        `),
      },
      { where: { id: assetId } }
    );

    console.log(`✅ Image processing complete for ${assetId}`);

    return results;
  } catch (error) {
    console.error(`❌ Image processing failed for ${assetId}:`, error);

    // Update asset with error status
    await Asset.update(
      {
        metadata: models.sequelize.literal(`
          metadata || jsonb_build_object(
            'processing_status', 'failed',
            'processing_error', '${error.message.replace(/'/g, "''")}',
            'processed_at', NOW()
          )
        `),
      },
      { where: { id: assetId } }
    );

    throw error;
  }
}

/**
 * Upload buffer to S3
 */
async function uploadToS3(key, buffer, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000', // 1 year cache
  });

  await s3Client.send(command);
}

/**
 * Get S3 URL from key
 */
function getS3Url(key) {
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

/**
 * Process video thumbnail (extract frame)
 */
async function processVideoThumbnail(assetId, videoBuffer) {
  // For now, return a placeholder
  // TODO: Implement ffmpeg video frame extraction
  console.log(`⚠️ Video thumbnail generation not yet implemented for ${assetId}`);
  return null;
}

/**
 * Queue image for processing
 * This is called asynchronously after upload completes
 */
async function queueImageProcessing(assetId) {
  // For now, process immediately
  // TODO: Implement proper job queue (Bull, pg-boss, etc.)

  try {
    const asset = await Asset.findByPk(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    // Skip if not an image
    if (!asset.content_type || !asset.content_type.startsWith('image/')) {
      console.log(`⏭️ Skipping non-image asset ${assetId}`);
      return;
    }

    // Skip if already processed
    if (asset.metadata?.processing_status === 'completed') {
      console.log(`⏭️ Asset ${assetId} already processed`);
      return;
    }

    console.log(`📋 Queued image processing for ${assetId}`);

    // Mark as processing
    await Asset.update(
      {
        metadata: models.sequelize.literal(`
          COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'processing_status', 'queued',
            'queued_at', NOW()
          )
        `),
      },
      { where: { id: assetId } }
    );

    // Process immediately (async)
    setImmediate(async () => {
      try {
        // Fetch image from S3
        // For now, we'll need the buffer passed or fetched
        // This is a placeholder for the queue system
        console.log(`🔄 Processing ${assetId}...`);
      } catch (error) {
        console.error(`Error processing ${assetId}:`, error);
      }
    });
  } catch (error) {
    console.error('Error queuing image processing:', error);
    throw error;
  }
}

module.exports = {
  processImage,
  processVideoThumbnail,
  queueImageProcessing,
  THUMBNAIL_SIZES,
};
