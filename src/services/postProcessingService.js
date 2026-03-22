'use strict';

/**
 * Post-Processing Service — v1.0
 *
 * Three-stage pipeline for generated scene assets:
 *   1. Sharp: upscale + sharpen stills before S3 storage
 *   2. Cloudinary: enhancement pass (color, contrast, vibrance)
 *   3. FFmpeg: video post-processing (color grade, sharpen, vignette)
 *
 * Also provides multi-pass auto-refinement via Bull queue.
 */

const sharp = require('sharp');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const S3_BUCKET  = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

// Configure FFmpeg paths (cross-platform)
const ffmpegPath = process.env.FFMPEG_PATH || (process.platform === 'win32' ? 'C:\\ffmpeg\\bin\\ffmpeg.exe' : '/usr/bin/ffmpeg');
const ffprobePath = process.env.FFPROBE_PATH || (process.platform === 'win32' ? 'C:\\ffmpeg\\bin\\ffprobe.exe' : '/usr/bin/ffprobe');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// ─── SHARP: UPSCALE & SHARPEN STILLS ─────────────────────────────────────────

/**
 * Process a generated still image with Sharp.
 * - Upscale to 1920x1080 if smaller
 * - Apply unsharp mask for edge definition
 * - Output high-quality JPEG
 *
 * @param {string} imageUrl - URL of the source image
 * @param {Object} options
 * @returns {{ buffer: Buffer, metadata: Object }}
 */
async function sharpEnhanceStill(imageUrl, options = {}) {
  const {
    targetWidth = 1920,
    targetHeight = 1080,
    sharpenSigma = 1.2,
    sharpenFlat = 1.0,
    sharpenJagged = 0.8,
    jpegQuality = 95,
  } = options;

  console.log('[PostProcess] Sharp: downloading source image...');
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 60000 });
  const inputBuffer = Buffer.from(response.data);

  const metadata = await sharp(inputBuffer).metadata();
  console.log(`[PostProcess] Sharp: input ${metadata.width}x${metadata.height} ${metadata.format}`);

  const needsUpscale = metadata.width < targetWidth || metadata.height < targetHeight;

  let pipeline = sharp(inputBuffer);

  if (needsUpscale) {
    pipeline = pipeline.resize(targetWidth, targetHeight, {
      fit: 'inside',
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    });
    console.log(`[PostProcess] Sharp: upscaling to ${targetWidth}x${targetHeight}`);
  }

  // Sharpening pass
  pipeline = pipeline.sharpen({
    sigma: sharpenSigma,
    flat: sharpenFlat,
    jagged: sharpenJagged,
  });

  const outputBuffer = await pipeline
    .jpeg({ quality: jpegQuality, progressive: true, mozjpeg: true })
    .toBuffer();

  const outputMeta = await sharp(outputBuffer).metadata();
  console.log(`[PostProcess] Sharp: output ${outputMeta.width}x${outputMeta.height}, ${(outputBuffer.length / 1024).toFixed(0)}KB`);

  return {
    buffer: outputBuffer,
    metadata: {
      width: outputMeta.width,
      height: outputMeta.height,
      format: 'jpeg',
      size: outputBuffer.length,
      upscaled: needsUpscale,
    },
  };
}

// ─── CLOUDINARY: ENHANCEMENT PASS ────────────────────────────────────────────

/**
 * Enhance a still image via Cloudinary transformations.
 * Returns the enhanced image URL.
 *
 * @param {string} imageUrl - Source image URL
 * @param {Object} settings - Enhancement settings
 * @returns {{ enhancedUrl: string, publicId: string }}
 */
