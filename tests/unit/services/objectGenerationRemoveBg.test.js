/**
 * remove.bg is budget-checked and logged like every image call (fourth
 * audit, 2026-10-15: it was paid with no budget check). A refused budget
 * skips the background removal, as any failure of it does.
 */
process.env.REMOVEBG_API_KEY = 'test-key';

const mockPost = jest.fn();
jest.mock('axios', () => ({ post: (...a) => mockPost(...a), get: jest.fn() }));
const mockSend = jest.fn(async () => ({}));
jest.mock('@aws-sdk/client-s3', () => ({ S3Client: jest.fn(() => ({ send: (...a) => mockSend(...a) })), PutObjectCommand: jest.fn() }));
const mockRunImageCall = jest.fn();
jest.mock('../../../src/services/imageCostService', () => ({ runImageCall: (...a) => mockRunImageCall(...a) }));

const { removeBackground } = require('../../../src/services/objectGenerationService');

describe('removeBackground', () => {
  beforeEach(() => {
    mockPost.mockReset().mockResolvedValue({ data: Buffer.from('png') });
    mockRunImageCall.mockReset().mockImplementation((_plan, fn) => fn());
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('runs through the image budget and log', async () => {
    const url = await removeBackground('https://x/object.png', 'scene-1');
    expect(mockRunImageCall).toHaveBeenCalledWith({ model: 'remove.bg', provider: 'removebg' }, expect.any(Function));
    expect(mockPost).toHaveBeenCalledWith('https://api.remove.bg/v1.0/removebg', expect.objectContaining({ image_url: 'https://x/object.png' }), expect.any(Object));
    expect(url).toMatch(/-nobg\.png$/);
  });

  test('a refused budget makes no paid call and skips the removal', async () => {
    mockRunImageCall.mockRejectedValue(Object.assign(new Error('Daily AI budget reached'), { code: 'AI_BUDGET_EXCEEDED', status: 429 }));
    expect(await removeBackground('https://x/object.png', 'scene-1')).toBeNull();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
