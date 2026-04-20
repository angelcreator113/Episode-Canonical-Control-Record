'use strict';

/**
 * Wardrobe Image Service — v2.0
 *
 * Comprehensive image processing for wardrobe items:
 *   1. Auto-sharpening: Enhance clarity and edge definition
 *   2. Thumbnail generation: Create 300px thumbnails for fast gallery loading
 *   3. AI Upscaling: 4x upscale via Replicate Real-ESRGAN
 *   4. Drop shadows: Add natural shadows to transparent PNG items
 *   5. Auto-centering: Detect clothing bounds and center in frame
 *   6. Color consistency: White balance normalization
 *   7. Texture enhancement: HDR-style processing for fabric details
 *   8. AI color extraction: Auto-detect dominant colors
 *   9. AI tag suggestions: Analyze image for style/category tags
 */

const sharp = require('sharp');
const axios = require('axios');
const Replicate = require('replicate');
const Anthropic = require('@anthropic-ai/sdk');
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

// ─── DROP SHADOW GENERATION ──────────────────────────────────────────────────

/**
 * Add a natural drop shadow to transparent PNG images.
 * Makes cutout clothing items appear to "float" in the gallery.
 *
 * @param {Buffer} inputBuffer - PNG image with transparency
 * @param {Object} options
 * @returns {{ buffer: Buffer, metadata: Object }}
 */