async function cloudinaryEnhanceStill(imageUrl, settings = {}) {
  const {
    improve = true,
    saturation = 15,
    vibrance = 15,
    contrast = 8,
    sharpen = 15,
    warmth = 10,
  } = settings;

  const cloudName  = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey     = process.env.CLOUDINARY_API_KEY;
  const apiSecret  = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn('[PostProcess] Cloudinary: credentials not configured, skipping enhancement');
    return { enhancedUrl: imageUrl, publicId: null, skipped: true };
  }

  const cloudinary = require('cloudinary').v2;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

  const transformations = [];
  if (improve) transformations.push('e_improve');
  if (saturation) transformations.push(`e_saturation:${saturation}`);
  if (vibrance) transformations.push(`e_vibrance:${vibrance}`);
  if (contrast) transformations.push(`e_contrast:${contrast}`);
  if (sharpen) transformations.push(`e_sharpen:${sharpen}`);
  if (warmth) transformations.push(`e_art:warm`);
  transformations.push('q_auto:best');

  console.log(`[PostProcess] Cloudinary: applying ${transformations.length} transforms`);

  const result = await cloudinary.uploader.upload(imageUrl, {
    folder: 'scene-enhanced',
    transformation: transformations.join(','),
    format: 'jpg',
    quality: 'auto:best',
  });

  console.log(`[PostProcess] Cloudinary: enhanced → ${result.secure_url.slice(0, 60)}...`);

  return {
    enhancedUrl: result.secure_url,
    publicId: result.public_id,
    skipped: false,
  };
}

// ─── FFMPEG: VIDEO POST-PROCESSING ───────────────────────────────────────────

/**
 * Post-process a generated video with FFmpeg:
 * - Color grading (warm tone shift for LALAVERSE aesthetic)
 * - Sharpening (unsharp mask)
 * - Subtle vignette overlay
 *
 * @param {string} videoUrl - Source video URL
 * @param {Object} options
 * @returns {{ buffer: Buffer, metadata: Object }}
 */
async function ffmpegEnhanceVideo(videoUrl, options = {}) {
  const {
    colorGrade = true,
    sharpen = true,
    vignette = true,
    // Color grading: warm LALAVERSE tones
    brightness = 0.02,
    contrast = 1.05,
    saturation = 1.1,
    gamma_r = 1.02,
    gamma_g = 1.0,
    gamma_b = 0.97,
  } = options;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scene-postproc-'));
  const inputPath = path.join(tmpDir, 'input.mp4');
  const outputPath = path.join(tmpDir, 'output.mp4');

  try {
    // Download source video
    console.log('[PostProcess] FFmpeg: downloading source video...');
    const response = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 120000 });
    await fs.writeFile(inputPath, Buffer.from(response.data));

    // Build filter chain
    const filters = [];

    if (colorGrade) {
      filters.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);
      filters.push(`curves=r='0/0 0.5/0.52 1/1':g='0/0 0.5/0.5 1/1':b='0/0 0.5/0.48 1/1'`);
    }

    if (sharpen) {
      filters.push('unsharp=5:5:0.8:5:5:0.0');
    }

    if (vignette) {
      filters.push('vignette=PI/5');
    }

    const filterChain = filters.join(',');
    console.log(`[PostProcess] FFmpeg: filter chain → ${filterChain}`);

    // Run FFmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .videoFilters(filterChain)
        .outputOptions([
          '-c:v', 'libx264',
          '-crf', '18',
          '-preset', 'slow',
          '-c:a', 'copy',
          '-movflags', '+faststart',
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const outputBuffer = await fs.readFile(outputPath);
    const stats = await fs.stat(outputPath);

    console.log(`[PostProcess] FFmpeg: output ${(stats.size / 1024 / 1024).toFixed(1)}MB`);

    return {
      buffer: outputBuffer,
      metadata: {
        size: stats.size,
        filters: { colorGrade, sharpen, vignette },
      },
    };
  } finally {
    // Cleanup temp files
    try {
      await fs.unlink(inputPath).catch(() => {});
      await fs.unlink(outputPath).catch(() => {});
      await fs.rmdir(tmpDir).catch(() => {});
    } catch (_) { /* best effort */ }
  }
}

// ─── FULL PIPELINE: PROCESS ANGLE ASSETS ─────────────────────────────────────

