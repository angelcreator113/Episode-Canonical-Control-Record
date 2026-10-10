/**
 * The show's logo, a show setting stored on Show.metadata.logo:
 * { url, width, height, updated_at }. Show Settings uploads and removes it;
 * the episode style sheet prints it in place of the lettered title.
 *
 * PNG, JPEG or WebP, up to 5 MB. No SVG: it can carry script. The upload is
 * stored as a PNG at most 1024px on its long side, so transparency is kept.
 * Storage is the studio's (uploadPng: S3_PRIMARY_BUCKET or AWS_S3_BUCKET),
 * the same as Lookbook photos; it is not the public site location.
 */
const crypto = require('crypto');

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const MAX_LOGO_SIDE = 1024;
const MIN_LOGO_SIDE = 64;

class ShowLogoError extends Error {
  constructor(message, status = 400, code = 'INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** The stored logo, or null. */
function readLogo(metadata) {
  const logo = metadata && typeof metadata === 'object' ? metadata.logo : null;
  if (!logo || typeof logo !== 'object' || typeof logo.url !== 'string' || !logo.url) return null;
  return {
    url: logo.url,
    width: Number.isFinite(logo.width) ? logo.width : null,
    height: Number.isFinite(logo.height) ? logo.height : null,
    updated_at: logo.updated_at || null,
  };
}

/** Checks, resizes and stores an uploaded file; returns the logo to save. */
async function storeLogo(showId, file) {
  if (!file || !file.buffer || !file.buffer.length) throw new ShowLogoError('Choose an image to upload.');
  if (!LOGO_TYPES.includes(file.mimetype)) throw new ShowLogoError('The logo must be a PNG, JPEG or WebP image.', 400, 'WRONG_TYPE');
  if (file.buffer.length > MAX_LOGO_BYTES) throw new ShowLogoError('The logo is 5 MB at most.', 400, 'TOO_LARGE');

  const sharp = require('sharp');
  let meta;
  try {
    meta = await sharp(file.buffer).metadata();
  } catch (err) {
    console.error('[ShowLogo] the image could not be read:', err.message);
    throw new ShowLogoError('That file could not be read as an image.', 400, 'UNREADABLE');
  }
  if (!meta.width || !meta.height || Math.max(meta.width, meta.height) < MIN_LOGO_SIDE) {
    throw new ShowLogoError(`The logo must be at least ${MIN_LOGO_SIDE}px on its long side.`, 400, 'TOO_SMALL');
  }

  const { data, info } = await sharp(file.buffer)
    .rotate()
    .resize({ width: MAX_LOGO_SIDE, height: MAX_LOGO_SIDE, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true });

  const { uploadPng } = require('./episodeTitleOverlayService');
  const url = await uploadPng(data, `shows/logos/${showId}/${crypto.randomUUID()}.png`, 'image/png');
  return { url, width: info.width, height: info.height, updated_at: new Date().toISOString() };
}

// Hosts a stored logo may be read back from: the studio bucket only. The
// URL sits in Show.metadata, which PUT /shows/:id writes as given, so any
// other address is refused rather than fetched.
function studioBucketHosts() {
  const bucket = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET;
  if (!bucket) return [];
  const region = process.env.AWS_REGION || 'us-east-1';
  return [`${bucket}.s3.${region}.amazonaws.com`, `${bucket}.s3.amazonaws.com`];
}

/** The stored logo's PNG bytes: a data URL, or the studio bucket's object. */
async function logoBytes(logo) {
  const url = String(logo?.url || '');
  const dataUrl = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(url);
  if (dataUrl) return Buffer.from(dataUrl[1], 'base64');
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    console.error('[ShowLogo] the stored logo address is not a URL:', err.message);
    throw new ShowLogoError("The show's logo could not be read. Upload it again in Show Settings.", 400, 'LOGO_UNREADABLE');
  }
  if (parsed.protocol !== 'https:' || !studioBucketHosts().includes(parsed.host)) {
    throw new ShowLogoError("The show's logo is not in the studio's storage. Upload it again in Show Settings.", 400, 'LOGO_UNREADABLE');
  }
  const axios = require('axios');
  const res = await axios.get(parsed.href, { responseType: 'arraybuffer', timeout: 15000, maxContentLength: MAX_LOGO_BYTES, maxRedirects: 0 });
  return Buffer.from(res.data);
}

module.exports = {
  ShowLogoError,
  readLogo,
  storeLogo,
  logoBytes,
  LOGO_TYPES,
  MAX_LOGO_BYTES,
};
