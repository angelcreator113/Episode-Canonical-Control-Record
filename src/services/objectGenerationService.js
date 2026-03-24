'use strict';

/**
 * Object Generation Service — DALL-E 3
 *
 * Generates transparent PNG object cutouts for Scene Studio.
 * Uses OpenAI's DALL-E 3 API to create isolated objects that can be
 * placed as overlays on the canvas.
 */

const axios = require('axios');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const S3_BUCKET      = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
const AWS_REGION     = process.env.AWS_REGION || 'us-east-1';

const s3 = new S3Client({ region: AWS_REGION });

// Visual style anchor (condensed for object generation)
const OBJECT_STYLE_ANCHOR = 'Style: Final Fantasy softness, Pinterest-core femininity, magical realism. ' +
  'Colors: warm neutrals (cream, blush, beige), gold accents, pastel glow. ' +
  'Materials: soft fabrics, light wood, glass, mirrors, shimmer. ' +
  'Quality: sharp edges, clean silhouette, studio lighting.';

/**
 * Build prompt for DALL-E 3 object generation.
 * Emphasizes transparent/isolated object with clean cutout.
 */
function buildObjectPrompt(userPrompt, styleHints) {
  const parts = [
    'Isolated single object on a pure white background.',
    'Clean product photography style, centered, no shadows on background, no floor, no room context.',
    `Object: ${userPrompt}.`,
    OBJECT_STYLE_ANCHOR,
  ];

  if (styleHints) {
    parts.push(`Additional style: ${styleHints}.`);
  }

  parts.push('High resolution, sharp details, professional studio lighting.');

  return parts.join(' ').trim();
}

/**
 * Call DALL-E 3 API to generate an image.
 */
async function callDallE3(prompt) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

  const response = await axios.post(
    'https://api.openai.com/v1/images/generations',
    {
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    },
    {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    }
  );

  return response.data.data[0];
}

/**
 * Download image from URL and upload to S3.
 */
async function storeInS3(imageUrl, sceneId) {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
  });

  const ts = Date.now();
  const id = uuidv4().slice(0, 8);
  const s3Key = `scene-studio/${sceneId}/generated/${ts}-${id}.png`;

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: Buffer.from(response.data),
    ContentType: 'image/png',
    CacheControl: 'max-age=31536000',
  }));

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

/**
 * Generate object images and store in S3.
 *
 * @param {string} prompt - User's object description
 * @param {object} options
 * @param {string} options.sceneId - Scene ID for S3 path
 * @param {string} [options.styleHints] - Additional style modifiers
 * @param {number} [options.count=2] - Number of variations (1-4)
 * @returns {Promise<Array<{asset_id: string, url: string, width: number, height: number}>>}
 */
async function generateObject(prompt, options = {}) {
  const { sceneId, styleHints, count = 2 } = options;
  const fullPrompt = buildObjectPrompt(prompt, styleHints);

  console.log(`[ObjectGen] Generating ${count} object(s): "${prompt}"`);

  // DALL-E 3 only supports n=1, so call in parallel for multiple options
  const calls = Array.from({ length: Math.min(count, 4) }, () => callDallE3(fullPrompt));

  const results = await Promise.allSettled(calls);
  const options_out = [];

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value?.url) {
      try {
        const s3Url = await storeInS3(result.value.url, sceneId);
        options_out.push({
          asset_id: uuidv4(),
          url: s3Url,
          width: 1024,
          height: 1024,
          revised_prompt: result.value.revised_prompt,
        });
      } catch (err) {
        console.error('[ObjectGen] S3 upload failed:', err.message);
      }
    } else if (result.status === 'rejected') {
      console.error('[ObjectGen] DALL-E 3 call failed:', result.reason?.message);
    }
  }

  if (options_out.length === 0) {
    throw new Error('All generation attempts failed');
  }

  console.log(`[ObjectGen] Generated ${options_out.length} option(s) successfully`);
  return options_out;
}

module.exports = { generateObject };
