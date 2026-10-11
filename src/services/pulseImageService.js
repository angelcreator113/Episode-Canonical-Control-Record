/**
 * Uploaded images for The Pulse's Uploads tab (Tasks #2919, #2920): checks
 * the type, size and minimum side, turns the image upright, fits it inside
 * `maxSide`, stores it as a JPEG in the studio's storage (uploadPng:
 * S3_PRIMARY_BUCKET or AWS_S3_BUCKET; a data URL when neither is set) and
 * returns { url, width, height }. PNG, JPEG or WebP only: no SVG, which can
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
 * @param {object} opts     { keyPrefix, maxSide, minSide, label }
 */
async function storePulseImage(file, { keyPrefix, maxSide = 2400, minSide = 200, label = 'The image' }) {
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
  const url = await uploadPng(data, `${keyPrefix}/${crypto.randomUUID()}.jpg`, 'image/jpeg');
  return { url, width: info.width, height: info.height };
}

module.exports = { PulseImageError, storePulseImage, IMAGE_TYPES, MAX_IMAGE_BYTES };
