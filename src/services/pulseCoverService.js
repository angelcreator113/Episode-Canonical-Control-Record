/**
 * The Pulse's cover image (docs/design/2026-10-the-pulse.md §3 Header, §4
 * Uploads; Task #2919), a show setting stored on Show.metadata.pulse_cover:
 * { url, width, height, alt, updated_at }. Admin › The Pulse › Uploads sets,
 * captions and removes it; The Pulse's header shows it.
 *
 * PNG, JPEG or WebP, up to 15 MB, stored as a JPEG at most 2400px on its
 * long side in the studio's storage (pulseImageService).
 */
const { IMAGE_TYPES: COVER_TYPES, MAX_IMAGE_BYTES: MAX_COVER_BYTES } = require('./pulseImageService');

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
  const { storePulseImage, PulseImageError } = require('./pulseImageService');
  try {
    const { url, width, height } = await storePulseImage(file, {
      keyPrefix: `shows/pulse-covers/${showId}`, maxSide: MAX_COVER_SIDE, minSide: MIN_COVER_SIDE, label: 'The cover',
    });
    return { url, width, height, alt, updated_at: new Date().toISOString() };
  } catch (err) {
    if (err instanceof PulseImageError) throw new PulseCoverError(err.message, err.status, err.code);
    throw err;
  }
}

module.exports = {
  PulseCoverError,
  readPulseCover,
  readAlt,
  storePulseCover,
  COVER_TYPES,
  MAX_COVER_BYTES,
};
