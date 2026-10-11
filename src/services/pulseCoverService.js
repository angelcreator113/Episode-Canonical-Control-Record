/**
 * The Pulse's cover image (docs/design/2026-10-the-pulse.md §3 Header, §4
 * Uploads; Task #2919), a show setting stored on Show.metadata.pulse_cover:
 * { url, width, height, alt, updated_at }. Admin › The Pulse › Uploads sets,
 * captions and removes it; The Pulse's header shows it.
 *
 * PNG, JPEG or WebP, up to 15 MB. No SVG: it can carry script. The upload is
 * stored as a JPEG at most 2400px on its long side. Storage is the studio's
 * (uploadPng: S3_PRIMARY_BUCKET or AWS_S3_BUCKET), as for the show's logo;
 * it is not the public site location.
 */
const crypto = require('crypto');

const COVER_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_COVER_BYTES = 15 * 1024 * 1024;
const MAX_COVER_SIDE = 2400;
const MIN_COVER_SIDE = 400;
const MAX_ALT_LENGTH = 300;

class PulseCoverError extends Error {
  constructor(message, status = 400, code = 'INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** The stored cover, or null. */
function readPulseCover(metadata) {
  const cover = metadata && typeof metadata === 'object' ? metadata.pulse_cover : null;
  if (!cover || typeof cover !== 'object' || typeof cover.url !== 'string' || !cover.url) return null;
  return {
    url: cover.url,
    width: Number.isFinite(cover.width) ? cover.width : null,
    height: Number.isFinite(cover.height) ? cover.height : null,
    alt: typeof cover.alt === 'string' ? cover.alt : '',
    updated_at: cover.updated_at || null,
  };
}

/** The alt text from a request body value: trimmed, or an error. */
function readAlt(value) {
  if (value === undefined || value === null) return { value: '' };
  if (typeof value !== 'string') return { error: 'The alt text must be text.' };
  const alt = value.trim();
  if (alt.length > MAX_ALT_LENGTH) return { error: `The alt text is ${MAX_ALT_LENGTH} characters at most.` };
  return { value: alt };
}

/** Checks, resizes and stores an uploaded file; returns the cover to save. */
async function storePulseCover(showId, file, alt = '') {
  if (!file || !file.buffer || !file.buffer.length) throw new PulseCoverError('Choose an image to upload.');
  if (!COVER_TYPES.includes(file.mimetype)) throw new PulseCoverError('The cover must be a PNG, JPEG or WebP image.', 400, 'WRONG_TYPE');
  if (file.buffer.length > MAX_COVER_BYTES) throw new PulseCoverError('The cover is 15 MB at most.', 400, 'TOO_LARGE');

  const sharp = require('sharp');
  let meta;
  try {
    meta = await sharp(file.buffer).metadata();
  } catch (err) {
    console.error('[PulseCover] the image could not be read:', err.message);
    throw new PulseCoverError('That file could not be read as an image.', 400, 'UNREADABLE');
  }
  if (!meta.width || !meta.height || Math.max(meta.width, meta.height) < MIN_COVER_SIDE) {
    throw new PulseCoverError(`The cover must be at least ${MIN_COVER_SIDE}px on its long side.`, 400, 'TOO_SMALL');
  }

  const { data, info } = await sharp(file.buffer)
    .rotate()
    .resize({ width: MAX_COVER_SIDE, height: MAX_COVER_SIDE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#FAF7F0' })
    .jpeg({ quality: 86 })
    .toBuffer({ resolveWithObject: true });

  const { uploadPng } = require('./episodeTitleOverlayService');
  const url = await uploadPng(data, `shows/pulse-covers/${showId}/${crypto.randomUUID()}.jpg`, 'image/jpeg');
  return { url, width: info.width, height: info.height, alt, updated_at: new Date().toISOString() };
}

module.exports = {
  PulseCoverError,
  readPulseCover,
  readAlt,
  storePulseCover,
  COVER_TYPES,
  MAX_COVER_BYTES,
};