async function addDropShadow(inputBuffer, options = {}) {
  const {
    shadowOffsetX = 8,
    shadowOffsetY = 12,
    shadowBlur = 20,
    shadowOpacity = 0.25,
    padding = 40, // Extra space for shadow
  } = options;

  const inputMeta = await sharp(inputBuffer).metadata();
  const hasAlpha = inputMeta.channels === 4;

  if (!hasAlpha) {
    console.log('[WardrobeImage] DropShadow: Image has no alpha channel, skipping');
    return { buffer: inputBuffer, metadata: inputMeta, skipped: true };
  }

  console.log(`[WardrobeImage] DropShadow: Adding shadow to ${inputMeta.width}x${inputMeta.height} image`);

  // Create expanded canvas with padding for shadow
  const newWidth = inputMeta.width + padding * 2;
  const newHeight = inputMeta.height + padding * 2;

  // Extract alpha channel to create shadow mask
  const alphaBuffer = await sharp(inputBuffer)
    .extractChannel(3)
    .toBuffer();

  // Create shadow: blur the alpha, tint black, reduce opacity
  const shadowBuffer = await sharp(alphaBuffer)
    .blur(shadowBlur)
    .extend({
      top: padding + shadowOffsetY,
      bottom: padding - shadowOffsetY,
      left: padding + shadowOffsetX,
      right: padding - shadowOffsetX,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .resize(newWidth, newHeight, { fit: 'fill' })
    .toColourspace('b-w')
    .toBuffer();

  // Create the shadow layer (black with variable opacity from alpha)
  const shadowLayer = await sharp({
    create: {
      width: newWidth,
      height: newHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: shadowOpacity },
    },
  })
    .composite([{
      input: shadowBuffer,
      blend: 'dest-in',
    }])
    .png()
    .toBuffer();

  // Extend original image with padding
  const paddedOriginal = await sharp(inputBuffer)
    .extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Composite: shadow underneath, original on top
  const outputBuffer = await sharp(shadowLayer)
    .composite([{
      input: paddedOriginal,
      blend: 'over',
    }])
    .png()
    .toBuffer();

  const outputMeta = await sharp(outputBuffer).metadata();
  console.log(`[WardrobeImage] DropShadow: Output ${outputMeta.width}x${outputMeta.height}`);

  return {
    buffer: outputBuffer,
    metadata: {
      width: outputMeta.width,
      height: outputMeta.height,
      format: 'png',
      size: outputBuffer.length,
    },
    contentType: 'image/png',
    skipped: false,
  };
}

// ─── AUTO-CENTERING / SMART CROP ─────────────────────────────────────────────

/**
 * Detect clothing bounds and center within a standardized frame.
 * Uses alpha channel (for PNGs) or edge detection to find the item.
 *
 * @param {Buffer} inputBuffer - Input image
 * @param {Object} options
 * @returns {{ buffer: Buffer, metadata: Object }}
 */
async function autoCenterCrop(inputBuffer, options = {}) {
  const {
    targetAspect = 3 / 4, // Portrait orientation for clothing
    paddingPercent = 0.08, // 8% padding around item
    backgroundColor = { r: 255, g: 255, b: 255, alpha: 0 },
  } = options;

  const inputMeta = await sharp(inputBuffer).metadata();
  const hasAlpha = inputMeta.channels === 4;

  console.log(`[WardrobeImage] AutoCenter: Analyzing ${inputMeta.width}x${inputMeta.height} image`);

  let trimInfo;
  try {
    // Get trim bounds (where the non-transparent/non-white content is)
    const trimmed = sharp(inputBuffer);
    if (hasAlpha) {
      // For PNGs, trim based on alpha
      trimInfo = await trimmed.trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
    } else {
      // For JPEGs, trim based on near-white background
      trimInfo = await trimmed.trim({ background: '#ffffff', threshold: 30 }).toBuffer({ resolveWithObject: true });
    }
  } catch (trimError) {
    console.log('[WardrobeImage] AutoCenter: Trim failed, using original bounds');
    return { buffer: inputBuffer, metadata: inputMeta, skipped: true };
  }

  const { info } = trimInfo;
  const contentWidth = info.width;
  const contentHeight = info.height;

  // Calculate target dimensions maintaining aspect ratio
  const contentAspect = contentWidth / contentHeight;
  let targetWidth, targetHeight;

  if (contentAspect > targetAspect) {
    // Content is wider than target aspect
    targetWidth = contentWidth;
    targetHeight = Math.round(contentWidth / targetAspect);
  } else {
    // Content is taller than target aspect
    targetHeight = contentHeight;
    targetWidth = Math.round(contentHeight * targetAspect);
  }

  // Add padding
  const paddingX = Math.round(targetWidth * paddingPercent);
  const paddingY = Math.round(targetHeight * paddingPercent);
  targetWidth += paddingX * 2;
  targetHeight += paddingY * 2;

  // Create centered output
  const outputBuffer = await sharp(trimInfo.data)
    .extend({
      top: Math.round((targetHeight - contentHeight) / 2),
      bottom: Math.round((targetHeight - contentHeight) / 2),
      left: Math.round((targetWidth - contentWidth) / 2),
      right: Math.round((targetWidth - contentWidth) / 2),
      background: backgroundColor,
    })
    .resize(targetWidth, targetHeight, { fit: 'contain', background: backgroundColor })
    .toBuffer();

  const outputMeta = await sharp(outputBuffer).metadata();
  console.log(`[WardrobeImage] AutoCenter: Centered to ${outputMeta.width}x${outputMeta.height}`);

  return {
    buffer: outputBuffer,
    metadata: {
      width: outputMeta.width,
      height: outputMeta.height,
      format: hasAlpha ? 'png' : 'jpeg',
      size: outputBuffer.length,
      trimmedFrom: { width: inputMeta.width, height: inputMeta.height },
    },
    contentType: hasAlpha ? 'image/png' : 'image/jpeg',
    skipped: false,
  };
}

// ─── COLOR CONSISTENCY / WHITE BALANCE ───────────────────────────────────────

/**
 * Normalize white balance and color consistency across wardrobe images.
 * Corrects for different lighting conditions in source photos.
 *
 * @param {Buffer} inputBuffer - Input image
 * @param {Object} options
 * @returns {{ buffer: Buffer, metadata: Object }}
 */
async function normalizeColors(inputBuffer, options = {}) {
  const {
    autoWhiteBalance = true,
    targetBrightness = 1.0,
    saturationBoost = 1.05, // Slight saturation increase
  } = options;

  const inputMeta = await sharp(inputBuffer).metadata();
  console.log(`[WardrobeImage] ColorNorm: Processing ${inputMeta.width}x${inputMeta.height}`);

  // Get image statistics for auto white balance
  const stats = await sharp(inputBuffer).stats();

  let pipeline = sharp(inputBuffer);

  if (autoWhiteBalance && stats.channels.length >= 3) {
    // Calculate per-channel averages
    const rMean = stats.channels[0].mean;
    const gMean = stats.channels[1].mean;
    const bMean = stats.channels[2].mean;
    const overallMean = (rMean + gMean + bMean) / 3;

    // Calculate correction factors (normalize to gray)
    const rFactor = overallMean / rMean;
    const gFactor = overallMean / gMean;
    const bFactor = overallMean / bMean;

    // Apply subtle correction (blend 30% toward neutral)
    const blendFactor = 0.3;
    const rMult = 1 + (rFactor - 1) * blendFactor;
    const gMult = 1 + (gFactor - 1) * blendFactor;
    const bMult = 1 + (bFactor - 1) * blendFactor;

    // Clamp multipliers to reasonable range
    const clamp = (v) => Math.max(0.8, Math.min(1.2, v));

    pipeline = pipeline.recomb([
      [clamp(rMult), 0, 0],
      [0, clamp(gMult), 0],
      [0, 0, clamp(bMult)],
    ]);

    console.log(`[WardrobeImage] ColorNorm: WB correction R:${rMult.toFixed(2)} G:${gMult.toFixed(2)} B:${bMult.toFixed(2)}`);
  }

  // Apply brightness and saturation adjustments
  pipeline = pipeline.modulate({
    brightness: targetBrightness,
    saturation: saturationBoost,
  });

  // Normalize to sRGB for consistent display
  pipeline = pipeline.toColorspace('srgb');

  const outputBuffer = await pipeline.toBuffer();
  const outputMeta = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    metadata: {
      width: outputMeta.width,
      height: outputMeta.height,
      format: outputMeta.format,
      size: outputBuffer.length,
    },
    contentType: `image/${outputMeta.format}`,
  };
}

