/**
 * assetBucket (Evoni, 2026-10-20): production sets only S3_PRIMARY_BUCKET,
 * and the old fallback 'primepisodes-assets' does not exist, so pose, raw
 * clip and thumbnail uploads failed with "The specified bucket does not
 * exist". The bucket now comes from AWS_S3_BUCKET, then S3_PRIMARY_BUCKET,
 * then S3_ASSET_BUCKET, with no made-up default.
 */

const KEYS = ['AWS_S3_BUCKET', 'S3_PRIMARY_BUCKET', 'S3_ASSET_BUCKET'];

function load(env) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  KEYS.forEach((k) => { delete process.env[k]; });
  Object.assign(process.env, env);
  let mod;
  jest.isolateModules(() => { mod = require('../../../src/services/assetBucket'); });
  KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
  return mod;
}

describe('assetBucket', () => {
  test('a server that sets only S3_PRIMARY_BUCKET uploads there', () => {
    const { ASSET_BUCKET, requireAssetBucket } = load({ S3_PRIMARY_BUCKET: 'episode-metadata-storage-dev' });
    expect(ASSET_BUCKET).toBe('episode-metadata-storage-dev');
    expect(requireAssetBucket()).toBe('episode-metadata-storage-dev');
  });

  test('AWS_S3_BUCKET still wins when set, then S3_PRIMARY_BUCKET, then S3_ASSET_BUCKET', () => {
    expect(load({ AWS_S3_BUCKET: 'a', S3_PRIMARY_BUCKET: 'b', S3_ASSET_BUCKET: 'c' }).ASSET_BUCKET).toBe('a');
    expect(load({ S3_PRIMARY_BUCKET: 'b', S3_ASSET_BUCKET: 'c' }).ASSET_BUCKET).toBe('b');
    expect(load({ S3_ASSET_BUCKET: 'c' }).ASSET_BUCKET).toBe('c');
  });

  test('with none set there is no made-up bucket, and an upload says which setting is missing', () => {
    const { ASSET_BUCKET, requireAssetBucket, NO_BUCKET_MESSAGE } = load({});
    expect(ASSET_BUCKET).toBeNull();
    expect(() => requireAssetBucket()).toThrow(NO_BUCKET_MESSAGE);
    try { requireAssetBucket(); } catch (err) { expect(err.status).toBe(503); }
  });
});
