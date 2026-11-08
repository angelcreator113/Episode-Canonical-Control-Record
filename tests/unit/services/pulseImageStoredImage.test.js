/**
 * #3714 recovery: storePulseImage takes an exact key only under its prefix,
 * and storedImage reads what storage holds under a key without writing or
 * deleting anything (services/pulseImageService).
 */
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  HeadObjectCommand: jest.fn().mockImplementation((input) => ({ kind: 'head', input })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ kind: 'put', input })),
}));

const { storePulseImage, storedImage } = require('../../../src/services/pulseImageService');

describe('storePulseImage exact key', () => {
  test.each([
    ['another prefix', 'other/x.jpg'],
    ['not a jpg', 'characters/c/camera-roll/m/t.png'],
    ['a parent step', 'characters/c/camera-roll/../x.jpg'],
    ['an empty segment', 'characters/c/camera-roll//x.jpg'],
  ])('refuses %s before reading the file', async (_label, key) => {
    await expect(storePulseImage(null, { keyPrefix: 'characters/c/camera-roll', key })).rejects.toMatchObject({ code: 'BAD_KEY' });
  });
});

describe('storedImage', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; mockSend.mockReset(); });

  test('no bucket configured: 503, nothing sent', async () => {
    delete process.env.S3_PRIMARY_BUCKET;
    delete process.env.AWS_S3_BUCKET;
    await expect(storedImage('k.jpg')).rejects.toMatchObject({ status: 503, code: 'NO_STORAGE' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  test('reads the object\'s metadata with one HeadObject; never a write or a delete', async () => {
    process.env.S3_PRIMARY_BUCKET = 'bucket-x';
    process.env.AWS_REGION = 'us-east-1';
    mockSend.mockResolvedValueOnce({ Metadata: { 'moment-id': 'm', 'claim-token': 't' }, ContentType: 'image/jpeg', ContentLength: 10 });
    const out = await storedImage('characters/c/camera-roll/m/t.jpg');
    expect(out).toEqual({
      url: 'https://bucket-x.s3.us-east-1.amazonaws.com/characters/c/camera-roll/m/t.jpg',
      metadata: { 'moment-id': 'm', 'claim-token': 't' }, contentType: 'image/jpeg', size: 10,
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].kind).toBe('head');
  });

  test('a missing object is null; another storage error is a 502', async () => {
    process.env.S3_PRIMARY_BUCKET = 'bucket-x';
    mockSend.mockRejectedValueOnce(Object.assign(new Error('nf'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } }));
    expect(await storedImage('a.jpg')).toBeNull();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSend.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } }));
    await expect(storedImage('a.jpg')).rejects.toMatchObject({ status: 502, code: 'STORAGE_UNREADABLE' });
  });
});