/**
 * Run the full post-processing pipeline for a scene angle:
 *   1. Sharp upscale/sharpen the still
 *   2. Cloudinary enhance the still
 *   3. FFmpeg post-process the video
 *   4. Store enhanced assets in S3
 *   5. Update the SceneAngle record
 *
 * @param {Object} sceneAngle - SceneAngle instance
 * @param {Object} sceneSet - Parent SceneSet instance
 * @param {Object} models - { SceneAngle }
 * @param {Object} options - Pipeline options
 * @returns {{ enhancedStillUrl, enhancedVideoUrl }}
 */
async function processAngleAssets(sceneAngle, sceneSet, models, options = {}) {
  const { SceneAngle } = models;
  const {
    skipSharp = false,
    skipCloudinary = false,
    skipFFmpeg = false,
    sharpOptions = {},
    cloudinarySettings = {},
    ffmpegOptions = {},
  } = options;

  await SceneAngle.update(
    { post_processing_status: 'processing' },
    { where: { id: sceneAngle.id } }
  );

  try {
    let enhancedStillUrl = sceneAngle.still_image_url;
    let enhancedVideoUrl = sceneAngle.video_clip_url;

    // ── Stage 1: Sharp upscale/sharpen ──────────────────────────────────
    if (!skipSharp && sceneAngle.still_image_url) {
      console.log(`[PostProcess] Stage 1/3: Sharp enhance for ${sceneAngle.angle_name}`);
      const sharpResult = await sharpEnhanceStill(sceneAngle.still_image_url, sharpOptions);
      enhancedStillUrl = await storeBufferInS3(
        sharpResult.buffer,
        sceneSet.id,
        sceneAngle.id,
        'still-enhanced',
        'image/jpeg'
      );
      console.log(`[PostProcess] Sharp done: ${enhancedStillUrl.slice(-40)}`);
    }

    // ── Stage 2: Cloudinary enhancement ─────────────────────────────────
    if (!skipCloudinary && enhancedStillUrl) {
      console.log(`[PostProcess] Stage 2/3: Cloudinary enhance for ${sceneAngle.angle_name}`);
      const cloudResult = await cloudinaryEnhanceStill(enhancedStillUrl, cloudinarySettings);
      if (!cloudResult.skipped) {
        enhancedStillUrl = cloudResult.enhancedUrl;
      }
    }

    // ── Stage 3: FFmpeg video post-processing ───────────────────────────
    if (!skipFFmpeg && sceneAngle.video_clip_url) {
      console.log(`[PostProcess] Stage 3/3: FFmpeg enhance for ${sceneAngle.angle_name}`);
      const videoResult = await ffmpegEnhanceVideo(sceneAngle.video_clip_url, ffmpegOptions);
      enhancedVideoUrl = await storeBufferInS3(
        videoResult.buffer,
        sceneSet.id,
        sceneAngle.id,
        'video-enhanced',
        'video/mp4'
      );
      console.log(`[PostProcess] FFmpeg done: ${enhancedVideoUrl.slice(-40)}`);
    }

    // ── Update record ───────────────────────────────────────────────────
    await SceneAngle.update({
      enhanced_still_url: enhancedStillUrl,
      enhanced_video_url: enhancedVideoUrl,
      post_processing_status: 'complete',
    }, { where: { id: sceneAngle.id } });

    console.log(`[PostProcess] Pipeline complete for: ${sceneAngle.angle_name}`);

    return { enhancedStillUrl, enhancedVideoUrl };
  } catch (err) {
    console.error(`[PostProcess] Pipeline failed for ${sceneAngle.angle_name}: ${err.message}`);
    await SceneAngle.update(
      { post_processing_status: 'failed' },
      { where: { id: sceneAngle.id } }
    );
    throw err;
  }
}

// ─── S3 HELPER ───────────────────────────────────────────────────────────────

async function storeBufferInS3(buffer, setId, angleId, assetType, contentType) {
  const ext = contentType.includes('image') ? 'jpg'
            : contentType.includes('mp4') ? 'mp4'
            : 'bin';

  const s3Key = `scene-sets/${setId}/angles/${angleId || 'base'}/${assetType}.${ext}`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'max-age=31536000',
  }));

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

module.exports = {
  sharpEnhanceStill,
  cloudinaryEnhanceStill,
  ffmpegEnhanceVideo,
  processAngleAssets,
};
