/**
 * Scene Sets audit (2026-10-15): a gpt-image-1.5 base was stored as its
 * raw 1536x1024 PNG, beside 1920x1080 angles and looks; and a frame was
 * kept as a pure crop by its width alone, so a wide, short strip was
 * stretched into a view.
 */
const mockSend = jest.fn(async () => ({}));
const mockResize = jest.fn();
const mockSize = { width: 1920, height: 1080 };
jest.mock('sharp', () => jest.fn(() => {
  const chain = {
    resize: (...args) => { mockResize(...args); return chain; },
    jpeg: () => chain, png: () => chain, extract: () => chain,
    toBuffer: async () => Buffer.from('jpeg'),
    metadata: async () => ({ ...mockSize }),
  };
  return chain;
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn((input) => ({ input })),
  DeleteObjectCommand: jest.fn(),
}));
jest.mock('axios', () => ({ get: jest.fn(async () => ({ data: Buffer.from('png') })), post: jest.fn() }));
jest.mock('../../../src/services/imageCostService', () => ({
  ...jest.requireActual('../../../src/services/imageCostService'),
  runImageCall: jest.fn(async (plan, call) => call()),
}));

const axios = require('axios');
const sceneGen = require('../../../src/services/sceneGenerationService');

describe('the shape of a stored still', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai';
    mockSend.mockClear();
    mockResize.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('a gpt-image-1.5 base is stored as every still: a 1920x1080 JPEG', async () => {
    axios.post.mockResolvedValueOnce({ data: { data: [{ b64_json: Buffer.from('png').toString('base64') }] } });
    const { stillUrl } = await sceneGen.generateBaseStill({ id: 'set-1' }, 'A loft.', 'gpt-image-1.5');
    expect(stillUrl).toMatch(/scene-sets\/set-1\/stills\/\d+-base-gpt-image-1\.5\.jpg$/);
    expect(mockResize).toHaveBeenCalledWith(1920, 1080, { fit: 'cover', position: 'center' });
    expect(mockSend.mock.calls[0][0].input.ContentType).toBe('image/jpeg');
  });

  test('a frame under half the picture\'s height is generated, not cropped', async () => {
    const strip = { left: 0, top: 0.4, width: 0.9, height: 0.3 };
    const crop = sceneGen.cropAndOutpaint;
    expect(await crop('https://s3.example/base.png', 'WIDE', 'set-1', 'a1', 'p', { frame: strip })).toBeNull();
    expect(axios.get).not.toHaveBeenCalledWith('https://s3.example/base.png', expect.anything());
    const view = { left: 0, top: 0.2, width: 0.6, height: 0.6 };
    // Kept, and stored as every still is (sceneImageAudit3.test.js).
    expect(await crop('https://s3.example/base.png', 'WIDE', 'set-1', 'a1', 'p', { frame: view })).toMatch(/stills\/\d+-angle-a1-crop\.jpg$/);
    expect(mockResize).toHaveBeenCalledWith(1920, 1080, { fit: 'cover', position: 'center' });
  });

  // Fourth audit: a crop with too few real pixels came out soft.
  test('a frame with too few real pixels is generated, not cropped', async () => {
    const crop = sceneGen.cropAndOutpaint;
    const view = { left: 0, top: 0.2, width: 0.6, height: 0.6 };
    // A Flux base drawn 1024x576, stored upscaled to 1920x1080: 614 real pixels wide.
    expect(await crop('https://s3.example/base.png', 'WIDE', 'set-1', 'a1', 'p', { frame: view, nativeWidth: 1024 })).toBeNull();
    // A small picture, read as it is.
    Object.assign(mockSize, { width: 1024, height: 576 });
    try {
      expect(await crop('https://s3.example/base.png', 'WIDE', 'set-1', 'a1', 'p', { frame: view })).toBeNull();
    } finally {
      Object.assign(mockSize, { width: 1920, height: 1080 });
    }
    // Drawn at full size: kept.
    expect(await crop('https://s3.example/base.png', 'WIDE', 'set-1', 'a1', 'p', { frame: view, nativeWidth: 1920 })).toMatch(/-crop\.jpg$/);
  });

  test('the estimate reads the base\'s drawn size the same way', () => {
    const { cropHasPixels } = sceneGen;
    const view = { width: 0.6, height: 0.6 };
    expect(cropHasPixels(view, { base_generation: { width: 1024, height: 576 } })).toBe(false);
    expect(cropHasPixels(view, { base_generation: JSON.stringify({ width: 1920, height: 1080 }) })).toBe(true);
    expect(cropHasPixels(view, {})).toBe(true);
  });
});
