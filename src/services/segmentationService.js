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

// SAM model for click-to-segment (supports multi-point)
const SAM_MODEL = process.env.REPLICATE_SAM_MODEL || 'meta/sam-2-large';
// Grounded SAM for text-based object detection (text_prompt support)
const GROUNDED_SAM_MODEL = process.env.REPLICATE_GROUNDED_SAM_MODEL || 'schananas/grounded_sam';

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
 * Keep only the connected white mask component nearest to the click seed.
 * This reduces over-selection when SAM returns disconnected regions.
 */
async function isolateMaskComponent(maskBuffer, seedPoint) {
  if (!seedPoint || !Number.isFinite(seedPoint.x) || !Number.isFinite(seedPoint.y)) {
    return maskBuffer;
  }

  const sharp = require('sharp');
  const { data, info } = await sharp(maskBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels;

  if (!width || !height || channels < 4) {
    return maskBuffer;
  }

  const isSelected = (pixelIndex) => {
    const offset = pixelIndex * channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = data[offset + 3];
    const luminance = (r + g + b) / 3;
    return a > 16 && luminance > 127;
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const seedX = clamp(Math.round(seedPoint.x), 0, width - 1);
  const seedY = clamp(Math.round(seedPoint.y), 0, height - 1);

  let startX = seedX;
  let startY = seedY;
  let startIndex = startY * width + startX;

  if (!isSelected(startIndex)) {
    const maxRadius = Math.max(8, Math.round(Math.min(width, height) * 0.05));
    let found = false;

    for (let radius = 1; radius <= maxRadius && !found; radius++) {
      const minX = clamp(seedX - radius, 0, width - 1);
      const maxX = clamp(seedX + radius, 0, width - 1);
      const minY = clamp(seedY - radius, 0, height - 1);
      const maxY = clamp(seedY + radius, 0, height - 1);

      for (let y = minY; y <= maxY && !found; y++) {
        for (let x = minX; x <= maxX; x++) {
          const isBorder = x === minX || x === maxX || y === minY || y === maxY;
          if (!isBorder) continue;

          const idx = y * width + x;
          if (isSelected(idx)) {
            startX = x;
            startY = y;
            startIndex = idx;
            found = true;
            break;
          }
        }
      }
    }

    if (!found) {
      return maskBuffer;
    }
  }

  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const keep = new Uint8Array(totalPixels);
  const queue = [startIndex];
  visited[startIndex] = 1;

  const neighbors = [
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [1, -1], [-1, 1], [1, 1],
  ];

  while (queue.length) {
    const current = queue.pop();
    keep[current] = 1;
    const cx = current % width;
    const cy = Math.floor(current / width);

    for (const [dx, dy] of neighbors) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const nIdx = ny * width + nx;
      if (visited[nIdx]) continue;
      visited[nIdx] = 1;
      if (!isSelected(nIdx)) continue;
      queue.push(nIdx);
    }
  }

  let keptPixels = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (keep[i]) keptPixels += 1;
  }

  if (!keptPixels) {
    return maskBuffer;
  }

  const out = Buffer.alloc(totalPixels * 4);
  for (let i = 0; i < totalPixels; i++) {
    const offset = i * 4;
    if (keep[i]) {
      out[offset] = 255;
      out[offset + 1] = 255;
      out[offset + 2] = 255;
      out[offset + 3] = 255;
    } else {
      out[offset] = 0;
      out[offset + 1] = 0;
      out[offset + 2] = 0;
      out[offset + 3] = 0;
    }
  }

  console.log(`[Segmentation] Component filter kept ${keptPixels}/${totalPixels} pixels from click @ (${startX},${startY})`);

  return sharp(out, {
    raw: {
      width,
      height,
      channels: 4,
    },
  }).png().toBuffer();
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
 * Segment an object in an image using SAM, given one or more points.
 *
 * @param {string} imageUrl - URL of the image to segment
 * @param {Array<{x:number,y:number,label?:number}>} points - Normalized points (0-1), label 1=include, 0=exclude
 * @param {string} entityId - Scene/entity ID for rate limiting context
 * @returns {Promise<{maskUrl: string}>} - URL of the generated mask (white = selected, black = background)
 */
async function segmentWithPoints(imageUrl, points, entityId) {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

  // Get image dimensions to convert normalized coords to pixel coords
  let imgWidth = 1024;
  let imgHeight = 1024;
  try {
    const dims = await getImageDimensions(imageUrl);
    imgWidth = dims.width;
    imgHeight = dims.height;
  } catch (dimErr) {
    console.warn('[Segmentation] Could not get image dimensions, using defaults:', dimErr.message);
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
      // grounded_sam doesn't reliably support multi-point labels. Use the latest positive point.
      output = await replicate.run(SAM_MODEL, {
        input: {
          image: imageUrl,
          input_point: `[${firstPositive.x}, ${firstPositive.y}]`,
          input_label: '[1]',
        },
      });
    } else if (modelLower.includes('sam-2') || modelLower.includes('sam2')) {
      // SAM 2 supports true multi-point refinement with positive/negative labels.
      output = await replicate.run(SAM_MODEL, {
        input: {
          image: imageUrl,
          point_coords: pixelPoints.map((p) => [p.x, p.y]),
          point_labels: pixelPoints.map((p) => p.label),
          multimask_output: false,
        },
      });
    } else {
      // Default format for facebook/sam and similar models.
      output = await replicate.run(SAM_MODEL, {
        input: {
          image: imageUrl,
          point_coords: pixelPoints.map((p) => `${p.x},${p.y}`).join(';'),
          point_labels: pixelPoints.map((p) => p.label).join(','),
        },
      });
    }

    console.log('[Segmentation] SAM raw output type:', typeof output,
      Array.isArray(output) ? `array[${output.length}]` : '');

      const maskUrl = extractOutputUrl(output);
      if (!maskUrl) {
        console.error('[Segmentation] SAM returned no output URL. Output:', JSON.stringify(output).slice(0, 500));
        throw new Error('SAM returned no mask output — the model may not support point-based segmentation');
      }

      console.log('[Segmentation] SAM mask generated successfully');

      // Store mask to S3 for persistence and keep the component nearest click.
      const s3Url = await storeMaskToS3(maskUrl, entityId, { seedPoint: firstPositive });
      return { maskUrl: s3Url };
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
      // fall back to grounded_sam, then to a simple click mask as last resort.
      console.error(`[Segmentation] SAM error (${status || 'unknown'}):`, detail);
      if (SAM_MODEL !== GROUNDED_SAM_MODEL) {
        console.warn(`[Segmentation] Falling back to ${GROUNDED_SAM_MODEL}`);
        try {
          const firstPositive = pixelPoints.find((p) => p.label === 1) || pixelPoints[0];
          const fallbackOutput = await replicate.run(GROUNDED_SAM_MODEL, {
            input: {
              image: imageUrl,
              input_point: `[${firstPositive.x}, ${firstPositive.y}]`,
              input_label: '[1]',
            },
          });
          const fallbackMaskUrl = extractOutputUrl(fallbackOutput);
          if (fallbackMaskUrl) {
            console.log('[Segmentation] Grounded SAM fallback succeeded');
            const s3Url = await storeMaskToS3(fallbackMaskUrl, entityId, { seedPoint: firstPositive });
            return { maskUrl: s3Url };
          }
        } catch (fallbackErr) {
          console.warn('[Segmentation] Grounded SAM fallback also failed:', fallbackErr.message);
        }
      }

      console.warn('[Segmentation] All SAM models failed, using fallback click mask');
      const fallbackUrl = await createFallbackClickMask(pixelPoints, imgWidth, imgHeight, entityId);
      return { maskUrl: fallbackUrl, fallback: true };
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

async function segmentAtPoint(imageUrl, pointX, pointY, entityId) {
  return segmentWithPoints(imageUrl, [{ x: pointX, y: pointY, label: 1 }], entityId);
}

/**
 * Store a mask image from a URL to S3.
 */
async function storeMaskToS3(maskUrl, entityId, options = {}) {
  const axios = require('axios');
  const response = await axios.get(maskUrl, { responseType: 'arraybuffer', timeout: 30000 });
  let buffer = Buffer.from(response.data);

  if (options.seedPoint) {
    try {
      buffer = await isolateMaskComponent(buffer, options.seedPoint);
    } catch (filterErr) {
      console.warn('[Segmentation] Component filter failed, using raw mask:', filterErr.message);
    }
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

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

/**
 * Backward-compatible wrapper for multi-point segmentation.
 *
 * @param {string} imageUrl - URL of the image
 * @param {Array<{x: number, y: number}>} points - Normalized coords (0-1)
 * @param {Array<number>} labels - 1 = include, 0 = exclude
 * @param {string} entityId - Scene/entity ID
 */
async function segmentMultiPoint(imageUrl, points, labels, entityId) {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });

  let imgWidth = 1024;
  let imgHeight = 1024;
  try {
    const dims = await getImageDimensions(imageUrl);
    imgWidth = dims.width;
    imgHeight = dims.height;
  } catch (dimErr) {
    console.warn('[Segmentation] Could not get image dimensions, using defaults:', dimErr.message);
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
        output = await replicate.run(SAM_MODEL, {
          input: {
            image: imageUrl,
            point_coords: pixelPoints,
            point_labels: labels,
            multimask_output: false,
          },
        });
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
      let includeIdx = labels.findIndex((label) => Number(label) === 1);
      if (includeIdx < 0) includeIdx = 0;
      const seedPair = pixelPoints[includeIdx] || pixelPoints[0] || [Math.round(imgWidth / 2), Math.round(imgHeight / 2)];
      const s3Url = await storeMaskToS3(maskUrl, entityId, { seedPoint: { x: seedPair[0], y: seedPair[1] } });
      return { maskUrl: s3Url };
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
            const s3Url = await storeMaskToS3(fallbackMaskUrl, entityId, { seedPoint: { x: pt[0], y: pt[1] } });
            return { maskUrl: s3Url };
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
  // Text-based detection requires Grounded SAM (SAM 2 base doesn't support text_prompt)
  const textModel = GROUNDED_SAM_MODEL;
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
      const s3Url = await storeMaskToS3(maskUrl, entityId);
      return { maskUrl: s3Url };
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
