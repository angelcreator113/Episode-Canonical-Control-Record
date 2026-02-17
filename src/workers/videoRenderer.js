/**
 * Video Renderer Worker
 * Processes export jobs from the Bull queue and renders videos using FFmpeg.
 *
 * Pipeline:
 *   1. Download assets (backgrounds, characters, audio)
 *   2. Render scene frames (canvas compositing with keyframe transforms)
 *   3. Generate video with FFmpeg (concat + encode)
 *   4. Upload to S3
 *   5. Return video URL
 */

const { videoQueue } = require('../queues/videoQueue');
const ffmpeg = require('fluent-ffmpeg');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { s3 } = require('../config/aws');
const { emitExportProgress, emitExportComplete, emitExportFailed } = require('../sockets');

const TEMP_DIR = path.resolve(process.env.EXPORT_TEMP_DIR || './exports-temp');
const S3_BUCKET = process.env.S3_PROCESSED_VIDEOS_BUCKET || process.env.S3_PRIMARY_BUCKET || 'episode-metadata-storage-dev';

// Reference stage width matching the CSS max-width of the stage frame in the frontend.
// All element pixel sizes in scene data are relative to this reference canvas width.
// The renderer scales them proportionally to the actual export resolution.
const STAGE_REFERENCE_WIDTH = 960;

// Quality presets → CRF values (lower = better quality, bigger file)
const QUALITY_CRF = {
  low: 28,
  medium: 23,
  high: 18,
  ultra: 14,
};

// ============================================================================
// MAIN JOB PROCESSOR
// ============================================================================

videoQueue.process(
  'export-video',
  parseInt(process.env.EXPORT_MAX_CONCURRENT_JOBS, 10) || 2,
  async (job) => {
    const { episodeId, episode, scenes, platform, timeline, userId } = job.data;

    console.log(`🎬 [Job ${job.id}] Starting export for episode ${episodeId}`);

    const jobDir = path.join(TEMP_DIR, job.id.toString());

    try {
      // Helper: report progress to both Bull and Socket.io
      const emitProgress = (percent, message) => {
        job.progress(percent);
        emitExportProgress(job.id, { percent, stage: message, message });
      };

      emitProgress(5, 'Initializing export...');

      // Create job-specific temp directory
      await fs.mkdir(jobDir, { recursive: true });

      // ---- Step 1: Download assets ----
      emitProgress(10, 'Downloading assets...');
      const downloadedAssets = await downloadAssets(scenes, jobDir);

      // ---- Step 2: Render scene frames ----
      emitProgress(30, 'Preparing scene frames...');
      const sceneFrames = await renderSceneFrames(
        scenes,
        downloadedAssets,
        platform,
        timeline,
        jobDir,
      );

      // ---- Step 3: Render video with FFmpeg ----
      emitProgress(50, 'Generating video...');
      const outputPath = path.join(jobDir, 'output.mp4');
      await renderVideo(sceneFrames, timeline, platform, outputPath, (pct) => {
        emitProgress(50 + Math.round(pct * 0.35), `Rendering video... ${Math.round(pct)}%`);
      });

      // ---- Step 4: Upload to S3 ----
      emitProgress(90, 'Uploading video...');
      const videoUrl = await uploadToS3(outputPath, episodeId);

      // ---- Step 5: Cleanup ----
      emitProgress(95, 'Cleaning up...');
      await fs.rm(jobDir, { recursive: true, force: true });

      emitProgress(100, 'Export complete!');

      const result = {
        success: true,
        videoUrl,
        episodeId,
        platform: platform.platform,
      };

      emitExportComplete(job.id, {
        downloadUrl: videoUrl,
        duration: sceneFrames.reduce((sum, f) => sum + f.duration, 0),
      });

      return result;
    } catch (error) {
      console.error(`❌ [Job ${job.id}] Export error:`, error.message);

      // Cleanup on error
      await fs.rm(jobDir, { recursive: true, force: true }).catch(() => {});

      emitExportFailed(job.id, {
        message: error.message,
        code: error.code || 'EXPORT_ERROR',
        retriesLeft: (job.opts.attempts || 3) - job.attemptsMade - 1,
      });

      throw error;
    }
  },
);

