'use strict';

/**
 * Segmentation Service — SAM (Segment Anything Model) via Replicate
 *
 * Provides click-to-segment: user clicks on an object in the image,
 * SAM returns a precise mask of that object. Used by the erase tool
 * for "Smart Select" mode.
 */

const Replicate = require('replicate');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60; // 2 min timeout

// SAM model for click-to-segment
// meta/sam-2 is automatic-only (generates masks for ALL objects, ignores point prompts).
// Strategy: run automatic segmentation, then pick the mask containing the clicked pixel.
const SAM2_MODEL = 'meta/sam-2';
let SAM_MODEL = process.env.REPLICATE_SAM_MODEL || SAM2_MODEL;
const GROUNDED_SAM_MODEL = process.env.REPLICATE_GROUNDED_SAM_MODEL || SAM2_MODEL;

// Override known-dead or non-existent models
const DEAD_MODELS = ['meta/sam-2-large', 'schananas/grounded_sam', 'meta/sam-2-video'];
if (DEAD_MODELS.some((m) => SAM_MODEL === m || SAM_MODEL.startsWith(m + ':'))) {
  console.warn(`[Segmentation] REPLICATE_SAM_MODEL="${SAM_MODEL}" does not exist on Replicate. Using ${SAM2_MODEL}`);
  SAM_MODEL = SAM2_MODEL;
}

console.log(`[Segmentation] Loaded — SAM_MODEL=${SAM_MODEL}, GROUNDED_SAM=${GROUNDED_SAM_MODEL}, TOKEN=${REPLICATE_API_TOKEN ? 'set' : 'MISSING'}`);

/**
 * Extract output URL from Replicate output (handles various formats).
 */
function extractOutputUrl(output) {
  if (!output) return null;
  if (typeof output === 'string') return output;
  if (output instanceof URL) return output.toString();
  if (Array.isArray(output)) {
    for (const item of output) {
      const url = extractOutputUrl(item);
      if (url) return url;
    }
    return null;
  }
  if (typeof output.url === 'function') {
    const resolved = output.url();
    if (resolved instanceof URL) return resolved.toString();
    if (typeof resolved === 'string') return resolved;
  }
  if (typeof output.url === 'string') return output.url;
  for (const key of ['combined_mask', 'mask', 'masks', 'output_image', 'image', 'output']) {
    if (output[key]) {
      const url = extractOutputUrl(output[key]);
      if (url) return url;
    }
  }
  if (typeof output.toString === 'function' && output.toString !== Object.prototype.toString) {
    const resolved = output.toString();
    if (/^https?:\/\//i.test(resolved)) return resolved;
  }
  return null;
}

/**
 * Get image dimensions from a remote URL.
 */
async function getImageDimensions(imageUrl) {
  const sharp = require('sharp');
  const axios = require('axios');
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000 });
  const metadata = await sharp(Buffer.from(response.data)).metadata();
  return { width: metadata.width, height: metadata.height };
}

/**
 * From an array of mask URLs, pick the smallest mask that contains the clicked pixel.
 * Downloads each mask, checks the pixel at (x,y), and returns the best match.
 */
async function pickMaskAtPoint(maskUrls, clickX, clickY, imgWidth, imgHeight) {
  const sharp = require('sharp');
  const axios = require('axios');

  let bestMask = null;
  let bestSize = Infinity;

  for (const url of maskUrls) {
    try {
      const maskUrl = typeof url === 'string' ? url
        : (url instanceof URL ? url.toString() : extractOutputUrl(url));
      if (!maskUrl) continue;

      const resp = await axios.get(maskUrl, { responseType: 'arraybuffer', timeout: 15000 });
      const { data, info } = await sharp(Buffer.from(resp.data))
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Map click coords to mask pixel (mask may be different resolution)
      const mx = Math.round(clickX * info.width / imgWidth);
      const my = Math.round(clickY * info.height / imgHeight);
      const idx = my * info.width + mx;

      if (idx < 0 || idx >= data.length) continue;

      const pixelValue = data[idx];
      const isClickInMask = pixelValue > 128;

      if (!isClickInMask) continue;

      // Count mask size (white pixels)
      let maskPixels = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i] > 128) maskPixels++;
      }

      // Pick the smallest mask containing the click (most specific object)
      if (maskPixels < bestSize) {
        bestSize = maskPixels;
        bestMask = maskUrl;
      }
      console.log(`[Segmentation] Mask candidate: ${maskPixels} px (${Math.round(maskPixels / data.length * 100)}%), click pixel=${pixelValue}`);
    } catch (err) {
      console.warn('[Segmentation] Failed to check mask:', err.message);
    }
  }

  if (bestMask) {
    console.log(`[Segmentation] Best mask: ${bestSize} px`);
  }
  return bestMask;
}

