/**
 * The S3 bucket the episode uploads use: character poses, raw clips, the
 * YouTube Thumbnail Studio's saved thumbnails and the scene library.
 *
 * AWS_S3_BUCKET first, so a server that sets it keeps writing where it did;
 * then S3_PRIMARY_BUCKET, the one .env.example and docs/ENV_VARIABLES.md name
 * and the rest of the app reads; then S3_ASSET_BUCKET. There is no made-up
 * default: these used to fall back to 'primepisodes-assets', a bucket that
 * does not exist, so on a server that sets only S3_PRIMARY_BUCKET every
 * upload failed with "The specified bucket does not exist" (Evoni,
 * 2026-10-20).
 */

const ASSET_BUCKET = process.env.AWS_S3_BUCKET || process.env.S3_PRIMARY_BUCKET || process.env.S3_ASSET_BUCKET || null;

const NO_BUCKET_MESSAGE = 'No S3 bucket is set on the server (S3_PRIMARY_BUCKET)';

/** The bucket, or a 503 error that says which setting is missing. */
function requireAssetBucket() {
  if (ASSET_BUCKET) return ASSET_BUCKET;
  const err = new Error(NO_BUCKET_MESSAGE);
  err.status = 503;
  throw err;
}

module.exports = { ASSET_BUCKET, NO_BUCKET_MESSAGE, requireAssetBucket };
