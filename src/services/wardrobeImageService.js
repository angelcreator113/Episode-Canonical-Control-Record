'use strict';

/**
 * Wardrobe Image Service — v1.0
 *
 * Specialized image processing for wardrobe items:
 *   1. Auto-sharpening: Enhance clarity and edge definition
 *   2. Thumbnail generation: Create 300px thumbnails for fast gallery loading
 *   3. AI Upscaling: 4x upscale via Replicate Real-ESRGAN
 */

const sharp = require('sharp');
const axios = require('axios');
const Replicate = require('replicate');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const S3_BUCKET  = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || 'episode-metadata-storage-dev';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

// ─── SHARP: AUTO-SHARPEN FOR UPLOADS ─────────────────────────────────────────

/**
 * Process an uploaded wardrobe image with Sharp.
 * - Normalize to sRGB color space
 * - Auto-orient based on EXIF
 * - Apply unsharp mask for crisp clothing details
 * - Output high-quality JPEG
 *
 * @param {Buffer} inputBuffer - Raw file buffer from multer
 * @param {Object} options
 * @returns {{ buffer: Buffer, metadata: Object }}
 */
async function sharpEnhanceWardrobe(inputBuffer, options = {}) {
  const {
    maxWidth = 2000,
    maxHeight = 2000,
    sharpenSigma = 1.0,
    sharpenFlat = 1.0,
    sharpenJagged = 0.5,
    jpegQuality = 92,
  } = options;

  const inputMeta = await sharp(inputBuffer).metadata();
  console.log(`[WardrobeImage] Input: ${inputMeta.width}x${inputMeta.height} ${inputMeta.format}`);

  let pipeline = sharp(inputBuffer)
    .rotate() // Auto-orient based on EXIF
    .toColorspace('srgb'); // Normalize color space

  // Resize only if larger than max dimensions (fit inside, preserve aspect)
  if (inputMeta.width > maxWidth || inputMeta.height > maxHeight) {
    pipeline = pipeline.resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    });
    console.log(`[WardrobeImage] Resizing to fit ${maxWidth}x${maxHeight}`);
  }

  // Sharpening pass — optimized for fabric/clothing textures
  pipeline = pipeline.sharpen({
    sigma: sharpenSigma,
    flat: sharpenFlat,
    jagged: sharpenJagged,
  });

  // Slight contrast boost for clothing photography
  pipeline = pipeline.modulate({
    brightness: 1.0,
    saturation: 1.02, // Very subtle saturation boost
  });

  const outputBuffer = await pipeline
    .jpeg({
      quality: jpegQuality,
      progressive: true,
      mozjpeg: true,
      chromaSubsampling: '4:4:4', // Better color detail for fashion
    })
    .toBuffer();

  const outputMeta = await sharp(outputBuffer).metadata();
  console.log(`[WardrobeImage] Output: ${outputMeta.width}x${outputMeta.height}, ${(outputBuffer.length / 1024).toFixed(0)}KB`);

  return {
    buffer: outputBuffer,
    metadata: {
      width: outputMeta.width,
      height: outputMeta.height,
      format: 'jpeg',
      size: outputBuffer.length,
      originalWidth: inputMeta.width,
      originalHeight: inputMeta.height,
    },
    contentType: 'image/jpeg',
  };
}

// ─── THUMBNAIL GENERATION ────────────────────────────────────────────────────

/**
 * Generate a 300px thumbnail for gallery display.
 * - Square crop from center (best for fashion items)
 * - Subtle sharpening for small sizes
 * - WebP output for smaller file size
 *
 * @param {Buffer} inputBuffer - Source image buffer
 * @param {Object} options
 * @returns {{ buffer: Buffer, metadata: Object }}
 */
