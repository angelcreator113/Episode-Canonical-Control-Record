/**
 * createWardrobeItem tells the client whether background removal started
 * (Task #1769). No database, no S3, no remove.bg: models, the image service
 * and the S3 client are jest mocks; the S3 client rejects so the detached
 * removal block ends in its own catch without any network call.
 */

const mockWardrobe = { create: jest.fn(), findOne: jest.fn() };

jest.mock('../../../src/models', () => ({
  models: { Wardrobe: mockWardrobe, EpisodeWardrobe: {}, Episode: {} },
  sequelize: {},
  Sequelize: {},
}));
jest.mock('../../../src/services/wardrobeImageService', () => ({
  processWardrobeUpload: jest.fn(),
}));
jest.mock('../../../src/services/removeBgParams', () => ({ applyRemoveBgParams: jest.fn() }));
jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn().mockRejectedValue(new Error('s3 mocked: no network in tests'));
  return {
    S3Client: jest.fn(() => ({ send })),
    PutObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    __send: send,
  };
});

const wardrobeImageService = require('../../../src/services/wardrobeImageService');
const s3 = require('@aws-sdk/client-s3');
const wardrobeController = require('../../../src/controllers/wardrobeController');

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() });
const file = { buffer: Buffer.from('img'), originalname: 'slip.jpg', mimetype: 'image/jpeg' };
const flush = () => new Promise((r) => setImmediate(r));

describe('createWardrobeItem background_removal flag (Task #1769)', () => {
  let warnSpy;
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REMOVEBG_API_KEY;
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockWardrobe.create.mockImplementation(async (row) => ({ id: 'w-1', ...row, update: jest.fn() }));
    wardrobeImageService.processWardrobeUpload.mockResolvedValue({
      mainImage: { s3Key: 'wardrobe/Lala/a.jpg', s3Url: 'https://bucket/wardrobe/Lala/a.jpg' },
      thumbnail: { s3Url: 'https://bucket/wardrobe/Lala/a-thumb.jpg' },
    });
  });
  afterEach(() => {
    delete process.env.REMOVEBG_API_KEY;
    jest.restoreAllMocks();
  });

  test('started when an image was stored and REMOVEBG_API_KEY is set', async () => {
    process.env.REMOVEBG_API_KEY = 'test-key-not-real';
    const res = makeRes();
    await wardrobeController.createWardrobeItem({ body: { character: 'Lala', name: 'Slip' }, file }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.background_removal).toBe('started');
    expect(body.data.s3_url).toBe('https://bucket/wardrobe/Lala/a.jpg');
    expect(body.data.s3_url_processed).toBeUndefined();

    // The detached block ran, hit the mocked S3 rejection, and logged it.
    await flush();
    expect(s3.__send).toHaveBeenCalled();
    expect(warnSpy.mock.calls.some((c) => String(c[0]).includes('Background removal failed'))).toBe(true);
  });

  test('not_started when REMOVEBG_API_KEY is unset', async () => {
    const res = makeRes();
    await wardrobeController.createWardrobeItem({ body: { character: 'Lala', name: 'Slip' }, file }, res);

    expect(res.json.mock.calls[0][0].background_removal).toBe('not_started');
    await flush();
    expect(s3.__send).not.toHaveBeenCalled();
  });

  test('not_started when no image was uploaded', async () => {
    process.env.REMOVEBG_API_KEY = 'test-key-not-real';
    const res = makeRes();
    await wardrobeController.createWardrobeItem({ body: { character: 'Lala', name: 'No photo' } }, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].background_removal).toBe('not_started');
    expect(wardrobeImageService.processWardrobeUpload).not.toHaveBeenCalled();
  });
});
