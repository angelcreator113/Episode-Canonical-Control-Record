/**
 * Audit, 2026-10-15: a new base (generated or uploaded) deleted the old
 * base image from S3 while an Inside angle (the base picture itself), a
 * promoted angle or an approved base still showed it. It is deleted only
 * when nothing shows it; a check that cannot run keeps it.
 */
const mockSend = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn((input) => ({ input })),
  DeleteObjectCommand: jest.fn((input) => ({ input })),
}));

process.env.S3_PRIMARY_BUCKET = process.env.S3_PRIMARY_BUCKET || 'episode-assets';
const sceneGen = require('../../../src/services/sceneGenerationService');

describe('deleteOldBaseImage', () => {
  const bucket = process.env.S3_PRIMARY_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
  const url = `https://${bucket}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/scene-sets/s1/stills/1-base.jpg`;
  beforeEach(() => {
    mockSend.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('an image an angle or an approved base still shows is kept', async () => {
    const db = { query: jest.fn(async () => [[{ used: true }]]) };
    await sceneGen.deleteOldBaseImage(url, db);
    expect(db.query.mock.calls[0][0]).toMatch(/scene_angles WHERE still_image_url = :url[\s\S]*approved_base_image_url = :url/);
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('an image nothing shows is deleted', async () => {
    await sceneGen.deleteOldBaseImage(url, { query: jest.fn(async () => [[{ used: false }]]) });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].input.Key).toBe('scene-sets/s1/stills/1-base.jpg');
  });

  test('a check that cannot run keeps the image', async () => {
    await sceneGen.deleteOldBaseImage(url, { query: jest.fn(async () => { throw new Error('db down'); }) });
    await sceneGen.deleteOldBaseImage(url, null);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