/**
 * Segment an object in an image using SAM, given one or more points.
 *
 * @param {string} imageUrl - URL of the image to segment
 * @param {Array<{x:number,y:number,label?:number}>} points - Normalized points (0-1), label 1=include, 0=exclude
 * @param {string} entityId - Scene/entity ID for rate limiting context
 * @returns {Promise<{maskUrl: string}>} - URL of the generated mask (white = selected, black = background)
 */
async function segmentWithPoints(imageUrl, points, entityId, knownDims) {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

  // Get image dimensions to convert normalized coords to pixel coords.
  // Prefer frontend-provided dimensions (always available from backgroundLayout)
  // over fetching the image (which can fail and default to wrong 1024x1024).
  let imgWidth = knownDims?.width || 1920;
  let imgHeight = knownDims?.height || 1080;
  if (!knownDims) {
    try {
      const dims = await getImageDimensions(imageUrl);
      imgWidth = dims.width;
      imgHeight = dims.height;
    } catch (dimErr) {
      console.warn('[Segmentation] Could not get image dimensions, using canvas defaults:', dimErr.message);
    }
  }

  const normalizedPoints = Array.isArray(points) ? points : [];
  const pixelPoints = normalizedPoints
    .map((p) => {
      const nx = Number(p?.x);
      const ny = Number(p?.y);
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
      const clampedX = Math.max(0, Math.min(1, nx));
      const clampedY = Math.max(0, Math.min(1, ny));
      return {
        x: Math.round(clampedX * imgWidth),
        y: Math.round(clampedY * imgHeight),
        label: Number.isFinite(Number(p?.label)) ? (Number(p.label) === 0 ? 0 : 1) : 1,
      };
    })
    .filter(Boolean);

  if (!pixelPoints.length) {
    throw new Error('No valid segmentation points provided');
  }

  const pointSummary = pixelPoints.map((p) => `${p.label ? '+' : '-'}(${p.x},${p.y})`).join(', ');
  console.log(`[Segmentation] SAM segment with ${pixelPoints.length} point(s): ${pointSummary} on ${imgWidth}x${imgHeight} using ${SAM_MODEL}`);
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 4000, 8000];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1] || 8000;
      console.log(`[Segmentation] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      // Try multiple input formats depending on the model
      let output;
      const modelLower = SAM_MODEL.toLowerCase();
    const firstPositive = pixelPoints.find((p) => p.label === 1) || pixelPoints[0];

    if (modelLower.includes('grounded_sam') || modelLower.includes('grounded-sam')) {
      output = await replicate.run(SAM_MODEL, {
        input: {
          image: imageUrl,
          input_point: `[${firstPositive.x}, ${firstPositive.y}]`,
          input_label: '[1]',
        },
      });
    } else {
      // meta/sam-2 automatic mode: generate all masks, then pick the one at the click point.
      console.log(`[Segmentation] SAM-2 automatic mode: model=${SAM_MODEL}, click=(${firstPositive.x},${firstPositive.y}) on ${imgWidth}x${imgHeight}`);
      output = await replicate.run(SAM_MODEL, {
        input: {
          image: imageUrl,
          use_m2m: true,
          multimask_output: true,
        },
      });
      console.log(`[Segmentation] SAM-2 output type: ${typeof output}, keys: ${output && typeof output === 'object' ? Object.keys(output).join(',') : 'N/A'}`);

      // Extract individual masks and pick the one containing the click point
      if (output && typeof output === 'object' && output.individual_masks) {
        const masks = Array.isArray(output.individual_masks) ? output.individual_masks : [output.individual_masks];
        console.log(`[Segmentation] SAM-2 returned ${masks.length} individual masks, checking click point...`);
        const bestMaskUrl = await pickMaskAtPoint(masks, firstPositive.x, firstPositive.y, imgWidth, imgHeight);
        if (bestMaskUrl) {
          const { s3Url, inverted } = await storeMaskToS3(bestMaskUrl, entityId);
          console.log('[Segmentation] Selected mask at click point, inverted:', inverted);
          return { maskUrl: s3Url, inverted };
        }
        console.warn('[Segmentation] No mask contains the click point, falling through to combined_mask');
      }
    }

    // SAM-2 returns { combined_mask, individual_masks[] }.
      // Prefer individual_masks[0] (the clicked object) over combined_mask (which can have inverted polarity).
      let maskUrl;
      if (output && typeof output === 'object' && !Array.isArray(output)) {
        const keys = [];
        for (const k of Object.keys(output)) { keys.push(k); }
        console.log('[Segmentation] SAM output keys:', keys.join(', '));

        // Try individual_masks first — this is the per-object mask with correct polarity
        if (output.individual_masks) {
          const masks = output.individual_masks;
          const firstMask = Array.isArray(masks) ? masks[0] : masks;
          maskUrl = extractOutputUrl(firstMask);
          if (maskUrl) console.log('[Segmentation] Using individual_masks[0]');
        }
        // Fall back to combined_mask
        if (!maskUrl && output.combined_mask) {
          maskUrl = extractOutputUrl(output.combined_mask);
          if (maskUrl) console.log('[Segmentation] Using combined_mask');
        }
      }
      // Generic fallback for other model output formats
      if (!maskUrl) {
        maskUrl = extractOutputUrl(output);
      }

      if (!maskUrl) {
        console.error('[Segmentation] SAM returned no output URL. Raw:', typeof output, JSON.stringify(output).slice(0, 500));
        throw new Error('SAM returned no mask output — the model may not support point-based segmentation');
      }

      console.log('[Segmentation] SAM mask URL obtained:', maskUrl.slice(0, 100));

      // Store mask to S3 for persistence
      const { s3Url, inverted } = await storeMaskToS3(maskUrl, entityId);
      console.log('[Segmentation] Mask stored to S3, inverted:', inverted);
      return { maskUrl: s3Url, inverted };
    } catch (err) {
      const status = err.response?.status || err.status;
      const detail = err.response?.data?.detail || err.message;

      const isRateLimit = status === 429 || /rate[-\s]?limit|throttled/i.test(String(detail));
      if (isRateLimit && attempt < MAX_RETRIES) {
        console.warn(`[Segmentation] Rate-limited (attempt ${attempt + 1}), will retry...`);
        continue;
      }

      if (isRateLimit) {
        console.error(`[Segmentation] Rate-limited after ${MAX_RETRIES} retries`);
        const limitError = new Error('Segmentation provider is rate-limited. Please try again in a few seconds.');
        limitError.status = 429;
        limitError.retryAfter = 8;
        throw limitError;
      }

      // For any other error (model unavailable, invalid input, prediction failed),
      // fall back to alternative model, then to a simple click mask as last resort.
      console.error(`[Segmentation] SAM error (${status || 'unknown'}):`, detail);

      // Try meta/sam-2 automatic mode as fallback (auto-segmentation is better than a circle).
      // Note: meta/sam-2 is automatic-only and ignores point coords, but it will segment
      // prominent objects which is better than the circle approximation.
      const fallbackImageModel = GROUNDED_SAM_MODEL || SAM2_IMAGE_MODEL;
      if (fallbackImageModel) {
        try {
          console.warn(`[Segmentation] Trying automatic fallback: ${fallbackImageModel}`);
          const fallbackOutput = await replicate.run(fallbackImageModel, {
            input: {
              image: imageUrl,
            },
          });
          const fallbackMaskUrl = extractOutputUrl(fallbackOutput);
          if (fallbackMaskUrl) {
            console.log(`[Segmentation] Automatic fallback succeeded`);
            const { s3Url, inverted } = await storeMaskToS3(fallbackMaskUrl, entityId);
            return { maskUrl: s3Url, inverted, fallback: true, fallback_reason: 'Used automatic segmentation' };
          }
        } catch (fallbackErr) {
          console.warn(`[Segmentation] Automatic fallback also failed:`, fallbackErr.message);
        }
      }

      const fallbackReason = `${SAM_MODEL} failed: ${String(detail).slice(0, 200)}`;
      console.warn('[Segmentation] All SAM models failed, using fallback click mask.', fallbackReason);
      const fallbackUrl = await createFallbackClickMask(pixelPoints, imgWidth, imgHeight, entityId);
      return { maskUrl: fallbackUrl, fallback: true, fallback_reason: fallbackReason };
    }
  } // end retry loop
}

async function createFallbackClickMask(pixelPoints, width, height, entityId) {
  const sharp = require('sharp');

  const safeW = Math.max(64, Number(width) || 1024);
  const safeH = Math.max(64, Number(height) || 1024);
  const radius = Math.max(24, Math.round(Math.min(safeW, safeH) * 0.08));
  const fallbackPoints = Array.isArray(pixelPoints) ? pixelPoints : [];

  const circles = fallbackPoints.map((pt) => {
    const cx = Math.max(0, Math.min(safeW - 1, Number(pt?.x) || Math.round(safeW / 2)));
    const cy = Math.max(0, Math.min(safeH - 1, Number(pt?.y) || Math.round(safeH / 2)));
    const fill = Number(pt?.label) === 0 ? 'black' : 'white';
    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}"/>`;
  }).join('');

  const svg = `
    <svg width="${safeW}" height="${safeH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="black"/>
      ${circles || `<circle cx="${Math.round(safeW / 2)}" cy="${Math.round(safeH / 2)}" r="${radius}" fill="white"/>`}
    </svg>
  `;

  const maskBuffer = await sharp(Buffer.from(svg))
    .blur(2)
    .png()
    .toBuffer();

  const ts = Date.now();
  const uid = uuidv4().slice(0, 8);
  const s3Key = `scene-studio/${entityId}/masks/${ts}-${uid}-fallback-mask.png`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: maskBuffer,
    ContentType: 'image/png',
    CacheControl: 'max-age=86400',
  }));

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