async function generateThumbnail(inputBuffer, options = {}) {
  const {
    size = 300,
    format = 'webp', // WebP is smaller for thumbnails
    quality = 80,
  } = options;

  const inputMeta = await sharp(inputBuffer).metadata();

  let pipeline = sharp(inputBuffer)
    .rotate() // Auto-orient
    .resize(size, size, {
      fit: 'cover', // Crop to fill square
      position: 'centre',
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen({
      sigma: 0.5, // Light sharpening for small images
      flat: 0.8,
      jagged: 0.3,
    });

  let outputBuffer;
  let contentType;

  if (format === 'webp') {
    outputBuffer = await pipeline.webp({ quality, effort: 4 }).toBuffer();
    contentType = 'image/webp';
  } else {
    outputBuffer = await pipeline.jpeg({ quality, progressive: true }).toBuffer();
    contentType = 'image/jpeg';
  }

  console.log(`[WardrobeImage] Thumbnail: ${size}x${size} ${format}, ${(outputBuffer.length / 1024).toFixed(0)}KB`);

  return {
    buffer: outputBuffer,
    metadata: {
      width: size,
      height: size,
      format,
      size: outputBuffer.length,
    },
    contentType,
  };
}

// ─── AI UPSCALING VIA REPLICATE ──────────────────────────────────────────────

/**
 * 4x AI upscale using Real-ESRGAN via Replicate.
 * Best for low-res wardrobe images that need enhancement.
 *
 * @param {string} imageUrl - S3 URL of source image
 * @param {Object} options
 * @returns {{ buffer: Buffer, metadata: Object }}
 */
async function aiUpscaleImage(imageUrl, options = {}) {
  const {
    scale = 4,
    faceEnhance = false, // Enable for images with faces
  } = options;

  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!replicateToken) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  const replicate = new Replicate({ auth: replicateToken });

  console.log(`[WardrobeImage] AI Upscale: Starting ${scale}x upscale...`);

  // Real-ESRGAN model for general image upscaling
  // https://replicate.com/nightmareai/real-esrgan
  const output = await replicate.run(
    'nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa',
    {
      input: {
        image: imageUrl,
        scale,
        face_enhance: faceEnhance,
      },
    }
  );

  // Parse output — Replicate can return string URL, FileOutput object, or array
  let resultUrl;
  if (typeof output === 'string') {
    resultUrl = output;
  } else if (Array.isArray(output) && output.length > 0) {
    resultUrl = typeof output[0] === 'string' ? output[0] : output[0]?.url?.() || output[0].url || String(output[0]);
  } else if (output && typeof output === 'object') {
    resultUrl = output.url?.() || output.url || output.image || output.output || String(output);
  } else {
    throw new Error('Real-ESRGAN returned unexpected output format');
  }

  console.log(`[WardrobeImage] AI Upscale complete, downloading result...`);

  // Download the upscaled image
  const response = await axios.get(resultUrl, { responseType: 'arraybuffer', timeout: 120000 });
  const buffer = Buffer.from(response.data);

  const metadata = await sharp(buffer).metadata();
  console.log(`[WardrobeImage] Upscaled: ${metadata.width}x${metadata.height}, ${(buffer.length / 1024).toFixed(0)}KB`);

  return {
    buffer,
    metadata: {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: buffer.length,
      scale,
    },
    contentType: `image/${metadata.format === 'jpeg' ? 'jpeg' : metadata.format}`,
  };
}

// ─── S3 UPLOAD HELPERS ───────────────────────────────────────────────────────

/**
 * Upload a processed wardrobe image to S3.
 *
 * @param {Buffer} buffer - Image buffer
 * @param {string} character - Character name for folder organization
 * @param {string} suffix - File suffix (e.g., '' for main, '-thumb', '-upscaled')
 * @param {string} contentType - MIME type
 * @returns {{ s3Key: string, s3Url: string }}
 */
async function uploadWardrobeImage(buffer, character, suffix = '', contentType = 'image/jpeg') {
  const ext = contentType.includes('webp') ? 'webp'
            : contentType.includes('png') ? 'png'
            : 'jpg';
  
  const s3Key = `wardrobe/${character}/${uuidv4()}${suffix}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'max-age=31536000',
  }));

  const s3Url = `https://${S3_BUCKET}.s3.amazonaws.com/${s3Key}`;
  console.log(`[WardrobeImage] Uploaded: ${s3Url}`);

  return { s3Key, s3Url };
}

// ─── FULL PIPELINE: PROCESS WARDROBE UPLOAD ──────────────────────────────────

/**
 * Full processing pipeline for a wardrobe image upload:
 *   1. Sharpen/enhance the main image
 *   2. Generate thumbnail
 *   3. Upload both to S3
 *
 * @param {Buffer} inputBuffer - Raw file buffer from multer
 * @param {string} character - Character name
 * @param {Object} options
 * @returns {{ mainImage: { s3Key, s3Url }, thumbnail: { s3Key, s3Url } }}
 */
async function processWardrobeUpload(inputBuffer, character, options = {}) {
  const { skipThumbnail = false, thumbnailSize = 300 } = options;

  // Step 1: Enhance main image
  console.log('[WardrobeImage] Pipeline: Step 1 - Enhancing main image...');
  const enhanced = await sharpEnhanceWardrobe(inputBuffer);
  const mainUpload = await uploadWardrobeImage(enhanced.buffer, character, '', enhanced.contentType);

  // Step 2: Generate thumbnail (in parallel with background removal if applicable)
  let thumbUpload = null;
  if (!skipThumbnail) {
    console.log('[WardrobeImage] Pipeline: Step 2 - Generating thumbnail...');
    const thumbnail = await generateThumbnail(enhanced.buffer, { size: thumbnailSize });
    thumbUpload = await uploadWardrobeImage(thumbnail.buffer, character, '-thumb', thumbnail.contentType);
  }

  console.log('[WardrobeImage] Pipeline complete');

  return {
    mainImage: {
      s3Key: mainUpload.s3Key,
      s3Url: mainUpload.s3Url,
      width: enhanced.metadata.width,
      height: enhanced.metadata.height,
    },
    thumbnail: thumbUpload ? {
      s3Key: thumbUpload.s3Key,
      s3Url: thumbUpload.s3Url,
    } : null,
  };
}

module.exports = {
  sharpEnhanceWardrobe,
  generateThumbnail,
  aiUpscaleImage,
  uploadWardrobeImage,
  processWardrobeUpload,
};
