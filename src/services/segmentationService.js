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

// SAM 2 model — Meta's Segment Anything Model
const SAM_MODEL = process.env.REPLICATE_SAM_MODEL || 'meta/sam-2-base';

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
  for (const key of ['combined_mask', 'mask', 'masks', 'image', 'output']) {
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
 * Segment an object in an image using SAM, given a click point.
 *
 * @param {string} imageUrl - URL of the image to segment
 * @param {number} pointX - X coordinate of the click (0-1 normalized)
 * @param {number} pointY - Y coordinate of the click (0-1 normalized)
 * @param {string} entityId - Scene/entity ID for rate limiting context
 * @returns {Promise<{maskUrl: string}>} - URL of the generated mask (white = selected, black = background)
 */
async function segmentAtPoint(imageUrl, pointX, pointY, entityId) {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  console.log(`[Segmentation] SAM segment at (${pointX.toFixed(3)}, ${pointY.toFixed(3)})`);
  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

  try {
    const output = await replicate.run(SAM_MODEL, {
      input: {
        image: imageUrl,
        point_coords: `${pointX},${pointY}`,
        point_labels: '1', // 1 = foreground point
      },
    });

    const maskUrl = extractOutputUrl(output);
    if (!maskUrl) {
      console.error('[Segmentation] SAM returned no output URL. Output:', JSON.stringify(output).slice(0, 500));
      throw new Error('SAM returned no mask output');
    }

    console.log('[Segmentation] SAM mask generated successfully');

    // Store mask to S3 for persistence
    const s3Url = await storeMaskToS3(maskUrl, entityId);
    return { maskUrl: s3Url };
  } catch (err) {
    const status = err.response?.status || err.status;
    const detail = err.response?.data?.detail || err.message;
    console.error(`[Segmentation] SAM error (${status}):`, detail);

    if (status === 429 || /rate[-\s]?limit|throttled/i.test(String(detail))) {
      const limitError = new Error('Segmentation provider is rate-limited. Please try again in a few seconds.');
      limitError.status = 429;
      limitError.retryAfter = 8;
      throw limitError;
    }

    throw new Error(`SAM segmentation failed: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  }
}

/**
 * Store a mask image from a URL to S3.
 */
async function storeMaskToS3(maskUrl, entityId) {
  const axios = require('axios');
  const response = await axios.get(maskUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const buffer = Buffer.from(response.data);

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

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

module.exports = { segmentAtPoint };