async function segmentAtPoint(imageUrl, pointX, pointY, entityId, knownDims) {
  return segmentWithPoints(imageUrl, [{ x: pointX, y: pointY, label: 1 }], entityId, knownDims);
}

/**
 * Store a mask image from a URL to S3.
 * Returns { s3Url, inverted } — inverted=true when mask has opposite polarity (white=background).
 */
async function storeMaskToS3(maskUrl, entityId) {
  const sharp = require('sharp');
  const axios = require('axios');
  const response = await axios.get(maskUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const buffer = Buffer.from(response.data);

  // Check if mask polarity is inverted (more white than black = background selected)
  let inverted = false;
  try {
    const { data, info } = await sharp(buffer).grayscale().raw().toBuffer({ resolveWithObject: true });
    let whiteCount = 0;
    const totalPixels = info.width * info.height;
    for (let i = 0; i < data.length; i++) {
      if (data[i] > 128) whiteCount++;
    }
    inverted = whiteCount > totalPixels * 0.5;
    if (inverted) {
      console.log(`[Segmentation] Mask is inverted (${Math.round(whiteCount / totalPixels * 100)}% white), flagging for frontend`);
    }
  } catch (checkErr) {
    console.warn('[Segmentation] Could not check mask polarity:', checkErr.message);
  }

  const ts = Date.now();
  const uid = uuidv4().slice(0, 8);
  const s3Key = `scene-studio/${entityId}/masks/${ts}-${uid}-sam-mask.png`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: buffer,
    ContentType: 'image/png',
    CacheControl: 'max-age=86400',
  }));

  return { s3Url: `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`, inverted };
}