// ─── TEXTURE ENHANCEMENT (HDR-STYLE) ─────────────────────────────────────────

/**
 * HDR-style enhancement to bring out fabric textures and details.
 * Useful for tweed, lace, embroidery, and detailed materials.
 *
 * @param {Buffer} inputBuffer - Input image
 * @param {Object} options
 * @returns {{ buffer: Buffer, metadata: Object }}
 */
async function enhanceTexture(inputBuffer, options = {}) {
  const {
    clarity = 1.3,        // Local contrast boost
    detailSharpen = 1.5,  // Detail enhancement
    microContrast = 1.1,  // Fine texture pop
  } = options;

  const inputMeta = await sharp(inputBuffer).metadata();
  console.log(`[WardrobeImage] TextureEnhance: Processing ${inputMeta.width}x${inputMeta.height}`);

  // Step 1: Create a slightly blurred version for local contrast
  const blurred = await sharp(inputBuffer)
    .blur(30) // Large-radius blur for "local" reference
    .toBuffer();

  // Step 2: Blend original with inverse of blur for clarity
  // This is a simplified clarity/local contrast technique
  let pipeline = sharp(inputBuffer);

  // Apply unsharp mask with larger radius for "clarity" effect
  pipeline = pipeline.sharpen({
    sigma: 2.5,              // Larger sigma = more clarity-like effect
    flat: 1.0,
    jagged: 0.5,
  });

  // Second pass: fine detail sharpening
  pipeline = pipeline.sharpen({
    sigma: 0.8,              // Small sigma for micro-details
    flat: detailSharpen,
    jagged: 0.3,
  });

  // Slight contrast boost for texture pop
  pipeline = pipeline.linear(microContrast, -(128 * (microContrast - 1)));

  const outputBuffer = await pipeline.toBuffer();
  const outputMeta = await sharp(outputBuffer).metadata();

  console.log(`[WardrobeImage] TextureEnhance: Complete`);

  return {
    buffer: outputBuffer,
    metadata: {
      width: outputMeta.width,
      height: outputMeta.height,
      format: outputMeta.format,
      size: outputBuffer.length,
    },
    contentType: `image/${outputMeta.format}`,
  };
}