// ============================================================================
// ASSET DOWNLOADER
// ============================================================================

/**
 * Download all assets (backgrounds, characters) from URLs to local filesystem
 */
async function downloadAssets(scenes, jobDir) {
  const assetsDir = path.join(jobDir, 'assets');
  await fs.mkdir(assetsDir, { recursive: true });

  const downloaded = {
    backgrounds: {},
    characters: {},
    uiElements: {},
    audio: {},
  };

  for (const scene of scenes) {
    // Download background
    if (scene.background_url) {
      try {
        const filename = `bg-${scene.id}.${getFileExtension(scene.background_url)}`;
        const filepath = path.join(assetsDir, filename);
        await downloadFile(scene.background_url, filepath);
        downloaded.backgrounds[scene.id] = filepath;
      } catch (err) {
        console.warn(`⚠️  Failed to download background for scene ${scene.id}:`, err.message);
      }
    }

    // Download character images
    if (scene.characters) {
      for (const char of scene.characters) {
        if (char.imageUrl && !downloaded.characters[char.id]) {
          try {
            const filename = `char-${char.id}.${getFileExtension(char.imageUrl)}`;
            const filepath = path.join(assetsDir, filename);
            await downloadFile(char.imageUrl, filepath);
            downloaded.characters[char.id] = filepath;
          } catch (err) {
            console.warn(`⚠️  Failed to download character ${char.id}:`, err.message);
          }
        }
      }
    }

    // Download UI element images
    if (scene.ui_elements) {
      for (const element of scene.ui_elements) {
        const elId = element.id || `ui-${scene.ui_elements.indexOf(element)}`;
        if (element.imageUrl && !downloaded.uiElements[elId]) {
          try {
            const filename = `ui-${elId}.${getFileExtension(element.imageUrl)}`;
            const filepath = path.join(assetsDir, filename);
            await downloadFile(element.imageUrl, filepath);
            downloaded.uiElements[elId] = filepath;
          } catch (err) {
            console.warn(`⚠️  Failed to download UI element ${elId}:`, err.message);
          }
        }
      }
    }
  }

  const bgCount = Object.keys(downloaded.backgrounds).length;
  const charCount = Object.keys(downloaded.characters).length;
  const uiCount = Object.keys(downloaded.uiElements).length;
  console.log(`   📦 Downloaded ${bgCount} backgrounds, ${charCount} characters, ${uiCount} UI elements`);

  return downloaded;
}

/**
 * Download a file from URL to local path
 */
async function downloadFile(url, filepath) {
  // Handle S3 signed URLs, absolute URLs, and relative paths
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });
  await fs.writeFile(filepath, response.data);
}

/**
 * Get file extension from URL
 */
