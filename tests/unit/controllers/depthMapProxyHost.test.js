/**
 * The depth-map proxy (GET /scenes/:id/depth-map and
 * /scene-sets/:id/angles/:angleId/depth-map) fetches the image on the
 * server. Audit, 2026-10-15: it accepted any URL containing ".s3." and the
 * bucket name, so ?url=http://169.254.169.254/...?x=.s3.<bucket> fetched
 * and returned internal addresses. Only our bucket's S3 host is fetched.
 */
const { isOwnS3Url } = require('../../../src/controllers/sceneStudioController');

describe('isOwnS3Url', () => {
  const saved = {};
  beforeAll(() => {
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET', 'S3_BUCKET_NAME']) { saved[k] = process.env[k]; delete process.env[k]; }
    process.env.S3_PRIMARY_BUCKET = 'episode-assets';
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  });
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  test('our bucket on its S3 host, with or without the region', () => {
    expect(isOwnS3Url('https://episode-assets.s3.us-east-1.amazonaws.com/scene-sets/x/depth-map-1.png')).toBe(true);
    expect(isOwnS3Url('https://episode-assets.s3.amazonaws.com/scene-sets/x/depth-map-1.png')).toBe(true);
    expect(isOwnS3Url('https://Episode-Assets.s3.eu-west-2.amazonaws.com/a.png')).toBe(true);
  });

  test('anything else is refused', () => {
    for (const url of [
      'http://169.254.169.254/latest/meta-data/iam/security-credentials/?x=.s3.episode-assets',
      'http://episode-assets.s3.us-east-1.amazonaws.com/a.png', // not https
      'https://episode-assets.s3.us-east-1.amazonaws.com:8443/a.png', // a port
      'https://user:pw@episode-assets.s3.us-east-1.amazonaws.com/a.png', // credentials
      'https://episode-assets.s3.us-east-1.amazonaws.com.evil.example/a.png',
      'https://evil.example/episode-assets.s3.us-east-1.amazonaws.com/a.png',
      'https://other-bucket.s3.us-east-1.amazonaws.com/episode-assets.png',
      'https://x.episode-assets.s3.us-east-1.amazonaws.com/a.png',
      'https://episode-assets.s3.internal.amazonaws.com/a.png', // not a region
      'https://episode-assets.s3-website-us-east-1.amazonaws.com/a.png',
      'not a url', '', null, undefined, 42,
    ]) expect([url, isOwnS3Url(url)]).toEqual([url, false]);
  });

  test('no bucket configured: nothing is fetched', () => {
    delete process.env.S3_PRIMARY_BUCKET;
    expect(isOwnS3Url('https://episode-assets.s3.us-east-1.amazonaws.com/a.png')).toBe(false);
    process.env.S3_PRIMARY_BUCKET = 'episode-assets';
  });
});