// ─── AI COLOR EXTRACTION ─────────────────────────────────────────────────────

/**
 * Use Claude Vision to extract dominant colors from a wardrobe image.
 * Returns color names and hex codes.
 *
 * @param {string} imageUrl - URL of the image to analyze
 * @returns {{ colors: Array<{name: string, hex: string, percentage: number}> }}
 */
async function extractColors(imageUrl) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const anthropic = new Anthropic({ apiKey });

  console.log('[WardrobeImage] ColorExtract: Analyzing image with Claude Vision...');

  // Download image and convert to base64
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const base64Image = Buffer.from(response.data).toString('base64');
  const mediaType = imageUrl.includes('.png') ? 'image/png' : 'image/jpeg';

  const result = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Image,
          },
        },
        {
          type: 'text',
          text: `Analyze this clothing item and extract the dominant colors. Return a JSON array of colors with this exact format:
[{"name": "color name", "hex": "#RRGGBB", "percentage": 50}]

Rules:
- Include 2-5 dominant colors
- Use common color names (black, navy, gold, cream, etc.)
- Percentages should sum to ~100
- Order by dominance (highest percentage first)

Return ONLY the JSON array, no other text.`,
        },
      ],
    }],
  });

  const text = result.content[0].text.trim();
  
  // Parse JSON response
  let colors;
  try {
    colors = JSON.parse(text);
  } catch (parseError) {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      colors = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Failed to parse color extraction response');
    }
  }

  console.log(`[WardrobeImage] ColorExtract: Found ${colors.length} colors`);

  return { colors };
}

// ─── AI TAG SUGGESTIONS ──────────────────────────────────────────────────────

/**
 * Use Claude Vision to suggest tags for a wardrobe image.
 * Analyzes style, material, occasion, and aesthetic.
 *
 * @param {string} imageUrl - URL of the image to analyze
 * @returns {{ tags: string[], category: string, material: string, occasions: string[] }}
 */
async function suggestTags(imageUrl) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const anthropic = new Anthropic({ apiKey });

  console.log('[WardrobeImage] TagSuggest: Analyzing image with Claude Vision...');

  // Download image and convert to base64
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const base64Image = Buffer.from(response.data).toString('base64');
  const mediaType = imageUrl.includes('.png') ? 'image/png' : 'image/jpeg';

  const result = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Image,
          },
        },
        {
          type: 'text',
          text: `Analyze this clothing item for fashion metadata. Return a JSON object with this exact format:
{
  "category": "dress|top|bottom|outerwear|shoes|accessory|jewelry|bag",
  "subcategory": "specific type (e.g., mini dress, blazer, sneakers)",
  "material": "primary material (e.g., tweed, silk, leather, cotton)",
  "style_tags": ["array of style descriptors"],
  "aesthetic_tags": ["array of aesthetic vibes"],
  "occasions": ["array of appropriate occasions"],
  "season": "spring|summer|fall|winter|all-season",
  "formality": "casual|smart-casual|business|formal|black-tie"
}

Style tags examples: button-front, halter, sleeveless, midi-length, fitted, oversized
Aesthetic tags examples: old-money, chanel-inspired, minimalist, bohemian, streetwear, preppy, glam
Occasions examples: office, date-night, brunch, cocktail, wedding-guest, everyday

Return ONLY the JSON object, no other text.`,
        },
      ],
    }],
  });

  const text = result.content[0].text.trim();
  
  // Parse JSON response
  let analysis;
  try {
    analysis = JSON.parse(text);
  } catch (parseError) {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Failed to parse tag suggestion response');
    }
  }

  // Combine all tags into a flat array for easy use
  const allTags = [
    ...(analysis.style_tags || []),
    ...(analysis.aesthetic_tags || []),
    analysis.material,
    analysis.formality,
    analysis.season,
  ].filter(Boolean);

  console.log(`[WardrobeImage] TagSuggest: Suggested ${allTags.length} tags`);

  return {
    tags: allTags,
    category: analysis.category,
    subcategory: analysis.subcategory,
    material: analysis.material,
    styleTags: analysis.style_tags || [],
    aestheticTags: analysis.aesthetic_tags || [],
    occasions: analysis.occasions || [],
    season: analysis.season,
    formality: analysis.formality,
  };
}