/**
 * Backward-compatible wrapper for multi-point segmentation.
 *
 * @param {string} imageUrl - URL of the image
 * @param {Array<{x: number, y: number}>} points - Normalized coords (0-1)
 * @param {Array<number>} labels - 1 = include, 0 = exclude
 * @param {string} entityId - Scene/entity ID
 */
async function segmentMultiPoint(imageUrl, points, labels, entityId, knownDims) {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

  let imgWidth = knownDims?.width || 1920;
  let imgHeight = knownDims?.height || 1080;
  if (!knownDims) {
    try {
      const dims = await getImageDimensions(imageUrl);
      imgWidth = dims.width;
      imgHeight = dims.height;
    } catch (dimErr) {
      console.warn('[Segmentation] Could not get image dimensions, using canvas defaults:', dimErr.message);
    }
  }

  // Convert normalized coords to pixel coords
  const pixelPoints = points.map((p) => [
    Math.round(p.x * imgWidth),
    Math.round(p.y * imgHeight),
  ]);

  console.log(`[Segmentation] Multi-point SAM: ${points.length} points (labels: ${labels.join(',')}) using ${SAM_MODEL}`);

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 4000, 8000];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1] || 8000;
      console.log(`[Segmentation] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      let output;
      const modelLower = SAM_MODEL.toLowerCase();

      if (modelLower.includes('grounded_sam') || modelLower.includes('grounded-sam')) {
        // grounded_sam may not support multi-point natively.
        // Try multi-point format first, fall back to last include point.
        try {
          output = await replicate.run(SAM_MODEL, {
            input: {
              image: imageUrl,
              input_point: JSON.stringify(pixelPoints),
              input_label: JSON.stringify(labels),
            },
          });
        } catch (multiErr) {
          console.warn('[Segmentation] Multi-point failed for grounded_sam, falling back to last include point:', multiErr.message);
          // Find the last include point (label=1)
          let lastIncludeIdx = -1;
          for (let i = labels.length - 1; i >= 0; i--) {
            if (labels[i] === 1) { lastIncludeIdx = i; break; }
          }
          if (lastIncludeIdx === -1) throw new Error('No include points provided');
          const pt = pixelPoints[lastIncludeIdx];
          output = await replicate.run(SAM_MODEL, {
            input: {
              image: imageUrl,
              input_point: `[${pt[0]}, ${pt[1]}]`,
              input_label: '[1]',
            },
          });
        }
      } else if (modelLower.includes('sam-2') || modelLower.includes('sam2')) {
        // SAM-2 automatic mode with click-point mask selection
        const firstInclude = pixelPoints.find((_, i) => labels[i] === 1) || pixelPoints[0];
        const firstIncludeIdx = pixelPoints.indexOf(firstInclude);
        console.log(`[Segmentation] Multi-point SAM-2 auto: picking mask at (${firstInclude[0]},${firstInclude[1]})`);
        output = await replicate.run(SAM_MODEL, {
          input: { image: imageUrl, use_m2m: true, multimask_output: true },
        });
        if (output && typeof output === 'object' && output.individual_masks) {
          const masks = Array.isArray(output.individual_masks) ? output.individual_masks : [output.individual_masks];
          const bestMaskUrl = await pickMaskAtPoint(masks, firstInclude[0], firstInclude[1], imgWidth, imgHeight);
          if (bestMaskUrl) {
            const { s3Url, inverted } = await storeMaskToS3(bestMaskUrl, entityId);
            return { maskUrl: s3Url, inverted };
          }
        }
      } else {
        // Flatten for models expecting comma-separated format
        output = await replicate.run(SAM_MODEL, {
          input: {
            image: imageUrl,
            point_coords: pixelPoints.map((p) => p.join(',')).join(';'),
            point_labels: labels.join(','),
          },
        });
      }

      const maskUrl = extractOutputUrl(output);
      if (!maskUrl) {
        console.error('[Segmentation] Multi-point SAM returned no output. Output:', JSON.stringify(output).slice(0, 500));
        throw new Error('SAM returned no mask output');
      }

      console.log('[Segmentation] Multi-point mask generated successfully');
      const { s3Url, inverted } = await storeMaskToS3(maskUrl, entityId);
      return { maskUrl: s3Url, inverted };
    } catch (err) {
      const status = err.response?.status || err.status;
      const detail = err.response?.data?.detail || err.message;

      const isRateLimit = status === 429 || /rate[-\s]?limit|throttled/i.test(String(detail));
      if (isRateLimit && attempt < MAX_RETRIES) {
        console.warn(`[Segmentation] Rate-limited (attempt ${attempt + 1}), will retry...`);
        continue;
      }

      if (isRateLimit) {
        const limitError = new Error('Segmentation provider is rate-limited. Please try again in a few seconds.');
        limitError.status = 429;
        limitError.retryAfter = 8;
        throw limitError;
      }

      // For any other error, fall back to grounded_sam with last include point
      console.error(`[Segmentation] Multi-point SAM error (${status || 'unknown'}):`, detail);
      let lastIncludeIdx = -1;
      for (let i = labels.length - 1; i >= 0; i--) {
        if (labels[i] === 1) { lastIncludeIdx = i; break; }
      }
      if (lastIncludeIdx >= 0) {
        const pt = pixelPoints[lastIncludeIdx];
        try {
          console.warn(`[Segmentation] Falling back to ${GROUNDED_SAM_MODEL} with single point`);
          const fallbackOutput = await replicate.run(GROUNDED_SAM_MODEL, {
            input: {
              image: imageUrl,
              input_point: `[${pt[0]}, ${pt[1]}]`,
              input_label: '[1]',
            },
          });
          const fallbackMaskUrl = extractOutputUrl(fallbackOutput);
          if (fallbackMaskUrl) {
            console.log('[Segmentation] Grounded SAM fallback succeeded');
            const { s3Url, inverted } = await storeMaskToS3(fallbackMaskUrl, entityId);
            return { maskUrl: s3Url, inverted };
          }
        } catch (fallbackErr) {
          console.warn('[Segmentation] Grounded SAM fallback also failed:', fallbackErr.message);
        }
      }
      throw new Error(`SAM segmentation failed: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    }
  }
}