function getFileExtension(url) {
  const match = url.match(/\.([^./?#]+)(?:[?#]|$)/);
  return match ? match[1] : 'png';
}

// ============================================================================
// SCENE FRAME RENDERER (Canvas compositing)
// ============================================================================

/**
 * Draw an image with CSS object-fit: cover behaviour (fill + crop, centred).
 * Draws on ctx at (dx, dy) filling (dw, dh), cropping source as needed.
 */
function drawImageCover(ctx, img, dx, dy, dw, dh) {
  const srcAR = img.width / img.height;
  const dstAR = dw / dh;
  let sx, sy, sw, sh;
  if (srcAR > dstAR) {
    // Source is wider → crop sides
    sh = img.height;
    sw = img.height * dstAR;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    // Source is taller → crop top/bottom
    sw = img.width;
    sh = img.width / dstAR;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/**
 * Draw an image with CSS object-fit: contain behaviour (fit inside, centred).
 * Draws on ctx centred at (cx, cy) fitting within (maxW, maxH), preserving aspect ratio.
 */
function drawImageContain(ctx, img, cx, cy, maxW, maxH) {
  const srcAR = img.width / img.height;
  const boxAR = maxW / maxH;
  let drawW, drawH;
  if (srcAR > boxAR) {
    // Image is wider than box → width-limited
    drawW = maxW;
    drawH = maxW / srcAR;
  } else {
    // Image is taller than box → height-limited
    drawH = maxH;
    drawW = maxH * srcAR;
  }
  ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
}

/**
 * Render each scene as a PNG frame with characters and UI elements composited
 */
async function renderSceneFrames(scenes, downloadedAssets, platform, timeline, jobDir) {
  const framesDir = path.join(jobDir, 'frames');
  await fs.mkdir(framesDir, { recursive: true });

  const sceneFrames = [];
  const width = platform.width || 1920;
  const height = platform.height || 1080;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const outputPath = path.join(framesDir, `scene-${String(i).padStart(4, '0')}.png`);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Draw background (object-fit: cover — fill and crop, no stretching)
    if (scene.background_url && downloadedAssets.backgrounds[scene.id]) {
      try {
        const bgImage = await loadImage(downloadedAssets.backgrounds[scene.id]);
        drawImageCover(ctx, bgImage, 0, 0, width, height);
      } catch {
        drawDefaultBackground(ctx, width, height);
      }
    } else {
      drawDefaultBackground(ctx, width, height);
    }

    // 2. Draw characters — scale from stage-pixel sizes to export resolution
    const refHeight = Math.round(STAGE_REFERENCE_WIDTH * height / width);

    if (scene.characters) {
      for (const char of scene.characters) {
        if (char.imageUrl && downloadedAssets.characters[char.id]) {
          try {
            const charImage = await loadImage(downloadedAssets.characters[char.id]);

            const x = parsePosition(char.position?.x, width);
            const y = parsePosition(char.position?.y, height);

            // Scale character size from stage pixels to export pixels
            const charStageW = parseInt(char.width) || 100;
            const charStageH = parseInt(char.height) || 150;
            const drawW = (charStageW / STAGE_REFERENCE_WIDTH) * width;
            const drawH = (charStageH / refHeight) * height;

            // Apply keyframe transforms if present
            const transform = getKeyframeTransform(scene.id, char.id, 0, timeline);

            ctx.save();
            ctx.translate(x, y);
            if (transform.rotation) ctx.rotate((transform.rotation * Math.PI) / 180);
            if (transform.scale) ctx.scale(transform.scale, transform.scale);
            ctx.globalAlpha = transform.opacity ?? 1.0;

            // Draw centered at scaled size (contain — preserve aspect ratio)
            drawImageContain(ctx, charImage, 0, 0, drawW, drawH);

            ctx.restore();
          } catch (err) {
            console.warn(`⚠️  Failed to draw character ${char.id}:`, err.message);
          }
        }
      }
    }

    // 3. Draw UI elements (labels, buttons, overlays, images)
    if (scene.ui_elements) {
      for (const element of scene.ui_elements) {
        const elId = element.id || `ui-${scene.ui_elements.indexOf(element)}`;

        // UI elements with images
        if (element.imageUrl && downloadedAssets.uiElements?.[elId]) {
          try {
            const uiImage = await loadImage(downloadedAssets.uiElements[elId]);
            const ux = parsePosition(element.position?.x, width);
            const uy = parsePosition(element.position?.y, height);

            const uiStageW = parseInt(element.width) || 120;
            const uiStageH = parseInt(element.height) || 120;
            const uiDrawW = (uiStageW / STAGE_REFERENCE_WIDTH) * width;
            const uiDrawH = (uiStageH / refHeight) * height;

            drawImageContain(ctx, uiImage, ux, uy, uiDrawW, uiDrawH);
          } catch (err) {
            console.warn(`⚠️  Failed to draw UI element image ${elId}:`, err.message);
          }
        } else {
          // Text / box UI elements
          drawUIElement(ctx, element, width, height, refHeight);
        }
      }
    }

    // Save frame as PNG
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(outputPath, buffer);

    sceneFrames.push({
      path: outputPath,
      duration: parseFloat(scene.duration_seconds) || 5.0,
      sceneId: scene.id,
    });
  }

  console.log(`   🖼️  Rendered ${sceneFrames.length} scene frames`);
  return sceneFrames;
}

/**
 * Draw default dark background when no image is available
 */
function drawDefaultBackground(ctx, width, height) {
  // Dark gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw a UI element (text label with optional background box)
 */
function drawUIElement(ctx, element, canvasWidth, canvasHeight, refHeight) {
  const x = parsePosition(element.position?.x, canvasWidth);
  const y = parsePosition(element.position?.y, canvasHeight);

  ctx.save();

  // Background box — scale from stage pixels to export resolution
  if (element.backgroundColor) {
    ctx.fillStyle = element.backgroundColor;
    const stageW = parseInt(element.width, 10) || 300;
    const stageH = parseInt(element.height, 10) || 50;
    const w = (stageW / STAGE_REFERENCE_WIDTH) * canvasWidth;
    const h = (stageH / refHeight) * canvasHeight;
    const r = parseInt(element.borderRadius, 10) || 8;
    roundRect(ctx, x - w / 2, y - h / 2, w, h, r);
    ctx.fill();
  }

  // Text label — scale font size proportionally
  if (element.label) {
    ctx.fillStyle = element.color || '#ffffff';
    const stageFontSize = parseInt(element.fontSize) || 24;
    const fontSize = Math.round((stageFontSize / STAGE_REFERENCE_WIDTH) * canvasWidth);
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(element.label, x, y);
  }

  ctx.restore();
}

/**
 * Parse position value (percentage string or pixel number) → pixels
 */
function parsePosition(position, dimension) {
  if (!position) return 0;
  if (typeof position === 'string' && position.endsWith('%')) {
    return Math.round((parseFloat(position) / 100) * dimension);
  }
  return parseInt(position, 10) || 0;
}

/**
 * Get keyframe transform for an element at a specific time
 * TODO: Full keyframe interpolation (lerp between keyframes)
 */
function getKeyframeTransform(sceneId, elementId, time, timeline) {
  if (!timeline?.keyframes || timeline.keyframes.length === 0) {
    return { x: 0, y: 0, scale: 1.0, rotation: 0, opacity: 1.0 };
  }

  // Find keyframes for this element
  const elementKeyframes = timeline.keyframes.filter(
    (kf) => kf.sceneId === sceneId && kf.elementId === elementId,
  );

  if (elementKeyframes.length === 0) {
    return { x: 0, y: 0, scale: 1.0, rotation: 0, opacity: 1.0 };
  }

  // Sort by time
  elementKeyframes.sort((a, b) => a.time - b.time);

  // Find surrounding keyframes for interpolation
  let prev = elementKeyframes[0];
  let next = elementKeyframes[elementKeyframes.length - 1];

  for (let i = 0; i < elementKeyframes.length - 1; i++) {
    if (elementKeyframes[i].time <= time && elementKeyframes[i + 1].time >= time) {
      prev = elementKeyframes[i];
      next = elementKeyframes[i + 1];
      break;
    }
  }

  // Interpolate (linear lerp)
  const range = next.time - prev.time;
  const t = range > 0 ? (time - prev.time) / range : 0;

  return {
    x: lerp(prev.x || 0, next.x || 0, t),
    y: lerp(prev.y || 0, next.y || 0, t),
    scale: lerp(prev.scale ?? 1, next.scale ?? 1, t),
    rotation: lerp(prev.rotation || 0, next.rotation || 0, t),
    opacity: lerp(prev.opacity ?? 1, next.opacity ?? 1, t),
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Draw rounded rectangle path
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// ============================================================================
// FFMPEG VIDEO RENDERER
// ============================================================================

/**
 * Render scene frames into a video using FFmpeg concat demuxer
 */
async function renderVideo(sceneFrames, timeline, platform, outputPath, onProgress) {
  // Write FFmpeg concat file
  const concatLines = [];
  for (const frame of sceneFrames) {
    // Escape single quotes in path for FFmpeg
    const safePath = frame.path.replace(/\\/g, '/').replace(/'/g, "'\\''");
    concatLines.push(`file '${safePath}'`);
    concatLines.push(`duration ${frame.duration}`);
  }
  // Repeat last frame (FFmpeg concat demuxer needs this to apply the last duration)
  if (sceneFrames.length > 0) {
    const last = sceneFrames[sceneFrames.length - 1];
    concatLines.push(`file '${last.path.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
  }

  const concatPath = path.join(path.dirname(outputPath), 'concat.txt');
  await fs.writeFile(concatPath, concatLines.join('\n'));

  const quality = process.env.EXPORT_VIDEO_QUALITY || 'high';
  const crf = QUALITY_CRF[quality] ?? 18;
  const width = platform.width || 1920;
  const height = platform.height || 1080;

  return new Promise((resolve, reject) => {
    const command = ffmpeg()
      .input(concatPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'medium',
        `-crf`, String(crf),
        '-pix_fmt', 'yuv420p',
        `-s`, `${width}x${height}`,
        '-r', '30',
        '-movflags', '+faststart', // Stream-friendly MP4
      ]);

    // TODO: Add audio mixing when timeline.audioClips is populated

    // Calculate total duration for progress
    const totalDuration = sceneFrames.reduce((sum, f) => sum + f.duration, 0);

    command.on('progress', (progress) => {
      if (progress.percent) {
        onProgress(Math.min(progress.percent, 100));
      } else if (progress.timemark && totalDuration > 0) {
        // Parse timemark HH:MM:SS.ms
        const parts = progress.timemark.split(':');
        const seconds =
          parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
        onProgress(Math.min((seconds / totalDuration) * 100, 100));
      }
    });

    command.on('end', () => {
      console.log(`   ✅ FFmpeg render complete → ${outputPath}`);
      resolve();
    });

    command.on('error', (err) => {
      console.error('   ❌ FFmpeg error:', err.message);
      reject(err);
    });

    command.save(outputPath);
  });
}

// ============================================================================
// S3 UPLOADER
// ============================================================================

/**
 * Upload rendered video to S3 and return the public URL
 */
async function uploadToS3(filePath, episodeId) {
  const fileContent = await fs.readFile(filePath);
  const stats = await fs.stat(filePath);
  const timestamp = Date.now();
  const key = `exports/${episodeId}/${timestamp}.mp4`;

  console.log(`   📤 Uploading ${(stats.size / (1024 * 1024)).toFixed(1)}MB to s3://${S3_BUCKET}/${key}`);

  const result = await s3
    .upload({
      Bucket: S3_BUCKET,
      Key: key,
      Body: fileContent,
      ContentType: 'video/mp4',
    })
    .promise();

  console.log(`   ✅ Upload complete: ${result.Location}`);
  return result.Location;
}

// ============================================================================
// STARTUP
// ============================================================================

console.log('🎬 Video renderer worker started');
console.log(`   Temp dir: ${TEMP_DIR}`);
console.log(`   S3 bucket: ${S3_BUCKET}`);
console.log(`   Quality: ${process.env.EXPORT_VIDEO_QUALITY || 'high'}`);
console.log(`   Max concurrent: ${process.env.EXPORT_MAX_CONCURRENT_JOBS || 2}`);

module.exports = { videoQueue };
