/**
 * Uploaded images for The Pulse's Uploads tab (Tasks #2919, #2920): checks
 * the type, size and minimum side, turns the image upright, fits it inside
 * `maxSide`, stores it as a JPEG in the studio's storage (uploadPng:
 * S3_PRIMARY_BUCKET or AWS_S3_BUCKET; a data URL when neither is set) and
 * returns { url, key, width, height } (key: the object key it was stored
 * under). PNG, JPEG or WebP only: no SVG, which can
 * carry script. Not the public site location.
 */
const crypto = require('crypto');

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

class PulseImageError extends Error {
  constructor(message, status = 400, code = 'INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * @param {object} file     multer file (memory storage)
 * @param {object} opts     { keyPrefix, maxSide, minSide, label, key, metadata }
 *   key: the exact object key (it must start with keyPrefix/ and end in
 *     .jpg); otherwise keyPrefix/<random uuid>.jpg. The camera roll decides
 *     its key before the paid request, so a stored photo can always be traced
 *     to its photo and claim (#3714 recovery).
 *   metadata: S3 user metadata stored with the object.
 */
async function storePulseImage(file, { keyPrefix, maxSide = 2400, minSide = 200, label = 'The image', key: exactKey = null, metadata = null }) {
  if (exactKey && (!String(exactKey).startsWith(`${keyPrefix}/`) || !/\.jpg$/.test(exactKey) || /\.\.|\/\//.test(exactKey))) {
    throw new PulseImageError('The storage key does not belong under its prefix.', 500, 'BAD_KEY');
  }
  if (!file || !file.buffer || !file.buffer.length) throw new PulseImageError('Choose an image to upload.');
  if (!IMAGE_TYPES.includes(file.mimetype)) throw new PulseImageError(`${label} must be a PNG, JPEG or WebP image.`, 400, 'WRONG_TYPE');
  if (file.buffer.length > MAX_IMAGE_BYTES) throw new PulseImageError(`${label} is 15 MB at most.`, 400, 'TOO_LARGE');

  const sharp = require('sharp');
  let meta;
  try {
    meta = await sharp(file.buffer).metadata();
  } catch (err) {
    console.error('[PulseImage] the image could not be read:', err.message);
    throw new PulseImageError('That file could not be read as an image.', 400, 'UNREADABLE');
  }
  if (!meta.width || !meta.height || Math.max(meta.width, meta.height) < minSide) {
    throw new PulseImageError(`${label} must be at least ${minSide}px on its long side.`, 400, 'TOO_SMALL');
  }

  const { data, info } = await sharp(file.buffer)
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#FAF7F0' })
    .jpeg({ quality: 86 })
    .toBuffer({ resolveWithObject: true });

  const { uploadPng } = require('./episodeTitleOverlayService');
  const key = exactKey || `${keyPrefix}/${crypto.randomUUID()}.jpg`;
  const url = await uploadPng(data, key, 'image/jpeg', { metadata });
  return { url, key, width: info.width, height: info.height };
}

/**
 * What storage holds under one key, without changing it: { url, metadata,
 * contentType, size }, null when there is no such object, or a 503 when no
 * bucket is configured. Used to attach a photo that was stored before a
 * crash (services/cameraRoll resolve 'attach'). Never writes or deletes.
 */
async function storedImage(key) {
  const S3_BUCKET = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
  if (!S3_BUCKET) throw new PulseImageError('No storage bucket is configured, so a stored photo cannot be looked up.', 503, 'NO_STORAGE');
  const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
  const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
  const s3 = new S3Client({ region: AWS_REGION });
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return {
      url: `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`,
      metadata: head.Metadata || {}, contentType: head.ContentType || null, size: head.ContentLength ?? null,
    };
  } catch (err) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) return null;
    console.error('[PulseImage] the stored object could not be read:', err.message);
    throw new PulseImageError('Storage could not be read; try again.', 502, 'STORAGE_UNREADABLE');
  }
}

module.exports = { PulseImageError, storePulseImage, storedImage, IMAGE_TYPES, MAX_IMAGE_BYTES };