// ─── FULL AI ANALYSIS (COLORS + TAGS) ────────────────────────────────────────

/**
 * Complete AI analysis of a wardrobe image: colors + tags in one call.
 *
 * @param {string} imageUrl - URL of the image to analyze
 * @returns {{ colors: Array, tags: Object }}
 */
async function analyzeImage(imageUrl) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const anthropic = new Anthropic({ apiKey });

  console.log('[WardrobeImage] FullAnalysis: Analyzing image with Claude Vision...');

  // Download image and convert to base64
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 });
  const base64Image = Buffer.from(response.data).toString('base64');
  const mediaType = imageUrl.includes('.png') ? 'image/png' : 'image/jpeg';

  const result = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Image,
          },
        },
        {
          type: 'text',
          text: `Analyze this clothing item comprehensively. Return a JSON object with this exact format:
{
  "colors": [
    {"name": "color name", "hex": "#RRGGBB", "percentage": 50}
  ],
  "category": "dress|top|bottom|outerwear|shoes|accessory|jewelry|bag",
  "subcategory": "specific type",
  "material": "primary material",
  "style_tags": ["style descriptors"],
  "aesthetic_tags": ["aesthetic vibes like old-money, minimalist, glam"],
  "occasions": ["appropriate occasions"],
  "season": "spring|summer|fall|winter|all-season",
  "formality": "casual|smart-casual|business|formal|black-tie",
  "suggested_name": "A concise, descriptive name for this item"
}

For colors: Include 2-5 dominant colors, percentages summing to ~100.
Return ONLY the JSON object, no other text.`,
        },
      ],
    }],
  });

  const text = result.content[0].text.trim();
  
  // Parse JSON response
  let analysis;
  try {
    analysis = JSON.parse(text);
  } catch (parseError) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Failed to parse analysis response');
    }
  }

  console.log(`[WardrobeImage] FullAnalysis: Complete - ${analysis.colors?.length || 0} colors, category: ${analysis.category}`);

  return {
    colors: analysis.colors || [],
    primaryColor: analysis.colors?.[0]?.name || null,
    primaryColorHex: analysis.colors?.[0]?.hex || null,
    category: analysis.category,
    subcategory: analysis.subcategory,
    material: analysis.material,
    styleTags: analysis.style_tags || [],
    aestheticTags: analysis.aesthetic_tags || [],
    occasions: analysis.occasions || [],
    season: analysis.season,
    formality: analysis.formality,
    suggestedName: analysis.suggested_name,
    allTags: [
      ...(analysis.style_tags || []),
      ...(analysis.aesthetic_tags || []),
      analysis.material,
      analysis.formality,
    ].filter(Boolean),
  };
}

// ─── PREMIUM ENHANCEMENT PIPELINE ────────────────────────────────────────────

/**
 * Full premium enhancement pipeline:
 *   1. Color normalization
 *   2. Texture enhancement
 *   3. Auto-centering
 *   4. Drop shadow (if transparent)
 *   5. Generate thumbnail
 *
 * @param {Buffer} inputBuffer - Raw image buffer
 * @param {string} character - Character name for S3 paths
 * @param {Object} options
 * @returns {{ mainImage, thumbnail, processing }}
 */