/**
 * Segment an object by text description using Grounded SAM.
 *
 * @param {string} imageUrl - URL of the image
 * @param {string} textPrompt - Description of the object to find (e.g. "the lamp", "pink rug")
 * @param {string} entityId - Scene/entity ID
 * @returns {Promise<{maskUrl: string}>}
 */
async function segmentByText(imageUrl, textPrompt, entityId) {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });
  // Text-based detection requires a Grounded SAM model that supports text_prompt.
  // meta/sam-2 does NOT support text prompts — only point-based segmentation.
  const textModel = GROUNDED_SAM_MODEL;
  const modelLower = textModel.toLowerCase();
  if (modelLower.includes('sam-2') || modelLower.includes('sam2')) {
    throw new Error('Text-based "Find" requires a Grounded SAM model (set REPLICATE_GROUNDED_SAM_MODEL). The current model only supports click-to-select.');
  }
  console.log(`[Segmentation] Text-based segment: "${textPrompt}" using ${textModel}`);

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 4000, 8000];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1] || 8000;
      console.log(`[Segmentation] Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const output = await replicate.run(textModel, {
        input: {
          image: imageUrl,
          text_prompt: textPrompt,
        },
      });

      console.log('[Segmentation] Text SAM raw output type:', typeof output,
        Array.isArray(output) ? `array[${output.length}]` : '');

      const maskUrl = extractOutputUrl(output);
      if (!maskUrl) {
        console.error('[Segmentation] Text SAM returned no output. Output:', JSON.stringify(output).slice(0, 500));
        throw new Error('Could not find that object in the image. Try a different description.');
      }

      console.log('[Segmentation] Text-based mask generated successfully');
      const { s3Url, inverted } = await storeMaskToS3(maskUrl, entityId);
      return { maskUrl: s3Url, inverted };
    } catch (err) {
      const status = err.response?.status || err.status;
      const detail = err.response?.data?.detail || err.message;

      const isRateLimit = status === 429 || /rate[-\s]?limit|throttled/i.test(String(detail));
      if (isRateLimit && attempt < MAX_RETRIES) {
        console.warn(`[Segmentation] Rate-limited (attempt ${attempt + 1}), will retry...`);
        continue;
      }

      if (isRateLimit) {
        const limitError = new Error('Segmentation provider is rate-limited. Please try again in a few seconds.');
        limitError.status = 429;
        limitError.retryAfter = 8;
        throw limitError;
      }

      console.error(`[Segmentation] Text SAM error (${status}):`, detail);
      throw new Error(`Smart find failed: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    }
  }
}

module.exports = {
  segmentAtPoint,
  segmentWithPoints,
  segmentMultiPoint,
  segmentByText,
};
