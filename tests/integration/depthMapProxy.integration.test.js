/**
 * Audit, 2026-10-15: the depth-map proxies fetched any URL containing
 * ".s3." and the bucket name. Through the routes, an internal address is
 * refused before any fetch; our own bucket's depth map is still served.
 */
jest.unmock('uuid');
jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return { ...actual, get: jest.fn(), create: actual.create };
});

const request = require('supertest');
const crypto = require('crypto');
const { Readable } = require('stream');
const axios = require('axios');
const app = require('../../src/app');
const TokenService = require('../../src/services/tokenService');

const shouldSkip =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL?.includes('amazonaws.com') ||
  !process.env.DATABASE_URL?.includes('episode_metadata_test');

(shouldSkip ? describe.skip : describe)('Depth-map proxy fetches only our bucket', () => {
  let token;
  const saved = {};
  const setId = crypto.randomUUID();
  const angleId = crypto.randomUUID();
  const sceneId = crypto.randomUUID();
  const paths = [
    `/api/v1/scene-sets/${setId}/angles/${angleId}/depth-map`,
    `/api/v1/scenes/${sceneId}/depth-map`,
  ];

  beforeAll(() => {
    for (const k of ['S3_PRIMARY_BUCKET', 'AWS_S3_BUCKET', 'S3_BUCKET_NAME']) { saved[k] = process.env[k]; delete process.env[k]; }
    process.env.S3_PRIMARY_BUCKET = 'episode-assets';
    token = TokenService.generateTokenPair({
      id: 'test-user-depth-proxy', email: 'user@depth-proxy.dev', name: 'Editor', groups: ['USER', 'EDITOR'], role: 'USER',
    }).accessToken;
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  });
  beforeEach(() => {
    axios.get.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('an internal address dressed as the bucket is refused, unfetched', async () => {
    const url = 'http://169.254.169.254/latest/meta-data/iam/security-credentials/?x=.s3.episode-assets';
    for (const path of paths) {
      const res = await request(app).get(path).query({ url }).set('Authorization', `Bearer ${token}`);
      expect([path, res.status]).toEqual([path, 404]);
    }
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('our bucket\'s depth map is fetched without following redirects', async () => {
    axios.get.mockResolvedValue({ headers: { 'content-type': 'image/png' }, data: Readable.from([Buffer.from('png')]) });
    const url = 'https://episode-assets.s3.us-east-1.amazonaws.com/scene-sets/x/depth-map-1.png';
    const res = await request(app).get(paths[0]).query({ url }).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(axios.get).toHaveBeenCalledWith(url, expect.objectContaining({ maxRedirects: 0 }));
  });
});