async function premiumEnhance(inputBuffer, character, options = {}) {
  const {
    skipColorNorm = false,
    skipTexture = false,
    skipCenter = false,
    skipShadow = false,
    skipThumbnail = false,
  } = options;

  console.log('[WardrobeImage] PremiumEnhance: Starting full pipeline...');

  let buffer = inputBuffer;
  const processingSteps = [];

  // Step 1: Color normalization
  if (!skipColorNorm) {
    console.log('[WardrobeImage] PremiumEnhance: Step 1 - Color normalization');
    const colorResult = await normalizeColors(buffer);
    buffer = colorResult.buffer;
    processingSteps.push('color_normalized');
  }

  // Step 2: Texture enhancement
  if (!skipTexture) {
    console.log('[WardrobeImage] PremiumEnhance: Step 2 - Texture enhancement');
    const textureResult = await enhanceTexture(buffer);
    buffer = textureResult.buffer;
    processingSteps.push('texture_enhanced');
  }

  // Step 3: Auto-centering
  if (!skipCenter) {
    console.log('[WardrobeImage] PremiumEnhance: Step 3 - Auto-centering');
    const centerResult = await autoCenterCrop(buffer);
    if (!centerResult.skipped) {
      buffer = centerResult.buffer;
      processingSteps.push('auto_centered');
    }
  }

  // Step 4: Drop shadow (only for PNGs with transparency)
  const meta = await sharp(buffer).metadata();
  if (!skipShadow && meta.channels === 4) {
    console.log('[WardrobeImage] PremiumEnhance: Step 4 - Adding drop shadow');
    const shadowResult = await addDropShadow(buffer);
    if (!shadowResult.skipped) {
      buffer = shadowResult.buffer;
      processingSteps.push('shadow_added');
    }
  }

  // Final output format
  const finalMeta = await sharp(buffer).metadata();
  const isTransparent = finalMeta.channels === 4;

  let outputBuffer;
  let contentType;
  if (isTransparent) {
    outputBuffer = await sharp(buffer).png({ quality: 90 }).toBuffer();
    contentType = 'image/png';
  } else {
    outputBuffer = await sharp(buffer)
      .jpeg({ quality: 92, progressive: true, mozjpeg: true })
      .toBuffer();
    contentType = 'image/jpeg';
  }

  // Upload main image
  const mainUpload = await uploadWardrobeImage(outputBuffer, character, '-enhanced', contentType);

  // Step 5: Generate thumbnail
  let thumbUpload = null;
  if (!skipThumbnail) {
    console.log('[WardrobeImage] PremiumEnhance: Step 5 - Generating thumbnail');
    const thumbnail = await generateThumbnail(outputBuffer, { size: 300 });
    thumbUpload = await uploadWardrobeImage(thumbnail.buffer, character, '-thumb', thumbnail.contentType);
  }

  console.log(`[WardrobeImage] PremiumEnhance: Complete (${processingSteps.length} steps)`);

  return {
    mainImage: {
      s3Key: mainUpload.s3Key,
      s3Url: mainUpload.s3Url,
      width: finalMeta.width,
      height: finalMeta.height,
    },
    thumbnail: thumbUpload ? {
      s3Key: thumbUpload.s3Key,
      s3Url: thumbUpload.s3Url,
    } : null,
    processing: {
      steps: processingSteps,
      hasTransparency: isTransparent,
    },
  };
}

module.exports = {
  // Core functions
  sharpEnhanceWardrobe,
  generateThumbnail,
  aiUpscaleImage,
  uploadWardrobeImage,
  processWardrobeUpload,
  
  // New enhancement functions
  addDropShadow,
  autoCenterCrop,
  normalizeColors,
  enhanceTexture,
  
  // AI analysis functions
  extractColors,
  suggestTags,
  analyzeImage,
  
  // Premium pipeline
  premiumEnhance,
};
